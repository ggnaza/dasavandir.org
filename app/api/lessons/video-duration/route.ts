function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(req: Request) {
  const { videoUrl } = await req.json();
  if (!videoUrl) return new Response("Missing videoUrl", { status: 400 });

  const fileId = extractDriveFileId(videoUrl);
  if (!fileId) return Response.json({ duration_seconds: null });

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return Response.json({ duration_seconds: null });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=videoMediaMetadata&key=${apiKey}`
  );
  if (!res.ok) return Response.json({ duration_seconds: null });

  const data = await res.json();
  const ms = data.videoMediaMetadata?.durationMillis;
  const duration_seconds = ms ? Math.round(Number(ms) / 1000) : null;

  return Response.json({ duration_seconds });
}
