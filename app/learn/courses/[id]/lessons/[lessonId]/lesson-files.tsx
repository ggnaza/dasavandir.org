"use client";

type LessonFile = { id: string; file_name: string; storage_path: string };

export function LessonFiles({ files, bucketUrl }: { files: LessonFile[]; bucketUrl: string }) {
  if (!files.length) return null;

  return (
    <div className="bg-white border rounded-xl p-5 mb-6">
      <h3 className="font-medium text-sm mb-3">Attachments</h3>
      <ul className="space-y-2">
        {files.map((file) => (
          <li key={file.id}>
            <a
              href={`${bucketUrl}/${file.storage_path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-600 hover:underline"
            >
              📎 {file.file_name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
