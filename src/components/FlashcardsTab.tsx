import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Flashcard {
  question: string;
  answer: string;
}

export function FlashcardsTab({ cards }: { cards: Flashcard[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState<Set<number>>(new Set());

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, cards.length]);

  if (!cards || cards.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No flashcards generated yet.</p>;
  }

  const card = cards[currentIndex];

  const goNext = () => {
    setReviewed((prev) => new Set(prev).add(currentIndex));
    setFlipped(false);
    setCurrentIndex((i) => Math.min(i + 1, cards.length - 1));
  };

  const goPrev = () => {
    setFlipped(false);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const reviewedCount = reviewed.size + (flipped ? 1 : 0);
  const reviewProgress = Math.round((Math.min(reviewedCount, cards.length) / cards.length) * 100);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex w-full max-w-md items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {cards.length}
        </p>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      <div className="mb-3 w-full max-w-md">
        <Progress value={reviewProgress} className="h-1.5" />
      </div>

      <div
        onClick={() => setFlipped(!flipped)}
        className="glass-card flex min-h-[250px] w-full max-w-md cursor-pointer items-center justify-center p-8 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
        style={{ perspective: "1000px" }}
      >
        <div className={`transition-all duration-300 ${flipped ? "scale-[1.02]" : ""}`}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            {flipped ? "Answer" : "Question"}
          </p>
          <p className="text-lg font-medium text-foreground">
            {flipped ? card.answer : card.question}
          </p>
          {!flipped && (
            <p className="mt-4 text-xs text-muted-foreground">Click to reveal answer</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={goPrev} disabled={currentIndex === 0}>
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex gap-1">
          {cards.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === currentIndex ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        <Button variant="outline" size="icon" onClick={goNext} disabled={currentIndex === cards.length - 1}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Press Space to flip &middot; Arrow keys to navigate
      </p>
    </div>
  );
}
