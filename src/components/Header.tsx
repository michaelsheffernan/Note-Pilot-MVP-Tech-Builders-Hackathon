import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-[72px] items-center justify-between px-6 bg-background/80 backdrop-blur-md border-b border-border">
      <Link to="/" className="flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold text-foreground">StudySync</span>
      </Link>
      <div className="flex items-center gap-3">
        <Button variant="ghost" asChild>
          <Link to="/auth">Login</Link>
        </Button>
        <Button asChild>
          <Link to="/auth">Get Started</Link>
        </Button>
      </div>
    </header>
  );
}
