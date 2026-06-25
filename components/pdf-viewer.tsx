"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Worker is served as a static asset from /public (same-origin, CSP-safe).
// Kept in sync with the pdfjs-dist version via scripts/copy-pdf-worker.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // If react-pdf can't load the file (CORS, worker, etc.), fall back to the
  // browser's native PDF viewer so the slides are never blank.
  if (failed) {
    return (
      <div className="mb-6 w-full h-[80vh] max-h-[720px] rounded-xl overflow-hidden border bg-gray-50">
        <iframe src={`${url}#view=FitH`} className="w-full h-full" title="Document viewer" />
      </div>
    );
  }

  // At scale 1 the page exactly fits the container width (no horizontal scroll).
  const pageWidth = containerWidth ? Math.floor(containerWidth * scale) : undefined;
  const btn =
    "w-9 h-9 flex items-center justify-center rounded-lg border bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40";

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
          className={btn}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="text-xs text-gray-500 w-12 text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
          className={btn}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setScale(1)}
          className="px-3 h-9 rounded-lg border bg-white text-gray-700 hover:bg-gray-50 text-sm"
        >
          Fit
        </button>
      </div>

      <div
        ref={containerRef}
        className="w-full overflow-auto rounded-xl border bg-gray-100 max-h-[80vh]"
      >
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setFailed(true)}
          loading={<div className="p-8 text-center text-sm text-gray-500">Loading…</div>}
          error={<div className="p-8 text-center text-sm text-gray-500">Couldn’t load document.</div>}
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i}
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="mx-auto mb-2 shadow-sm"
            />
          ))}
        </Document>
      </div>
    </div>
  );
}
