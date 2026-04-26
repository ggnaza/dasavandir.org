import { PDFParse } from "pdf-parse";

export type LessonContext = {
  parts: string[];
  warnings: string[];
};

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchGoogleSlidesText(url: string): Promise<{ text: string | null; warning: string | null }> {
  try {
    const u = new URL(url);
    if (u.hostname !== "docs.google.com" || !u.pathname.includes("/presentation/d/")) {
      return { text: null, warning: null };
    }
  } catch {
    return { text: null, warning: null };
  }

  const match = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  const id = match?.[1];
  if (!id) return { text: null, warning: "Could not extract Google Slides ID from URL." };

  try {
    const exportUrl = `https://docs.google.com/presentation/d/${id}/export/txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(exportUrl, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        text: null,
        warning: `Google Slides could not be read (HTTP ${res.status}). The presentation may be private or restricted — share it as "Anyone with the link can view" for AI to read it.`,
      };
    }

    const text = res.text ? await res.text() : null;
    if (!text || !text.trim()) {
      return { text: null, warning: "Google Slides returned empty content." };
    }
    return { text: text.slice(0, 6000).trim(), warning: null };
  } catch {
    return {
      text: null,
      warning: "Google Slides could not be fetched (timeout or network error). AI generated based on other lesson content.",
    };
  }
}

async function fetchPdfText(url: string): Promise<{ text: string | null; warning: string | null }> {
  try {
    const parser = new PDFParse({ url });
    const result = await parser.getText();
    const text = result.text?.trim().slice(0, 5000);
    if (!text) return { text: null, warning: "PDF was empty or could not be parsed." };
    return { text, warning: null };
  } catch {
    return {
      text: null,
      warning: "PDF content could not be extracted. The file may be scanned/image-based or inaccessible. AI generated based on other lesson content.",
    };
  }
}

type LessonRow = {
  title: string;
  content?: string | null;
  slides_url?: string | null;
  video_url?: string | null;
  document_url?: string | null;
};

export async function buildLessonContext(lesson: LessonRow): Promise<LessonContext> {
  const parts: string[] = [];
  const warnings: string[] = [];

  parts.push(`Lesson title: ${lesson.title}`);

  if (lesson.content) {
    parts.push(`Lesson content:\n${htmlToText(lesson.content).slice(0, 4000)}`);
  }

  if (lesson.slides_url) {
    const { text, warning } = await fetchGoogleSlidesText(lesson.slides_url);
    if (text) {
      parts.push(`Presentation slides text:\n${text}`);
    } else {
      if (warning) warnings.push(warning);
      parts.push(`This lesson includes a presentation (content could not be read): ${lesson.slides_url}`);
    }
  }

  if (lesson.document_url) {
    const { text, warning } = await fetchPdfText(lesson.document_url);
    if (text) {
      parts.push(`Uploaded document text:\n${text}`);
    } else {
      if (warning) warnings.push(warning);
      parts.push(`This lesson includes an uploaded document (content could not be read).`);
    }
  }

  if (lesson.video_url) {
    parts.push(`This lesson also includes a video (AI cannot read video content): ${lesson.video_url}`);
  }

  return { parts, warnings };
}
