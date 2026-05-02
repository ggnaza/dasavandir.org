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
  category: string | null;
  hours_to_complete: number | null;
  outcomes: string[] | null;
  pre_submission_ai: boolean | null;
  deadline_days: number | null;
  deadline_date: string | null;
  allow_shuffled_learning: boolean | null;
};

export function CourseEditor({ course, lessonDeadlineDates = [] }: {
  course: Course;
  lessonDeadlineDates?: { title: string; deadline_date: string | null }[];
}) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [published, setPublished] = useState(course.published);
  const [isPaid, setIsPaid] = useState(course.is_paid ?? false);
  const [priceAmd, setPriceAmd] = useState(course.price_amd?.toString() ?? "");
  const [language, setLanguage] = useState<"en" | "hy">(course.language === "en" ? "en" : "hy");
  const [category, setCategory] = useState(course.category ?? "");
  const [hours, setHours] = useState(course.hours_to_complete?.toString() ?? "");
  const [outcomes, setOutcomes] = useState<string[]>(course.outcomes ?? [""]);
  const [coverUrl, setCoverUrl] = useState(course.cover_image_url ?? "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [preSubmissionAi, setPreSubmissionAi] = useState(course.pre_submission_ai ?? false);
  const [allowShuffled, setAllowShuffled] = useState(course.allow_shuffled_learning ?? false);
  const [deadlineDays, setDeadlineDays] = useState(course.deadline_days?.toString() ?? "");
  const [deadlineDate, setDeadlineDate] = useState(course.deadline_date ?? "");
  const [deadlineMode, setDeadlineMode] = useState<"none" | "days" | "date">(
    course.deadline_date ? "date" : course.deadline_days ? "days" : "none"
  );
  const [deadlineError, setDeadlineError] = useState("");
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
    setDeadlineError("");

    // Validate: course exact deadline cannot be earlier than any lesson exact deadline
    if (deadlineMode === "date" && deadlineDate) {
      const violations = lessonDeadlineDates.filter(
        (l) => l.deadline_date && l.deadline_date > deadlineDate
      );
      if (violations.length > 0) {
        setDeadlineError(
          `Course deadline cannot be earlier than lesson deadlines. Conflicting: ${violations.map((l) => `"${l.title}" (${l.deadline_date})`).join(", ")}`
        );
        return;
      }
    }

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
        category: category.trim() || null,
        hours_to_complete: hours ? parseInt(hours) : null,
        outcomes: outcomes.filter((o) => o.trim()),
        pre_submission_ai: preSubmissionAi,
        allow_shuffled_learning: allowShuffled,
        deadline_days: deadlineMode === "days" && deadlineDays ? parseInt(deadlineDays) : null,
        deadline_date: deadlineMode === "date" && deadlineDate ? deadlineDate : null,
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

      {/* Category & Hours */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Leadership, Technology"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hours to complete</label>
          <input
            type="number"
            min={1}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="e.g. 6"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Outcomes */}
      <div>
        <label className="block text-sm font-medium mb-2">What learners will achieve <span className="text-gray-400 font-normal">(outcomes)</span></label>
        <div className="space-y-2">
          {outcomes.map((outcome, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">✓</span>
              <input
                type="text"
                value={outcome}
                onChange={(e) => {
                  const next = [...outcomes];
                  next[i] = e.target.value;
                  setOutcomes(next);
                }}
                placeholder={`Outcome ${i + 1}`}
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {outcomes.length > 1 && (
                <button type="button" onClick={() => setOutcomes(outcomes.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOutcomes([...outcomes, ""])}
            className="text-sm text-brand-600 hover:underline mt-1"
          >
            + Add outcome
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Course language</p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="language" checked={language === "hy"} onChange={() => setLanguage("hy")} className="w-4 h-4" />
            <span className="text-sm">Հայերեն (Armenian)</span>
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
        <input type="checkbox" id="published" checked={published} onChange={(e) => setPublished(e.target.checked)} className="w-4 h-4" />
        <label htmlFor="published" className="text-sm font-medium">Published (visible to learners)</label>
      </div>

      {/* Course completion deadline */}
      <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
        <div>
          <p className="text-sm font-medium">Course completion deadline <span className="text-gray-400 font-normal">(optional)</span></p>
          <p className="text-xs text-gray-400">Learners see an overdue badge on their dashboard if they miss this. Per-lesson deadlines can be set in each lesson editor.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["none", "days", "date"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDeadlineMode(m)}
              className={`text-xs px-3 py-1.5 rounded-full border ${deadlineMode === m ? "bg-brand-600 text-white border-brand-600" : "text-gray-600 border-gray-300 hover:bg-gray-50"}`}
            >
              {m === "none" ? "No deadline" : m === "days" ? "Days after enrollment" : "Exact date"}
            </button>
          ))}
        </div>
        {deadlineMode === "days" && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="730"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              placeholder="e.g. 30"
              className="w-24 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-500">days after enrollment</span>
          </div>
        )}
        {deadlineMode === "date" && (
          <div className="space-y-1">
            <input
              type="date"
              value={deadlineDate}
              onChange={(e) => { setDeadlineDate(e.target.value); setDeadlineError(""); }}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {(() => {
              const latest = lessonDeadlineDates
                .map((l) => l.deadline_date)
                .filter(Boolean)
                .sort()
                .at(-1);
              return latest ? <p className="text-xs text-gray-400">Latest lesson deadline: {latest}</p> : null;
            })()}
          </div>
        )}
        {deadlineError && <p className="text-xs text-red-500 font-medium mt-1">{deadlineError}</p>}
      </div>

      {/* Shuffled learning */}
      <div className="flex items-start gap-3 bg-gray-50 border rounded-xl p-4">
        <input
          type="checkbox"
          id="allow_shuffled"
          checked={allowShuffled}
          onChange={(e) => setAllowShuffled(e.target.checked)}
          className="w-4 h-4 mt-0.5"
        />
        <div>
          <label htmlFor="allow_shuffled" className="text-sm font-semibold text-gray-900 cursor-pointer">
            Allow shuffled learning
          </label>
          <p className="text-xs text-gray-500 mt-0.5">
            By default, learners must complete lessons in order. Enable this to let them jump between any lesson freely.
          </p>
        </div>
      </div>

      {/* Pre-submission AI feedback */}
      <div className="flex items-start gap-3 bg-brand-50 border border-brand-200 rounded-xl p-4">
        <input
          type="checkbox"
          id="pre_submission_ai"
          checked={preSubmissionAi}
          onChange={(e) => setPreSubmissionAi(e.target.checked)}
          className="w-4 h-4 mt-0.5"
        />
        <div>
          <label htmlFor="pre_submission_ai" className="text-sm font-semibold text-brand-900 cursor-pointer">
            ✦ Enable AI pre-submission feedback
          </label>
          <p className="text-xs text-brand-700 mt-0.5">
            Learners can ask AI to review their draft before submitting. Helps improve submission quality.
          </p>
        </div>
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
