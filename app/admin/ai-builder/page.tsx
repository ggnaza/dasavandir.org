import { cookies } from "next/headers";
import { tokenFromCookie } from "@/lib/google-drive";
import { AiBuilderClient } from "./ai-builder-client";

export const dynamic = "force-dynamic";

export default function AiBuilderPage({
  searchParams,
}: {
  searchParams: { drive?: string; drive_error?: string };
}) {
  const driveConnected = !!tokenFromCookie(cookies().get("google_drive_token")?.value);
  const justConnected = searchParams.drive === "1";
  const driveError = searchParams.drive_error === "1";

  return (
    <AiBuilderClient
      driveConnected={driveConnected}
      justConnected={justConnected}
      driveError={driveError}
    />
  );
}
