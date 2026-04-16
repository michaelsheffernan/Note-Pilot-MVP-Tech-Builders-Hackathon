import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { coachChat } from "@/server/coach.functions";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface StudyDay {
  day: number;
  date: string;
  topics: string[];
  estimated_minutes: number;
}

const suggestions = [
  { label: "Key topics", text: "What are the key topics I should focus on?" },
  { label: "Explain simply", text: "Explain the main concepts in simple terms" },
  { label: "Quiz me", text: "Quiz me on this material" },
  { label: "Study tips", text: "Give me study tips based on my plan" },
];

export function CoachTab({
  noteContext,
  subjectName,
  accessToken,
  studyPlan,
}: {
  noteContext: string;
  subjectName: string;
  accessToken: string;
  studyPlan?: StudyDay[];
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hey! 👋 I'm your personal study coach for **${subjectName}**. I've reviewed your notes${studyPlan?.length ? ` and your ${studyPlan.length}-day study plan` : ""}. Ask me anything!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build combined context with notes + study plan
  const buildContext = () => {
    let ctx = noteContext || "";
    if (studyPlan?.length) {
      ctx += "\n\n--- STUDY PLAN ---\n";
      ctx += studyPlan
        .map(
          (d) =>
            `Day ${d.day} (${d.date}): ${d.topics.join(", ")} — ${d.estimated_minutes} min`
        )
        .join("\n");
    }
    return ctx;
  };

  const handleSend = async (msg?: string) => {
    const text = (msg || input).trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await coachChat({
        data: {
          message: text,
          noteContext: buildContext(),
          subjectName,
          accessToken,
          history: messages
            .filter((m) => m.role !== "assistant" || messages.indexOf(m) > 0)
            .map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't respond right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex flex-col h-[65vh] glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-card/50">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/15">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Study Coach</p>
          <p className="text-[11px] text-muted-foreground">
            Trained on your {subjectName} notes
            {studyPlan?.length ? ` & ${studyPlan.length}-day plan` : ""}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          AI
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`flex-shrink-0 flex items-start justify-center h-7 w-7 rounded-full mt-0.5 ${
                msg.role === "user"
                  ? "bg-primary/20"
                  : "bg-secondary"
              }`}
            >
              {msg.role === "user" ? (
                <User className="h-3.5 w-3.5 text-primary mt-1.5" />
              ) : (
                <Bot className="h-3.5 w-3.5 text-muted-foreground mt-1.5" />
              )}
            </div>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-secondary/70 text-foreground rounded-tl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-secondary">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="bg-secondary/70 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-primary/60"
                    style={{
                      animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {suggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => handleSend(s.text)}
              className="group rounded-full border border-border/60 bg-card/80 px-3.5 py-1.5 text-xs text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:text-primary hover:bg-primary/5 hover:shadow-sm"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 px-4 py-3 border-t border-border/50 bg-card/30">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your notes or study plan..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
          className="rounded-xl border-border/50 bg-secondary/50 focus-visible:ring-primary/30"
        />
        <Button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          size="icon"
          className="rounded-xl shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
