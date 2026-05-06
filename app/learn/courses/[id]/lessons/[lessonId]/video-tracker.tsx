"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

type Props = {
  embedUrl: string;
  isYouTube: boolean;
  isStorageVideo?: boolean;
  lessonId: string;
  userId: string;
  isCompleted: boolean;
};

export function VideoTracker({ embedUrl, isYouTube, isStorageVideo, lessonId, userId, isCompleted }: Props) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const markedRef = useRef(isCompleted);
  const [marked, setMarked] = useState(isCompleted);
  const router = useRouter();

  // Native HTML5 video — mark complete at 50%
  useEffect(() => {
    if (!isStorageVideo || isCompleted) return;
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = async () => {
      if (markedRef.current) return;
      const { duration, currentTime } = video;
      if (!duration || currentTime / duration < 0.5) return;
      markedRef.current = true;
      setMarked(true);
      const supabase = createClient();
      await supabase.from("progress").upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: "user_id,lesson_id" });
      router.refresh();
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [isStorageVideo, isCompleted]);

  // YouTube IFrame API
  useEffect(() => {
    if (!isYouTube || isCompleted) return;

    function initPlayer() {
      if (!containerRef.current) return;
      const div = document.createElement("div");
      div.id = `yt-player-${lessonId}`;
      containerRef.current.appendChild(div);

      playerRef.current = new window.YT.Player(div.id, {
        videoId: extractYouTubeId(embedUrl),
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 0, modestbranding: 1 },
        events: { onStateChange: () => checkYTProgress() },
      });
    }

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.getElementById("yt-api-script")) {
        const s = document.createElement("script");
        s.id = "yt-api-script";
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
    }

    const interval = setInterval(checkYTProgress, 5000);
    return () => {
      clearInterval(interval);
      playerRef.current?.destroy?.();
    };
  }, []);

  async function checkYTProgress() {
    if (markedRef.current) return;
    const player = playerRef.current;
    if (!player?.getCurrentTime) return;
    const current = player.getCurrentTime();
    const duration = player.getDuration();
    if (!duration || current / duration < 0.5) return;
    markedRef.current = true;
    setMarked(true);
    const supabase = createClient();
    await supabase.from("progress").upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: "user_id,lesson_id" });
    router.refresh();
  }

  if (isStorageVideo) {
    return (
      <div className="mb-6">
        <div className="aspect-video rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            src={embedUrl}
            controls
            className="w-full h-full"
            controlsList="nodownload"
          />
        </div>
        {marked && !isCompleted && (
          <p className="text-xs text-green-600 mt-1">✓ Lesson marked complete — you watched over 50%</p>
        )}
      </div>
    );
  }

  if (!isYouTube) {
    return (
      <div className="aspect-video mb-6 rounded-xl overflow-hidden bg-black">
        <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div ref={containerRef} className="aspect-video rounded-xl overflow-hidden bg-black" />
      {marked && !isCompleted && (
        <p className="text-xs text-green-600 mt-1">✓ Lesson marked complete — you watched over 50%</p>
      )}
    </div>
  );
}

function extractYouTubeId(embedUrl: string): string {
  const match = embedUrl.match(/embed\/([^?]+)/);
  return match?.[1] ?? "";
}
