"use client";

export function PreviewVideoPlayer({ src }: { src: string }) {
  return (
    <div className="aspect-video mb-6 rounded-xl overflow-hidden bg-black">
      <video src={src} controls className="w-full h-full" controlsList="nodownload" />
    </div>
  );
}
