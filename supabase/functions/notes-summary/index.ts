import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { noteText, subjectName, fileUrl, uploadId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Try to get actual note content - first from noteText, then by downloading the file
    let actualNoteText = noteText || "";
    let fileBase64 = "";
    let fileMimeType = "";

    // If noteText is a placeholder or too short, try downloading the file
    const isPlaceholder = !actualNoteText || 
      actualNoteText.length < 20 || 
      actualNoteText.includes("[File attached as base64");

    if (isPlaceholder && fileUrl) {
      console.log("noteText is placeholder, downloading file from storage:", fileUrl);
      const { data: fileData, error: dlError } = await supabase.storage
        .from("notes")
        .download(fileUrl);
      
      if (!dlError && fileData) {
        const fileName = fileUrl.toLowerCase();
        if (fileName.endsWith(".pdf") || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || 
            fileName.endsWith(".png") || fileName.endsWith(".webp")) {
          // Send as base64 for vision model
          const arrayBuf = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          fileBase64 = btoa(binary);
          if (fileName.endsWith(".pdf")) fileMimeType = "application/pdf";
          else if (fileName.endsWith(".png")) fileMimeType = "image/png";
          else if (fileName.endsWith(".webp")) fileMimeType = "image/webp";
          else fileMimeType = "image/jpeg";
        } else {
          actualNoteText = await fileData.text();
        }
      }
    }

    // If we still have no content and no file to send
    if ((!actualNoteText || actualNoteText.length < 10) && !fileBase64) {
      return new Response(
        JSON.stringify({ summary: `No detailed notes available for ${subjectName}. Upload notes to get a comprehensive AI summary.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert academic tutor. You MUST ONLY summarise from the student's actual uploaded notes. Do NOT invent, assume, or hallucinate any content that is not explicitly present in the notes. If the notes are sparse, say so honestly.`;

    const summaryInstructions = `A student is studying "${subjectName}". Based ONLY on their notes, provide:

1. **Overview** — A concise summary of what the notes actually cover (2-3 paragraphs)
2. **Key Concepts** — List the most important concepts, definitions, and theories actually mentioned in the notes
3. **Important Details** — Any formulas, dates, names, or specific facts from the notes worth memorising
4. **Connections** — How different topics in the notes relate to each other
5. **Study Tips** — Specific advice for mastering this material based on what you see
6. **Knowledge Gaps** — Topics that seem incomplete or could benefit from additional study material

IMPORTANT: Only reference information that actually appears in the student's notes. Do not add external knowledge.
Format your response in clean markdown with headers and bullet points.`;

    // Build messages - use vision if we have a file
    let messages: any[];
    if (fileBase64 && fileMimeType) {
      // For images/PDFs: tell AI to READ the attached file
      messages = [{
        role: "user",
        content: [
          { type: "text", text: `${summaryInstructions}\n\nThe student's notes are in the attached file. Read the file content carefully and summarise it.` },
          { type: "image_url", image_url: { url: `data:${fileMimeType};base64,${fileBase64.slice(0, 4 * 1024 * 1024)}` } },
        ],
      }];
    } else {
      // For text notes: include inline
      messages = [{ role: "user", content: `${summaryInstructions}\n\nSTUDENT NOTES:\n${actualNoteText.slice(0, 15000)}` }];
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errBody);
      throw new Error("Failed to generate summary");
    }

    const aiResult = await aiResponse.json();
    const summary = aiResult.choices?.[0]?.message?.content ?? "Could not generate a summary.";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notes-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
