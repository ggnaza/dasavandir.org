import { getGnahatumUser, requireAuth } from "@/lib/gnahatum/auth";
import { getAvailableModels, getCurrentModel, setCurrentModel } from "@/lib/gnahatum/models";
import { providerKeyStatus, PROVIDER_ENV_NAMES } from "@/lib/ai-keys";

export async function GET() {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  // providers is presence-only (booleans), so an operator can see which key is
  // missing without anyone having to read server logs. Never key material.
  return Response.json({
    current: getCurrentModel().id,
    models: getAvailableModels(),
    providers: providerKeyStatus(),
    providerEnvNames: PROVIDER_ENV_NAMES,
  });
}

export async function PUT(request: Request) {
  const user = await getGnahatumUser();
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
