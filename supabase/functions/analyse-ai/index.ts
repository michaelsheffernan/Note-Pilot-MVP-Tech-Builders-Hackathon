import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function unauthorizedResponse(msg = "Unauthorized") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) return null;
  return user;
}

function repairAndParseJSON(raw: string): { study_plan: any[]; flashcards: any[] } {
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonStart = cleaned.indexOf("{");
  if (jsonStart === -1) throw new Error("No JSON object found in AI response");
  cleaned = cleaned.substring(jsonStart);

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.study_plan && parsed.flashcards) return parsed;
  } catch {
    // continue to repair
  }

  cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.study_plan && parsed.flashcards) return parsed;
  } catch {
    // continue to repair
  }

  let repaired = cleaned;
  const opens = (s: string, c: string) => (s.match(new RegExp(`\\${c}`, "g")) || []).length;
  const closes = (s: string, c: string) => (s.match(new RegExp(`\\${c}`, "g")) || []).length;

  const lastGoodComma = repaired.lastIndexOf("},");
  const lastGoodBracket = repaired.lastIndexOf("}]");
  const lastGood = Math.max(lastGoodComma, lastGoodBracket);

  if (lastGood > 0 && lastGood < repaired.length - 5) {
    repaired = repaired.substring(0, lastGood + 1);
  }

  repaired = repaired.replace(/,\s*$/, "");

  let openSquare = opens(repaired, "[") - closes(repaired, "]");
  let openCurly = opens(repaired, "{") - closes(repaired, "}");
  while (openSquare > 0) {
    repaired += "]";
    openSquare--;
  }
  while (openCurly > 0) {
    repaired += "}";
    openCurly--;
  }

  try {
    const parsed = JSON.parse(repaired);
    if (parsed.study_plan) return { study_plan: parsed.study_plan, flashcards: parsed.flashcards || [] };
    return { study_plan: [], flashcards: [] };
  } catch {
    console.error("JSON repair failed. Raw content (first 500 chars):", raw.substring(0, 500));
    throw new Error("Failed to parse AI response as JSON after repair attempts");
  }
}

const weekdayMap: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function buildStudyDates(startDate: string, endDate: string, studyDays?: string, limit?: number) {
  const allowedWeekdays = (studyDays || "")
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean)
    .map((day) => weekdayMap[day])
    .filter((day): day is number => day !== undefined);

  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const lastDate = new Date(`${endDate}T12:00:00Z`);

  if (Number.isNaN(cursor.getTime()) || Number.isNaN(lastDate.getTime())) {
    return dates;
  }

  while (cursor <= lastDate && (!limit || dates.length < limit)) {
    if (!allowedWeekdays.length || allowedWeekdays.includes(cursor.getUTCDay())) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function applyScheduledDates(plan: any[], scheduledDates: string[]) {
  if (!Array.isArray(plan) || !scheduledDates.length) {
    return Array.isArray(plan) ? plan : [];
  }

  return plan.slice(0, scheduledDates.length).map((entry, index) => ({
    ...entry,
    day: index + 1,
    date: scheduledDates[index],
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify JWT — derive userId from token, never from body
    const user = await verifyUser(req);
    if (!user) return unauthorizedResponse();
    const userId = user.id;

    let body: any;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("Failed to parse request body:", parseErr);
      return new Response(JSON.stringify({ error: "Request body too large or malformed. Try a smaller file." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subjectName, testDate, daysUntilTest, noteText, fileBase64, fileMimeType, uploadId, extraContext } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Use service role only for DB writes — userId is verified from JWT above
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];
    const ctx = extraContext || {};
    const scheduledDates = buildStudyDates(today, testDate, ctx.studyDays, Number(daysUntilTest) || 1);
    const sessionCount = scheduledDates.length || Number(daysUntilTest) || 1;

    let studentContext = "";
    if (ctx.examType) studentContext += `\n- Exam type: ${ctx.examType}`;
    if (ctx.difficulty) studentContext += `\n- Student knowledge level: ${ctx.difficulty}`;
    if (ctx.studyHours) studentContext += `\n- Available study time: ${ctx.studyHours} hours per day`;
    if (ctx.studyStyle) studentContext += `\n- Preferred learning style: ${ctx.studyStyle}`;
    if (ctx.focusAreas) studentContext += `\n- Topics to focus on: ${ctx.focusAreas}`;
    if (ctx.weakTopics) studentContext += `\n- Topics the student struggles with (give extra attention): ${ctx.weakTopics}`;
    if (ctx.additionalNotes) studentContext += `\n- Additional student notes: ${ctx.additionalNotes}`;
    if (ctx.studyMode) studentContext += `\n- Study mode: ${ctx.studyMode === "duration" ? "general study (no specific exam)" : "exam preparation"}`;
    if (ctx.studyDuration) studentContext += `\n- Study duration: ${ctx.studyDuration}`;
    if (ctx.studyGoal) studentContext += `\n- Study goal: ${ctx.studyGoal}`;
    if (ctx.studentName) studentContext += `\n- Student's name: ${ctx.studentName}`;
    if (ctx.studyDays) studentContext += `\n- Weekly study days: ${ctx.studyDays}`;

    const promptText = `You are a study planning AI. A student has uploaded their study notes. The subject label they entered is "${subjectName}" but IGNORE this label if the actual notes content differs — always base your output on the ACTUAL content of the notes.

The test is in ${daysUntilTest} days (test date: ${testDate}).

STUDENT PREFERENCES:${studentContext || "\n- No additional preferences provided"}

Generate:

1. A study plan as a JSON array: [{"day": 1, "date": "YYYY-MM-DD", "topics": ["topic1", "topic2"], "estimated_minutes": 60}]
   - Create exactly ${sessionCount} study sessions
   - Use ONLY these calendar dates for the plan: ${scheduledDates.join(", ") || `Every day from ${today} to ${testDate}`}
   - Do NOT create entries for any other dates or weekdays
   - Each day should have 1-3 focused topics derived from the actual notes
   - Estimated minutes should match the student's available study time (${ctx.studyHours || "1"} hours/day)
   - If the student specified weak topics, schedule them more frequently with spaced repetition
   - If the student specified focus areas, prioritise those topics
   - For ${ctx.examType || "mixed"} exam type, tailor the study approach accordingly
   - For ${ctx.difficulty || "intermediate"} level students, adjust complexity appropriately

2. Flashcards as a JSON array: [{"question": "...", "answer": "..."}]
   - Generate 15-25 flashcards covering the key concepts FROM THE ACTUAL NOTES
   - Questions should test understanding of the specific content in the notes
   - For ${ctx.examType || "mixed"} exams, include appropriate question styles
   - Create extra flashcards for topics the student struggles with

CRITICAL: Read the attached file/notes carefully. Base ALL topics and flashcards ONLY on the actual content provided — never generate generic subject material.

${fileBase64 ? "" : `STUDENT NOTES:\n${noteText}`}

RESPOND ONLY WITH VALID JSON in this exact format, no other text:
{"study_plan": [...], "flashcards": [...]}`;

    const messageContent = fileBase64 && fileMimeType
      ? [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: `data:${fileMimeType};base64,${fileBase64}` } },
        ]
      : promptText;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: messageContent }],
        max_tokens: 8000,
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errBody);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("AI returned empty response");

    const parsed = repairAndParseJSON(content);
    const scheduledPlan = applyScheduledDates(parsed.study_plan, scheduledDates);

    if (!scheduledPlan.length) {
      console.error("AI returned empty study plan");
      throw new Error("AI generated an empty study plan");
    }

    const { error: planError } = await supabase.from("study_plans").insert({
      user_id: userId,
      upload_id: uploadId,
      plan_json: scheduledPlan,
    });
    if (planError) {
      console.error("Plan insert error:", planError);
      throw new Error("Failed to save study plan");
    }

    const { error: cardsError } = await supabase.from("flashcards").insert({
      user_id: userId,
      upload_id: uploadId,
      cards_json: parsed.flashcards || [],
    });
    if (cardsError) {
      console.error("Cards insert error:", cardsError);
      throw new Error("Failed to save flashcards");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyse-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
