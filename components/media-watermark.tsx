// Faint identifying overlay for hosted media (video / slides).
//
// This is a DETERRENT + TRACEABILITY tool, not DRM: it does not stop a screen
// recording or a screenshot. What it does is stamp the viewer's identity across
// the frame, so any leaked capture traces back to the learner who leaked it.
// It is `pointer-events-none`, so it never blocks the underlying player controls.
//
// mix-blend-difference keeps the diagonal label visible over both dark video and
// light slide backgrounds; the corner tag carries its own chip so it is always legible.
export function MediaWatermark({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 select-none overflow-hidden"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rotate-[-24deg] whitespace-nowrap font-mono text-base tracking-wide text-white opacity-20 mix-blend-difference">
          {label}
        </span>
      </div>
      <div className="absolute bottom-1.5 right-2 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
        {label}
      </div>
    </div>
  );
}
