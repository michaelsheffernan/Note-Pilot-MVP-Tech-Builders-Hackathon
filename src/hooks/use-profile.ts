import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfile(data as Profile);
      } else {
        // Create profile if missing (for existing users before trigger)
        const fallbackName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Student";
        const { data: created } = await supabase
          .from("profiles")
          .insert({ user_id: user.id, display_name: fallbackName })
          .select()
          .single();
        if (created) setProfile(created as Profile);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const updateProfile = async (updates: Partial<Pick<Profile, "display_name" | "avatar_url" | "bio">>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id)
      .select()
      .single();
    if (data) setProfile(data as Profile);
    return { data, error };
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Student";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return { profile, loading, updateProfile, displayName, initials };
}
