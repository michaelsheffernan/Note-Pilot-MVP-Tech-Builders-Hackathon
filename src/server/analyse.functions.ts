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

    // Support multiple files separated by "|||"
    const fileUrls = data.fileUrl.split("|||").filter(Boolean);

    let noteText = "";
    const fileImages: { base64: string; mimeType: string }[] = [];

    for (const url of fileUrls) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("notes")
        .download(url);
      if (downloadError || !fileData) continue;

      const fileName = url.toLowerCase();

      if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png") ||
          fileName.endsWith(".pdf") || fileName.endsWith(".webp")) {
        const arrayBuf = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        // Cap each file at ~2MB base64
        if (b64.length <= 2 * 1024 * 1024) {
          let mime = "image/jpeg";
          if (fileName.endsWith(".pdf")) mime = "application/pdf";
          else if (fileName.endsWith(".png")) mime = "image/png";
          else if (fileName.endsWith(".webp")) mime = "image/webp";
          fileImages.push({ base64: b64, mimeType: mime });
        }
        noteText += `\n\n[File: ${url.split("/").pop()} attached for reading]\n`;
      } else {
        const text = await fileData.text();
        noteText += `\n\n--- File: ${url.split("/").pop()} ---\n${text}`;
      }
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

    // Sanitize free-text context fields with length limits
    const rawCtx = data.extraContext || {};
    const sanitizedContext: Record<string, string> = {};
    const ctxLimits: Record<string, number> = {
      examType: 100, difficulty: 100, studyHours: 20, studyStyle: 100,
      focusAreas: 500, weakTopics: 500, additionalNotes: 1000,
      studyMode: 50, studyDuration: 50, studyGoal: 500, studentName: 100, studyDays: 100,
    };
    for (const [key, val] of Object.entries(rawCtx)) {
      if (typeof val === "string" && key in ctxLimits) {
        sanitizedContext[key] = val.slice(0, ctxLimits[key]);
      }
    }

    // Send all images (up to total ~4MB) to the edge function
    const maxTotalBase64 = 4 * 1024 * 1024;
    const imagesToSend: { base64: string; mimeType: string }[] = [];
    let totalSize = 0;
    for (const img of fileImages) {
      if (totalSize + img.base64.length > maxTotalBase64) break;
      imagesToSend.push(img);
      totalSize += img.base64.length;
    }

    const { data: aiData, error: aiError } = await supabase.functions.invoke("analyse-ai", {
      body: {
        subjectName: data.subjectName.slice(0, 200),
        testDate: data.testDate,
        daysUntilTest,
        noteText: noteText.slice(0, 15000),
        fileImages: imagesToSend.length > 0 ? imagesToSend : undefined,
        uploadId: data.uploadId,
        extraContext: sanitizedContext,
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
