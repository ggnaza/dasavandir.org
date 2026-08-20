"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LanguageToggle } from "@/components/language-toggle";
import { PasswordStrength, isPasswordValid } from "@/components/password-strength";
import type { Lang } from "@/lib/i18n";

type Initial = {
  full_name: string;
  email: string;
  avatar_url: string | null;
  region: string;
  linkedin_url: string;
  bio: string;
};

export function ProfileForm({ initial, lang }: { initial: Initial; lang: Lang }) {
  const [fullName, setFullName] = useState(initial.full_name);
  const [region, setRegion] = useState(initial.region);
  const [linkedin, setLinkedin] = useState(initial.linkedin_url);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Password change
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  async function errText(res: Response, fallback: string) {
    const d = await res.json().catch(() => ({}));
    return d.error ?? fallback;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, region, linkedin_url: linkedin, bio }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await errText(res, "Could not save"));
      return;
    }
    setSaved(true);
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) {
      setError(await errText(res, "Upload failed"));
      return;
    }
    const { avatar_url } = await res.json();
    setAvatarUrl(avatar_url);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (!isPasswordValid(pw)) {
      setPwErr("Password does not meet the requirements.");
      return;
    }
    if (pw !== pw2) {
      setPwErr("Passwords do not match.");
      return;
    }
    setPwSaving(true);
    const { error: e2 } = await createClient().auth.updateUser({ password: pw });
    setPwSaving(false);
    if (e2) {
      setPwErr(e2.message);
      return;
    }
    setPw("");
    setPw2("");
    setPwMsg("Password updated.");
  }

  const initials = (fullName || initial.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Details */}
      <form onSubmit={saveProfile} className="bg-white border rounded-xl p-6 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-brand-100 flex items-center justify-center shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-brand-700">{initials}</span>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP or GIF, up to 5 MB.</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            value={initial.email}
            disabled
            className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-400 mt-1">Contact an admin to change your email.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Region</label>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Yerevan"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">LinkedIn URL</label>
          <input
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://www.linkedin.com/in/…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">About</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="A short bio."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </form>

      {/* Language */}
      <div className="bg-white border rounded-xl p-6">
        <p className="text-sm font-medium mb-2">Language</p>
        <LanguageToggle current={lang} />
      </div>

      {/* Password */}
      <form onSubmit={changePassword} className="bg-white border rounded-xl p-6 space-y-4">
        <p className="text-sm font-medium">Change password</p>
        <div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="New password"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {pw && <PasswordStrength password={pw} />}
        </div>
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Confirm new password"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {pwErr && <p className="text-sm text-red-600">{pwErr}</p>}
        {pwMsg && <p className="text-sm text-green-600">{pwMsg}</p>}
        <button
          type="submit"
          disabled={pwSaving || !pw || !pw2}
          className="border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {pwSaving ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
