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

    // Always use the edge function — it has LOVABLE_API_KEY and supports multimodal
    const { data: aiData, error: aiError } = await supabase.functions.invoke("analyse-ai", {
      body: {
        subjectName: data.subjectName,
        testDate: data.testDate,
        daysUntilTest,
        noteText: noteText.slice(0, 15000),
        fileBase64: fileBase64 || undefined,
        fileMimeType: fileMimeType || undefined,
        uploadId: data.uploadId,
        userId,
      },
    });
    if (aiError) {
      console.error("Edge function error:", aiError);
      throw new Error("AI generation failed. Please try again.");
    }
    return aiData as { success: boolean };
  });
