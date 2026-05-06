"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Resource = {
  id: string;
  title: string;
  url: string | null;
  file_name: string | null;
  storage_path: string | null;
  created_at: string;
};

export function CourseResources({ courseId }: { courseId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [addMode, setAddMode] = useState<"url" | "file" | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/courses/${courseId}/resources`)
      .then((r) => r.json())
      .then(setResources)
      .catch(() => {});
  }, [courseId]);

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(`/api/admin/courses/${courseId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "url", title, url }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const resource = await res.json();
    setResources((prev) => [...prev, resource]);
    setAddMode(null);
    setTitle("");
    setUrl("");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError("Max file size is 20MB.");
      return;
    }
    setError("");
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const storagePath = `${courseId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("course-resources")
      .upload(storagePath, file);
    setUploading(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/courses/${courseId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "file",
        title: title || file.name.replace(/\.[^.]+$/, ""),
        storagePath,
        fileName: file.name,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const resource = await res.json();
    setResources((prev) => [...prev, resource]);
    setAddMode(null);
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(resourceId: string) {
    if (!confirm("Remove this resource?")) return;
    await fetch(`/api/admin/courses/${courseId}/resources/${resourceId}`, { method: "DELETE" });
    setResources((prev) => prev.filter((r) => r.id !== resourceId));
  }

  function cancel() {
    setAddMode(null);
    setTitle("");
    setUrl("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="border rounded-xl p-5 bg-brand-50 border-brand-200 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-brand-900">✦ AI Coach Learning Resources</h3>
        <p className="text-xs text-brand-700 mt-0.5">
          Add Google Drive links or upload files (PDF, etc.) that the AI coach will use to better support learners in this course.
        </p>
      </div>

      {resources.length > 0 && (
        <ul className="space-y-2">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2 text-sm">
              <span className="text-base">{r.url ? "🔗" : "📄"}</span>
              <span className="flex-1 truncate font-medium text-gray-800">{r.title}</span>
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:underline shrink-0"
                >
                  Open
                </a>
              )}
              {r.file_name && (
                <span className="text-xs text-gray-400 shrink-0">{r.file_name}</span>
              )}
              <button
                onClick={() => handleDelete(r.id)}
                className="text-gray-400 hover:text-red-500 text-lg leading-none shrink-0"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {addMode === null && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAddMode("url")}
            className="text-xs bg-white border border-brand-300 text-brand-700 hover:bg-brand-100 px-3 py-1.5 rounded-lg font-medium"
          >
            + Add Google Drive link
          </button>
          <button
            type="button"
            onClick={() => setAddMode("file")}
            className="text-xs bg-white border border-brand-300 text-brand-700 hover:bg-brand-100 px-3 py-1.5 rounded-lg font-medium"
          >
            + Upload file
          </button>
        </div>
      )}

      {addMode === "url" && (
        <form onSubmit={handleAddUrl} className="bg-white border rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Course Handbook"
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Google Drive / Docs / Slides URL</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/..."
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Google Docs and Slides text is extracted automatically. Make sure sharing is set to "Anyone with the link can view".
            </p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
            >
              {saving ? "Saving…" : "Save link"}
            </button>
            <button type="button" onClick={cancel} className="text-xs text-gray-500 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {addMode === "file" && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Title (optional — defaults to filename)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reference Manual"
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">File</label>
            <label className="cursor-pointer inline-flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium">
              {uploading ? "Uploading…" : saving ? "Extracting text…" : "Choose file"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading || saving}
              />
            </label>
            <p className="text-xs text-gray-400 mt-1">PDF · max 20MB. Text is extracted automatically for the AI coach.</p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="button" onClick={cancel} className="text-xs text-gray-500 hover:underline">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
