import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/note-pilot-logo.png";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-[72px] items-center justify-between px-6 bg-background/70 backdrop-blur-xl border-b border-border/60 transition-all duration-300">
      <Link to="/" className="flex items-center">
        <img src={logo} alt="Note Pilot" className="h-28 w-28 object-contain" />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" asChild className="text-sm">
          <Link to="/auth">Login</Link>
        </Button>
        <Button asChild className="text-sm font-semibold">
          <Link to="/auth">Get Started</Link>
        </Button>
      </div>
    </header>
  );
}
