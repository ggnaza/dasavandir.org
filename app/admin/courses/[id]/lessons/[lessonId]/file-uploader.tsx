"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LessonFile = { id: string; file_name: string; storage_path: string; signedUrl: string };

type Props = {
  lessonId: string;
  existingFiles: LessonFile[];
};

export function FileUploader({ lessonId, existingFiles }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LessonFile[]>(existingFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxMb = 20;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File too large. Max size is ${maxMb}MB.`);
      return;
    }

    setUploading(true);
    setError("");
    const supabase = createClient();

    // Request a signed upload URL from the server (service-role) so the upload
    // isn't blocked by the lesson-files bucket's missing browser INSERT policy.
    const urlRes = await fetch("/api/files/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id: lessonId, file_name: file.name }),
    });

    if (!urlRes.ok) {
      setError(await urlRes.text());
      setUploading(false);
      return;
    }

    const { path, token } = await urlRes.json();

    const { error: uploadError } = await supabase.storage
      .from("lesson-files")
      .uploadToSignedUrl(path, token, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const res = await fetch("/api/files/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id: lessonId, file_name: file.name, storage_path: path }),
    });

    if (!res.ok) {
      setError(await res.text());
      setUploading(false);
      return;
    }

    const newFile = await res.json();

    // Get a signed URL for the newly uploaded file
    const signedRes = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
    const signedData = signedRes.ok ? await signedRes.json() : { url: "" };

    setFiles((prev) => [...prev, { ...newFile, signedUrl: signedData.url }]);
    router.refresh();

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDelete(file: LessonFile) {
    if (!confirm(`Delete "${file.file_name}"?`)) return;

    // The API route removes both the DB row and the storage object (service-role).
    const res = await fetch("/api/files/record", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: file.id }),
    });

    if (!res.ok) {
      setError(`Could not delete file: ${await res.text()}`);
      return;
    }

    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    router.refresh();
  }

  return (
    <div className="bg-white border rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Attachments</h3>
        <label className="cursor-pointer text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium">
          {uploading ? "Uploading…" : "+ Upload file"}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      {files.length === 0 && (
        <p className="text-sm text-gray-400">No files attached yet.</p>
      )}

      <ul className="space-y-2">
        {files.map((file) => (
          <li key={file.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
            <a
              href={file.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline truncate max-w-xs"
            >
              📎 {file.file_name}
            </a>
            <button
              onClick={() => handleDelete(file)}
              className="text-red-400 hover:text-red-600 ml-3 shrink-0 text-xs"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
