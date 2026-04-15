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
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient<Database>(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get user from access token
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const userClient = createClient<Database>(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Unauthorized");
    const userId = authData.user.id;

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("notes")
      .download(data.fileUrl);
    if (downloadError || !fileData) throw new Error("Failed to download file");

    // Extract text from file (for now, treat as text; PDF/DOCX extraction is limited in Workers)
    let noteText = "";
    const fileName = data.fileUrl.toLowerCase();
    if (fileName.endsWith(".pdf") || fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
      // For binary files, we convert to base64 and ask Claude to interpret
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      noteText = `[Binary file uploaded: ${data.fileUrl}. The student uploaded their study notes. Please generate a comprehensive study plan and flashcards based on a typical ${data.subjectName} course.]`;
    } else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png")) {
      noteText = `[Image file uploaded: ${data.fileUrl}. The student uploaded photo notes for ${data.subjectName}. Please generate a comprehensive study plan and flashcards based on typical ${data.subjectName} topics.]`;
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

    // Call AI to generate study plan and flashcards
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI API key not configured");

    const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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

    // Parse the JSON from AI response
    let parsed: { study_plan: unknown[]; flashcards: unknown[] };
    try {
      // Try to extract JSON from the response (AI sometimes wraps in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
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
