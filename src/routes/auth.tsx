import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — StudySync" },
      { name: "description", content: "Sign in or create your StudySync account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/upload" });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp && password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/upload" });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-card w-full max-w-md p-8">
        <div className="mb-8 flex items-center justify-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-foreground">StudySync</span>
        </div>

        <div className="mb-6 flex rounded-xl bg-secondary p-1">
          <button
            onClick={() => setIsSignUp(false)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              !isSignUp ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => setIsSignUp(true)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              isSignUp ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          {isSignUp && (
            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Please wait..." : isSignUp ? "Create Account" : "Log In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
