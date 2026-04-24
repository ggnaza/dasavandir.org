"use client";
import { useState, useEffect } from "react";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SUPPORTED = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.presentation",
  "text/plain",
  "application/pdf",
];

function fileIcon(mimeType: string) {
  if (mimeType === FOLDER_MIME) return "📁";
  if (mimeType.includes("document")) return "📄";
  if (mimeType.includes("presentation")) return "📊";
  if (mimeType.includes("pdf")) return "📕";
  return "📎";
}

interface Props {
  onExtract: (text: string) => void;
}

export function DriveBrowser({ onExtract }: Props) {
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([
    { id: "root", name: "My Drive" },
  ]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  const currentFolder = folderStack[folderStack.length - 1];

  useEffect(() => {
    loadFolder(currentFolder.id);
  }, [currentFolder.id]);

  async function loadFolder(folderId: string) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/drive/files?folderId=${folderId}`);
    if (!res.ok) { setError("Could not load folder."); setLoading(false); return; }
    const data = await res.json();
    setFiles(data.files);
    setSelected(new Set());
    setLoading(false);
  }

  function enterFolder(file: DriveFile) {
    setFolderStack([...folderStack, { id: file.id, name: file.name }]);
  }

  function goToLevel(index: number) {
    setFolderStack(folderStack.slice(0, index + 1));
  }

  function toggleSelect(fileId: string) {
    const next = new Set(selected);
    next.has(fileId) ? next.delete(fileId) : next.add(fileId);
    setSelected(next);
  }

  async function handleExtract() {
    if (!selected.size) return;
    setExtracting(true);
    setError("");
    const res = await fetch("/api/drive/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: Array.from(selected) }),
    });
    if (!res.ok) { setError(await res.text()); setExtracting(false); return; }
    const { text } = await res.json();
    onExtract(text);
    setExtracting(false);
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b px-4 py-2 flex items-center gap-1 text-sm flex-wrap">
        {folderStack.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-400">/</span>}
            <button
              onClick={() => goToLevel(i)}
              className={i === folderStack.length - 1 ? "font-medium text-gray-900" : "text-brand-600 hover:underline"}
            >
              {f.name}
            </button>
          </span>
        ))}
      </div>

      {/* File list */}
      <div className="divide-y max-h-72 overflow-y-auto">
        {loading && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
        )}
        {!loading && files.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">This folder is empty.</div>
        )}
        {!loading && files.map((file) => {
          const isFolder = file.mimeType === FOLDER_MIME;
          const isSupported = SUPPORTED.includes(file.mimeType);
          const isSelected = selected.has(file.id);

          return (
            <div
              key={file.id}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition ${!isFolder && !isSupported ? "opacity-40" : ""}`}
            >
              {!isFolder && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={!isSupported}
                  onChange={() => toggleSelect(file.id)}
                  className="w-4 h-4 shrink-0"
                />
              )}
              {isFolder && <div className="w-4 shrink-0" />}
              <span className="text-lg shrink-0">{fileIcon(file.mimeType)}</span>
              {isFolder ? (
                <button onClick={() => enterFolder(file)} className="text-sm text-brand-600 hover:underline text-left flex-1 truncate">
                  {file.name}
                </button>
              ) : (
                <span className="text-sm flex-1 truncate text-gray-800">{file.name}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t px-4 py-3 flex items-center justify-between gap-3">
        {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
        {!error && <p className="text-xs text-gray-400 flex-1">{selected.size} file{selected.size !== 1 ? "s" : ""} selected · Google Docs and text files supported</p>}
        <button
          onClick={handleExtract}
          disabled={!selected.size || extracting}
          className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 shrink-0"
        >
          {extracting ? "Extracting…" : "Use selected →"}
        </button>
      </div>
    </div>
  );
}
