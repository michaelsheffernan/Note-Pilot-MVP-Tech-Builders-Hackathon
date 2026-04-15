import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subjectName, testDate, daysUntilTest, noteText, fileBase64, fileMimeType, uploadId, userId, extraContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    // Build student context from extra questions
    const ctx = extraContext || {};
    let studentContext = "";
    if (ctx.examType) studentContext += `\n- Exam type: ${ctx.examType}`;
    if (ctx.difficulty) studentContext += `\n- Student knowledge level: ${ctx.difficulty}`;
    if (ctx.studyHours) studentContext += `\n- Available study time: ${ctx.studyHours} hours per day`;
    if (ctx.studyStyle) studentContext += `\n- Preferred learning style: ${ctx.studyStyle}`;
    if (ctx.focusAreas) studentContext += `\n- Topics to focus on: ${ctx.focusAreas}`;
    if (ctx.weakTopics) studentContext += `\n- Topics the student struggles with (give extra attention): ${ctx.weakTopics}`;
    if (ctx.additionalNotes) studentContext += `\n- Additional student notes: ${ctx.additionalNotes}`;

    const promptText = `You are a study planning AI. A student has uploaded their study notes. The subject label they entered is "${subjectName}" but IGNORE this label if the actual notes content differs — always base your output on the ACTUAL content of the notes.

The test is in ${daysUntilTest} days (test date: ${testDate}).

STUDENT PREFERENCES:${studentContext || "\n- No additional preferences provided"}

Generate:

1. A study plan as a JSON array: [{"day": 1, "date": "YYYY-MM-DD", "topics": ["topic1", "topic2"], "estimated_minutes": 60}]
   - Spread across ${daysUntilTest} days starting from today (${today})
   - Each day should have 1-3 focused topics derived from the actual notes
   - Estimated minutes should match the student's available study time (${ctx.studyHours || "1"} hours/day)
   - If the student specified weak topics, schedule them more frequently with spaced repetition
   - If the student specified focus areas, prioritise those topics
   - For ${ctx.examType || "mixed"} exam type, tailor the study approach accordingly
   - For ${ctx.difficulty || "intermediate"} level students, adjust complexity appropriately

2. Flashcards as a JSON array: [{"question": "...", "answer": "..."}]
   - Generate 15-30 flashcards covering the key concepts FROM THE ACTUAL NOTES
   - Questions should test understanding of the specific content in the notes
   - For ${ctx.examType || "mixed"} exams, include appropriate question styles
   - If the student prefers ${ctx.studyStyle || "mixed"} learning, adapt card format (e.g., more visual descriptions for visual learners)
   - Create extra flashcards for topics the student struggles with

CRITICAL: You MUST read the attached file/notes carefully. Base ALL topics and flashcards ONLY on the actual content provided — never generate generic subject material.

${fileBase64 ? "" : `STUDENT NOTES:\n${noteText}`}

RESPOND ONLY WITH VALID JSON in this exact format, no other text:
{"study_plan": [...], "flashcards": [...]}`;

    let messageContent: any;
    if (fileBase64 && fileMimeType) {
      messageContent = [
        { type: "text", text: promptText },
        {
          type: "image_url",
          image_url: { url: `data:${fileMimeType};base64,${fileBase64}` },
        },
      ];
    } else {
      messageContent = promptText;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: messageContent }],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errBody);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found in AI response");
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    const parsed = JSON.parse(cleaned);

    const { error: planError } = await supabase.from("study_plans").insert({
      user_id: userId, upload_id: uploadId, plan_json: parsed.study_plan,
    });
    if (planError) { console.error("Plan insert error:", planError); throw new Error("Failed to save study plan"); }

    const { error: cardsError } = await supabase.from("flashcards").insert({
      user_id: userId, upload_id: uploadId, cards_json: parsed.flashcards,
    });
    if (cardsError) { console.error("Cards insert error:", cardsError); throw new Error("Failed to save flashcards"); }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyse-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
