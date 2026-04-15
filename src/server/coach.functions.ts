import { createServerFn } from "@tanstack/react-start";

export const coachChat = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      message: string;
      noteContext: string;
      subjectName: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
    }) => input
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI API key not configured");

    const messages = [
      {
        role: "system" as const,
        content: `You are a helpful study coach for "${data.subjectName}". You have access to the student's notes and should answer questions based on them. Be encouraging, clear, and concise. If you don't know something from the notes, say so.

STUDENT NOTES CONTEXT:
${data.noteContext.slice(0, 10000)}`,
      },
      ...data.history.slice(-10),
      { role: "user" as const, content: data.message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error("AI coach is temporarily unavailable. Please try again.");
    }

    const result = await response.json();
    const reply = result.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't generate a response.";
    return { reply };
  });
