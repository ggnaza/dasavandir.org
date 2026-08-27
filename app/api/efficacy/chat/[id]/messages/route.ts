import { getEfficacyUser, requireAuth } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import { generateContent } from "@/lib/efficacy/gemini";
import { z } from "zod";

const messageSchema = z.object({
  text: z.string().min(1).max(8000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const parsed = messageSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const db = efficacyDb();
  const { data: session } = await db
    .from("chat_sessions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!session) return Response.json({ error: "Chat not found" }, { status: 404 });
  if (session.teacher_id !== user!.id && session.created_by !== user!.id && user!.role !== "admin")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  // Get system instructions
  const { data: config } = await db
    .from("chat_configs")
    .select("instructions")
    .eq("kind", session.kind)
    .maybeSingle();
  const instructions = (config?.instructions ?? "").trim() || "You are a teaching coach. Respond in Armenian.";

  // Build conversation history (last 20 messages + new user message)
  const messages: { role: string; content: string }[] = session.messages ?? [];
  const contents = messages.slice(-20).map((m: { role: string; content: string }) => ({
    role: m.role === "ai" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: parsed.data.text }] });

  const reply = await generateContent(instructions, contents);

  const updatedMessages = [
    ...messages,
    { role: "user", content: parsed.data.text.slice(0, 8000) },
    { role: "ai", content: reply },
  ];

  const { data, error } = await db
    .from("chat_sessions")
    .update({ messages: updatedMessages })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ reply, session: data });
}
