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
      extraContext?: Record<string, string>;
    }) => input
  )
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    const supabase = createClient<Database>(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Unauthorized");
    const userId = authData.user.id;

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("notes")
      .download(data.fileUrl);
    if (downloadError || !fileData) throw new Error("Failed to download file");

    let noteText = "";
    let fileBase64 = "";
    let fileMimeType = "";
    const fileName = data.fileUrl.toLowerCase();

    if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png") ||
        fileName.endsWith(".pdf") || fileName.endsWith(".webp")) {
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

    await supabase
      .from("uploads")
      .update({ file_text: noteText.slice(0, 50000) })
      .eq("id", data.uploadId);

    const today = new Date();
    const testDate = new Date(data.testDate);
    const daysUntilTest = Math.max(1, Math.ceil((testDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    // Limit base64 size to avoid edge function body parse failures
    const maxBase64Size = 4 * 1024 * 1024; // 4MB
    const sendBase64 = fileBase64 && fileBase64.length <= maxBase64Size;

    const { data: aiData, error: aiError } = await supabase.functions.invoke("analyse-ai", {
      body: {
        subjectName: data.subjectName,
        testDate: data.testDate,
        daysUntilTest,
        noteText: noteText.slice(0, 15000),
        fileBase64: sendBase64 ? fileBase64 : undefined,
        fileMimeType: sendBase64 ? fileMimeType : undefined,
        uploadId: data.uploadId,
        extraContext: data.extraContext || {},
      },
    });

    if (aiError) {
      console.error("Edge function error:", aiError);
      const errorMsg = typeof aiData === "object" && aiData?.error
        ? aiData.error
        : typeof aiError === "object" && "message" in aiError
          ? (aiError as any).message
          : "AI generation failed. Please try again.";
      throw new Error(errorMsg);
    }

    if (aiData?.error) {
      throw new Error(aiData.error);
    }

    return aiData as { success: boolean };
  });
