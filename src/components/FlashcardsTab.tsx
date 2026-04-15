import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Flashcard {
  question: string;
  answer: string;
}

export function FlashcardsTab({ cards }: { cards: Flashcard[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards || cards.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No flashcards generated yet.</p>;
  }

  const card = cards[currentIndex];

  const goNext = () => {
    setFlipped(false);
    setCurrentIndex((i) => Math.min(i + 1, cards.length - 1));
  };

  const goPrev = () => {
    setFlipped(false);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <div className="flex flex-col items-center">
      <p className="mb-4 text-sm text-muted-foreground">
        Card {currentIndex + 1} of {cards.length}
      </p>

      <div
        onClick={() => setFlipped(!flipped)}
        className="glass-card flex min-h-[250px] w-full max-w-md cursor-pointer items-center justify-center p-8 text-center transition-all hover:scale-[1.02]"
        style={{ perspective: "1000px" }}
      >
        <div>
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
    </div>
  );
}
