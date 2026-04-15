import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { noteText, subjectName } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!noteText || noteText.length < 10) {
      return new Response(
        JSON.stringify({ summary: `No detailed notes available for ${subjectName}. Upload notes to get a comprehensive AI summary.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are an expert academic tutor. A student is studying "${subjectName}". Based on their uploaded notes below, provide:

1. **Overview** — A concise summary of what the notes cover (2-3 paragraphs)
2. **Key Concepts** — List the most important concepts, definitions, and theories mentioned
3. **Important Details** — Any formulas, dates, names, or specific facts worth memorising
4. **Connections** — How different topics in the notes relate to each other
5. **Study Tips** — Specific advice for mastering this material based on what you see in the notes
6. **Knowledge Gaps** — Topics that seem incomplete or could benefit from additional study material

STUDENT NOTES:
${noteText}

Format your response in clean markdown with headers and bullet points.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.4,
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
