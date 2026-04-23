import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateRequestBody(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const noteText = typeof record.noteText === "string" ? record.noteText.slice(0, 200_000) : "";
  const subjectName = typeof record.subjectName === "string" ? record.subjectName.trim().slice(0, 200) : "";
  const fileUrl = typeof record.fileUrl === "string" ? record.fileUrl.trim().slice(0, 5000) : undefined;
  if (!subjectName) return null;
  return { noteText, subjectName, fileUrl };
}

function decodeUtf8Base64(value: string) {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function isMostlyReadableText(value: string) {
  if (value.length < 80) return false;
  const readableChars = value.match(/[A-Za-z0-9\s.,;:!?()\[\]{}"'%/&+\-_=*@#\n\r\t]/g)?.length ?? 0;
  return readableChars / Math.max(value.length, 1) > 0.75;
}

function extractBase64Candidates(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return [] as string[];

  const candidates = new Set<string>([trimmed]);

  for (const match of trimmed.matchAll(/(?:encoded_notes|notes|content)\s*=\s*"""([\s\S]*?)"""/gi)) {
    if (match[1]?.trim()) candidates.add(match[1].trim());
  }

  for (const match of trimmed.matchAll(/"""([\s\S]*?)"""/g)) {
    if (match[1]?.trim()) candidates.add(match[1].trim());
  }

  const base64OnlyLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 60 && /^[A-Za-z0-9+/=]+$/.test(line));

  if (base64OnlyLines.length > 0) {
    candidates.add(base64OnlyLines.join(""));
  }

  return [...candidates];
}

function maybeDecodeBase64Text(input: string) {
  for (const candidate of extractBase64Candidates(input)) {
    const normalized = candidate.replace(/\s+/g, "");
    if (normalized.length < 120) continue;
    if (normalized.length % 4 !== 0) continue;
    if (/[^A-Za-z0-9+/=]/.test(normalized)) continue;

    const decoded = decodeUtf8Base64(normalized)?.replace(/\u0000/g, "").trim();
    if (decoded && isMostlyReadableText(decoded)) {
      return decoded;
    }
  }

  return input;
}

async function requestSummary({
  apiKey,
  systemPrompt,
  messages,
}: {
  apiKey: string;
  systemPrompt: string;
  messages: Array<Record<string, unknown>>;
}) {
  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 2500,
      temperature: 0.1,
    }),
  });

  if (!aiResponse.ok) {
    const errBody = await aiResponse.text();
    console.error("AI API error:", aiResponse.status, errBody);
    throw new Error("Failed to generate summary");
  }

  const aiResult = await aiResponse.json();
  return aiResult.choices?.[0]?.message?.content?.trim() ?? "Could not generate a summary.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsedBody = validateRequestBody(await req.json());
    if (!parsedBody) {
      return new Response(JSON.stringify({ error: "Invalid request payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { noteText, subjectName, fileUrl } = parsedBody;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    let actualNoteText = noteText.replace(/\u0000/g, "").trim();
    const fileImages: { base64: string; mimeType: string }[] = [];

    const isPlaceholder =
      !actualNoteText ||
      actualNoteText.length < 20 ||
      actualNoteText.includes("[File attached as base64");

    // Support multiple files separated by "|||"
    const fileUrlList = fileUrl ? fileUrl.split("|||").filter(Boolean) : [];

    if (isPlaceholder && fileUrlList.length > 0) {
      for (const singleUrl of fileUrlList) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("notes")
          .download(singleUrl);

        if (downloadError || !fileData) continue;

        const fileName = singleUrl.toLowerCase();
        if (
          fileName.endsWith(".pdf") ||
          fileName.endsWith(".jpg") ||
          fileName.endsWith(".jpeg") ||
          fileName.endsWith(".png") ||
          fileName.endsWith(".webp")
        ) {
          const arrayBuffer = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
          const b64 = btoa(binary);
          // Cap each image at ~2MB base64 to stay within limits
          if (b64.length <= 2 * 1024 * 1024) {
            let mime = "image/jpeg";
            if (fileName.endsWith(".pdf")) mime = "application/pdf";
            else if (fileName.endsWith(".png")) mime = "image/png";
            else if (fileName.endsWith(".webp")) mime = "image/webp";
            fileImages.push({ base64: b64, mimeType: mime });
          }
        } else {
          const text = await fileData.text();
          actualNoteText += `\n\n--- File: ${singleUrl.split("/").pop()} ---\n${text}`;
        }
      }
    }

    if (fileImages.length === 0) {
      actualNoteText = maybeDecodeBase64Text(actualNoteText).replace(/\u0000/g, "").trim();
    }

    if ((!actualNoteText || actualNoteText.length < 10) && fileImages.length === 0) {
      return new Response(
        JSON.stringify({
          summary: `No detailed notes available for ${subjectName}. Upload notes to get a comprehensive AI summary.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = [
      "You are an expert academic tutor.",
      "Summarise ONLY the student's notes.",
      "Do NOT invent, assume, or hallucinate content not present in the notes.",
      "Return ONLY the final markdown summary.",
      "Do NOT mention base64, decoding, Python, code snippets, file formats, or how you processed the notes.",
      "If the notes are sparse or incomplete, say so briefly.",
      'Start the response with "## Overview".',
    ].join(" ");

    const summaryInstructions = `A student is studying "${subjectName}". Based ONLY on the student's notes, provide these sections in markdown:

## Overview
## Key Concepts
## Important Details
## Connections
## Study Tips
## Knowledge Gaps

Only reference information explicitly present in the notes.`;

    let messages: Array<Record<string, unknown>>;

    if (fileImages.length > 0) {
      // Build multi-image vision message with ALL uploaded files
      const contentParts: Array<Record<string, unknown>> = [
        {
          type: "text",
          text: `${summaryInstructions}\n\nThe student's notes are in the ${fileImages.length} attached file(s). Read ALL files and summarise their combined content only.${actualNoteText.length > 10 ? `\n\nAdditional text notes:\n${actualNoteText.slice(0, 5000)}` : ""}`,
        },
      ];
      for (const img of fileImages) {
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        });
      }
      messages = [{ role: "user", content: contentParts }];
    } else {
      messages = [{
        role: "user",
        content: `${summaryInstructions}\n\nSTUDENT NOTES:\n${actualNoteText.slice(0, 15000)}`,
      }];
    }

    let summary = await requestSummary({
      apiKey: lovableApiKey,
      systemPrompt,
      messages,
    });

    if (/\bbase64\b|import\s+base64|decoded_notes|I will decode|Please provide the actual base64|```/i.test(summary)) {
      summary = await requestSummary({
        apiKey: lovableApiKey,
        systemPrompt: `${systemPrompt} Absolutely do not include prefaces, code, decoding steps, or meta commentary.`,
        messages,
      });
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notes-summary error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
