"use client";
import dynamic from "next/dynamic";

const LessonContentEditorInner = dynamic(
  () => import("./lesson-content-editor").then((m) => m.LessonContentEditor),
  {
    ssr: false,
    loading: () => (
      <div className="border rounded-xl h-48 bg-white animate-pulse flex items-center justify-center text-sm text-gray-400">
        Loading editor…
      </div>
    ),
  }
);

type Props = { value: string; onChange: (val: string) => void };

export function LessonContentEditor({ value, onChange }: Props) {
  return <LessonContentEditorInner value={value} onChange={onChange} />;
}
