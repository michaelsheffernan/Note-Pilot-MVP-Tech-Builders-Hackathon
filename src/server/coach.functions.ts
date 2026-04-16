import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const coachChat = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      message: string;
      noteContext: string;
      subjectName: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
      accessToken: string;
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

    // Verify the user is authenticated before calling the edge function
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Unauthorized");

    const { data: aiData, error: aiError } = await supabase.functions.invoke("coach-chat", {
      body: {
        message: data.message,
        noteContext: data.noteContext.slice(0, 10000),
        subjectName: data.subjectName,
        history: data.history.slice(-10),
      },
    });

    if (aiError) {
      console.error("Coach edge function error:", aiError);
      throw new Error("AI coach is temporarily unavailable. Please try again.");
    }

    return { reply: aiData?.reply ?? "I'm sorry, I couldn't generate a response." };
  });
