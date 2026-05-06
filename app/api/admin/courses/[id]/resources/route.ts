import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const runtime = "nodejs";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const GOOGLE_DOCS_RE = /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
const GOOGLE_SLIDES_RE = /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;

async function extractUrlText(url: string): Promise<string> {
  const docsMatch = url.match(GOOGLE_DOCS_RE);
  if (docsMatch) {
    try {
      const exportUrl = `https://docs.google.com/document/d/${docsMatch[1]}/export?format=txt`;
      const res = await fetch(exportUrl, { cache: "no-store" });
      if (res.ok) return (await res.text()).trim().slice(0, 20000);
    } catch {}
    return "";
  }

  const slidesMatch = url.match(GOOGLE_SLIDES_RE);
  if (slidesMatch) {
    try {
      const exportUrl = `https://docs.google.com/presentation/d/${slidesMatch[1]}/export/txt`;
      const res = await fetch(exportUrl, { cache: "no-store" });
      if (res.ok) return (await res.text()).trim().slice(0, 20000);
    } catch {}
    return "";
  }

  return "";
}

const addResourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("url"),
    title: z.string().min(1).max(200),
    url: z.string().url().max(2000),
  }),
  z.object({
    type: z.literal("file"),
    title: z.string().min(1).max(200),
    storagePath: z.string().max(500),
    fileName: z.string().max(300),
  }),
]);

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const { data } = await admin
    .from("course_resources")
    .select("id, title, url, file_name, storage_path, created_at")
    .eq("course_id", params.id)
    .order("created_at");

  return Response.json(data ?? []);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  // Verify course exists and user has access
  const { data: course } = await admin.from("courses").select("id, created_by").eq("id", params.id).single();
  if (!course) return new Response("Not found", { status: 404 });

  const parsed = addResourceSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const input = parsed.data;

  let url: string | null = null;
  let storagePath: string | null = null;
  let fileName: string | null = null;
  let extractedText = "";

  if (input.type === "url") {
    url = input.url;
    extractedText = await extractUrlText(url);
  } else {
    storagePath = input.storagePath;
    fileName = input.fileName;
    // Extract text from uploaded PDF via Supabase storage public URL
    try {
      const { data: urlData } = admin.storage.from("course-resources").getPublicUrl(storagePath);
      if (urlData?.publicUrl) {
        const res = await fetch(urlData.publicUrl);
        const buffer = Buffer.from(await res.arrayBuffer());
        const pdfParse = require("pdf-parse");
        const parsed = await pdfParse(buffer);
        extractedText = (parsed.text?.trim() ?? "").slice(0, 20000);
      }
    } catch { /* text extraction is best-effort */ }
  }

  const { data: resource, error } = await admin
    .from("course_resources")
    .insert({
      course_id: params.id,
      title: input.title,
      url,
      storage_path: storagePath,
      file_name: fileName,
      extracted_text: extractedText || null,
    })
    .select("id, title, url, file_name, storage_path, created_at")
    .single();

  if (error) return new Response("Failed to save resource", { status: 500 });
  return Response.json(resource);
}
