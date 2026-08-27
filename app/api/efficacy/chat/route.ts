import { getEfficacyUser, requireAuth } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import { generateContent } from "@/lib/efficacy/gemini";
import { z } from "zod";

const DEFAULT_PLAN_INSTRUCTIONS = "Դու փորձառու Դասավանդման Աջակցության Մասնագետ (ԴԱՄ) ես, որը քոուչինգ է անում ուսուցչին իր դասապլանի շուրջ։\nԽոսելու հերթականությունը՝\n1. Սկզբում ջերմ ողջունիր և կարճ ամփոփիր, թե ինչ դասապլան է ներկայացված (առարկա, թեմա, դասարան)։\n2. Նշիր դասապլանի 2-3 ուժեղ կողմ՝ կոնկրետ մեջբերումներով։\n3. Առաջարկիր 2-3 բարելավման ուղղություն՝ կառուցողական, օժանդակող տոնով, յուրաքանչյուրի համար գործնական քայլով։\n4. Ավարտիր 1-2 քոուչինգային հարցով, որոնք ուսուցչին կօգնեն ինքնուրույն մտածել։\nՊատասխանիր միայն հայերեն, կարճ պարբերություններով, առանց ավելորդ ձևականությունների։";

const DEFAULT_DELIVERY_INSTRUCTIONS = "Դու փորձառու ԱԶՂ/ԴԱՄ ես, որը ուսուցչի հետ քննարկում է իր վարած դասի AI գնահատումը։\nԽոսելու հերթականությունը՝\n1. Սկզբում կարճ ու դրական ամփոփիր դասի ընդհանուր պատկերը։\n2. Ներկայացրու ուժեղ կողմերը՝ գնահատումից կոնկրետ փաստերով։\n3. Ապա ներկայացրու բարելավման գոտիները՝ մեղմ, մոտիվացնող տոնով, գործնական առաջարկներով։\n4. Պատասխանիր ուսուցչի հարցերին՝ միշտ հենվելով գնահատման տվյալների վրա, և ավարտիր առաջ մղող հարցով։\nՊատասխանիր միայն հայերեն։";

async function getInstructions(kind: string): Promise<string> {
  const db = efficacyDb();
  const { data } = await db.from("chat_configs").select("instructions").eq("kind", kind).maybeSingle();
  const custom = (data?.instructions ?? "").trim();
  if (custom) return custom;
  return kind === "plan" ? DEFAULT_PLAN_INSTRUCTIONS : DEFAULT_DELIVERY_INSTRUCTIONS;
}

const createSchema = z.object({
  teacherId: z.string().uuid(),
  kind: z.enum(["plan", "delivery"]),
  planLink: z.string().url().optional(),
  evaluationId: z.string().uuid().optional(),
});

export async function GET() {
  const user = await getEfficacyUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const db = efficacyDb();
  const { data, error } = await db
    .from("chat_sessions")
    .select("id, kind, title, created_at")
    .or(`teacher_id.eq.${user!.id},created_by.eq.${user!.id}`)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { teacherId, kind, planLink, evaluationId } = parsed.data;
  const instructions = await getInstructions(kind);

  let opening: string;
  let extraFields: Record<string, unknown> = {};

  if (kind === "plan") {
    if (!planLink) return Response.json({ error: "planLink required for plan chat" }, { status: 400 });
    opening = await generateContent(
      instructions,
      [{ role: "user", parts: [{ text: "Provide initial feedback on this lesson plan following your instructions." }] }],
    );
    extraFields = { plan_link: planLink };
  } else {
    if (!evaluationId) return Response.json({ error: "evaluationId required for delivery chat" }, { status: 400 });
    const db2 = efficacyDb();
    const { data: evalData } = await db2.from("ai_evaluations").select("result").eq("id", evaluationId).maybeSingle();
    const evalSummary = JSON.stringify(evalData?.result ?? {}).slice(0, 20000);
    opening = await generateContent(
      instructions,
      [{ role: "user", parts: [{ text: evalSummary }] }],
    );
    extraFields = { evaluation_id: evaluationId };
  }

  const db = efficacyDb();
  const { data, error } = await db
    .from("chat_sessions")
    .insert({
      teacher_id: teacherId,
      created_by: user!.id,
      kind,
      title: kind === "plan" ? "Plan coaching" : "Lesson discussion",
      messages: [{ role: "ai", content: opening }],
      ...extraFields,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
