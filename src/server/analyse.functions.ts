import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const analyseNotes = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      uploadId: string;
      subjectName: string;
      testDate: string;
      fileUrl: string;
      accessToken: string;
    }) => input
  )
  .handler(async ({ data }) => {
    // Use VITE_ prefixed vars available in the server runtime, or fallback to non-prefixed
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    // Use the user's access token to authenticate — no service role key needed
    const supabase = createClient<Database>(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify user
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Unauthorized");
    const userId = authData.user.id;

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("notes")
      .download(data.fileUrl);
    if (downloadError || !fileData) throw new Error("Failed to download file");

    // Extract text or prepare binary for multimodal AI
    let noteText = "";
    let fileBase64 = "";
    let fileMimeType = "";
    const fileName = data.fileUrl.toLowerCase();

    if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png") ||
        fileName.endsWith(".pdf") || fileName.endsWith(".webp")) {
      // Send binary files directly to Gemini as base64 (it supports vision + PDF natively)
      const arrayBuf = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      fileBase64 = btoa(binary);
      if (fileName.endsWith(".pdf")) fileMimeType = "application/pdf";
      else if (fileName.endsWith(".png")) fileMimeType = "image/png";
      else if (fileName.endsWith(".webp")) fileMimeType = "image/webp";
      else fileMimeType = "image/jpeg";
      noteText = `[File attached as base64 for direct reading]`;
    } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
      // DOCX can't be read natively by the AI — extract what we can as text
      noteText = await fileData.text();
      if (!noteText || noteText.length < 20) {
        noteText = `Student is studying ${data.subjectName}. The uploaded DOCX file could not be parsed. Generate a comprehensive study plan and flashcards for this subject.`;
      }
    } else {
      noteText = await fileData.text();
    }

    if (!noteText || noteText.length < 5) {
      noteText = `Student is studying ${data.subjectName}. Generate a comprehensive study plan and flashcards for this subject.`;
    }

    // Update upload with extracted text
    await supabase
      .from("uploads")
      .update({ file_text: noteText.slice(0, 50000) })
      .eq("id", data.uploadId);

    // Calculate days until test
    const today = new Date();
    const testDate = new Date(data.testDate);
    const daysUntilTest = Math.max(1, Math.ceil((testDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    // Call AI — LOVABLE_API_KEY is not in process.env for server functions,
    // so we call the gateway using the supabase edge function pattern instead.
    // Use a dedicated edge function, or call the gateway directly if key is available.
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      // Fallback: call via supabase edge function
      const { data: aiData, error: aiError } = await supabase.functions.invoke("analyse-ai", {
        body: {
          subjectName: data.subjectName,
          testDate: data.testDate,
          daysUntilTest,
          noteText: noteText.slice(0, 15000),
          uploadId: data.uploadId,
          userId,
        },
      });
      if (aiError) {
        console.error("Edge function error:", aiError);
        throw new Error("AI generation failed. Please try again.");
      }
      return aiData as { success: boolean };
    }

    // Direct gateway call (if LOVABLE_API_KEY is in process.env)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: `You are a study planning AI. Based on the following student notes for "${data.subjectName}" with a test in ${daysUntilTest} days (test date: ${data.testDate}), generate:

1. A study plan as a JSON array with this schema: [{"day": 1, "date": "YYYY-MM-DD", "topics": ["topic1", "topic2"], "estimated_minutes": 60}]
   - Spread across ${daysUntilTest} days starting from today (${today.toISOString().split("T")[0]})
   - Each day should have 1-3 focused topics
   - Estimated minutes between 30-90

2. Flashcards as a JSON array with this schema: [{"question": "...", "answer": "..."}]
   - Generate 15-30 flashcards covering the key concepts
   - Questions should test understanding, not just recall

STUDENT NOTES:
${noteText.slice(0, 15000)}

RESPOND ONLY WITH VALID JSON in this exact format, no other text:
{"study_plan": [...], "flashcards": [...]}`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error("AI API error:", errBody);
      throw new Error("AI generation failed. Please try again.");
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    // Robust JSON extraction
    let parsed: { study_plan: unknown[]; flashcards: unknown[] };
    try {
      let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found");
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response. Please try again.");
    }

    // Store study plan
    const { error: planError } = await supabase.from("study_plans").insert({
      user_id: userId,
      upload_id: data.uploadId,
      plan_json: parsed.study_plan as unknown as Database["public"]["Tables"]["study_plans"]["Insert"]["plan_json"],
    });
    if (planError) {
      console.error("Plan insert error:", planError);
      throw new Error("Failed to save study plan");
    }

    // Store flashcards
    const { error: cardsError } = await supabase.from("flashcards").insert({
      user_id: userId,
      upload_id: data.uploadId,
      cards_json: parsed.flashcards as unknown as Database["public"]["Tables"]["flashcards"]["Insert"]["cards_json"],
    });
    if (cardsError) {
      console.error("Cards insert error:", cardsError);
      throw new Error("Failed to save flashcards");
    }

    return { success: true };
  });
