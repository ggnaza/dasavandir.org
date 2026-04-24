"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  cover_image_url: string | null;
  is_paid: boolean | null;
  price_amd: number | null;
  language: string | null;
};

export function CourseEditor({ course }: { course: Course }) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [published, setPublished] = useState(course.published);
  const [isPaid, setIsPaid] = useState(course.is_paid ?? false);
  const [priceAmd, setPriceAmd] = useState(course.price_amd?.toString() ?? "");
  const [language, setLanguage] = useState<"en" | "hy">(course.language === "en" ? "en" : "hy");
  const [coverUrl, setCoverUrl] = useState(course.cover_image_url ?? "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Max image size is 5MB.");
      return;
    }
    setUploadingImage(true);
    setImageError("");
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${course.id}/cover.${ext}`;
    const { error } = await supabase.storage.from("course-covers").upload(path, file, { upsert: true });
    if (error) {
      setImageError(error.message);
      setUploadingImage(false);
      return;
    }
    const { data } = supabase.storage.from("course-covers").getPublicUrl(path);
    setCoverUrl(data.publicUrl);
    setUploadingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("courses")
      .update({
        title,
        description,
        published,
        cover_image_url: coverUrl || null,
        is_paid: isPaid,
        price_amd: isPaid && priceAmd ? parseInt(priceAmd) : null,
        language,
      })
      .eq("id", course.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this course and all its lessons? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("courses").delete().eq("id", course.id);
    router.push("/admin/courses");
  }

  return (
    <form onSubmit={handleSave} className="bg-white border rounded-xl p-6 space-y-5">
      {/* Cover image */}
      <div>
        <label className="block text-sm font-medium mb-2">Cover image</label>
        <div className="flex items-start gap-4">
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="w-32 h-20 object-cover rounded-lg border" />
          ) : (
            <div className="w-32 h-20 bg-gray-100 rounded-lg border flex items-center justify-center text-gray-400 text-xs">
              No image
            </div>
          )}
          <div>
            <label className="cursor-pointer text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium">
              {uploadingImage ? "Uploading…" : "Upload image"}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploadingImage}
              />
            </label>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · max 5MB</p>
            {imageError && <p className="text-red-600 text-xs mt-1">{imageError}</p>}
            {coverUrl && (
              <button
                type="button"
                onClick={() => setCoverUrl("")}
                className="text-xs text-red-400 hover:underline mt-1 block"
              >
                Remove image
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Language */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Course language</p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="language" checked={language === "hy"} onChange={() => setLanguage("hy")} className="w-4 h-4" />
            <span className="text-sm">Հայerеn (Armenian)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="language" checked={language === "en"} onChange={() => setLanguage("en")} className="w-4 h-4" />
            <span className="text-sm">English</span>
          </label>
        </div>
      </div>

      {/* Pricing */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Pricing</p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pricing"
              checked={!isPaid}
              onChange={() => setIsPaid(false)}
              className="w-4 h-4"
            />
            <span className="text-sm">Free</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pricing"
              checked={isPaid}
              onChange={() => setIsPaid(true)}
              className="w-4 h-4"
            />
            <span className="text-sm">Paid</span>
          </label>
        </div>
        {isPaid && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              placeholder="e.g. 5000"
              value={priceAmd}
              onChange={(e) => setPriceAmd(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-500">AMD</span>
          </div>
        )}
      </div>

      {/* Published */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="published"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="published" className="text-sm font-medium">
          Published (visible to learners)
        </label>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={handleDelete} className="text-sm text-red-500 hover:underline">
          Delete course
        </button>
        <button
          type="submit"
          disabled={saving || uploadingImage}
          className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
