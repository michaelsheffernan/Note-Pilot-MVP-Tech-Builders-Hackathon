import { useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Settings, LogOut, Upload, Camera } from "lucide-react";
import { toast } from "sonner";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { profile, displayName, initials, updateProfile } = useProfile();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const openSettings = () => {
    setEditName(profile?.display_name || "");
    setEditBio(profile?.bio || "");
    setSettingsOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = (await updateProfile({ display_name: editName.trim() || null, bio: editBio.trim() || null })) || {};
    if (error) toast.error("Failed to save profile");
    else toast.success("Profile updated!");
    setSaving(false);
    setSettingsOpen(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("notes").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("notes").getPublicUrl(path);
      await updateProfile({ avatar_url: urlData.publicUrl });
      toast.success("Avatar updated!");
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const avatarUrl = profile?.avatar_url || undefined;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full p-1 hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground hidden sm:inline">{displayName}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openSettings}>
            <Settings className="h-4 w-4 mr-2" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/upload" })}>
            <Upload className="h-4 w-4 mr-2" /> New Study Plan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
            <DialogDescription>Update your name, avatar, and bio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">{initials}</AvatarFallback>
                </Avatar>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                  disabled={uploadingAvatar}
                >
                  <Camera className="h-3 w-3" />
                </button>
                <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              </div>
              <div className="text-sm text-muted-foreground">Click the camera icon to upload a profile picture.</div>
            </div>

            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" className="mt-1" />
            </div>

            <div>
              <Label htmlFor="bio">Bio <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="bio" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Tell us about yourself" rows={3} className="mt-1" />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
