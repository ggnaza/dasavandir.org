import { getArarkaUser, requireAuth } from "@/lib/ararka/auth";
import { getAvailableModels, getCurrentModel, setCurrentModel } from "@/lib/ararka/models";

export async function GET() {
  const user = await getArarkaUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  return Response.json({
    current: getCurrentModel().id,
    models: getAvailableModels(),
  });
}

export async function PUT(request: Request) {
  const user = await getArarkaUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const { model_id } = (await request.json()) as { model_id: string };
  if (!model_id) {
    return Response.json({ error: "model_id is required" }, { status: 400 });
  }

  const available = getAvailableModels();
  if (!available.find((m) => m.id === model_id)) {
    return Response.json({ error: "Model not available (missing API key?)" }, { status: 400 });
  }

  setCurrentModel(model_id);
  return Response.json({ current: model_id });
}
