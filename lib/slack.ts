const WEBHOOK_URL = process.env.SLACK_ANNOUNCEMENTS_WEBHOOK_URL;

export async function postAnnouncementToSlack({
  courseTitle,
  title,
  body,
  authorName,
  url,
}: {
  courseTitle: string;
  title: string;
  body: string;
  authorName?: string;
  url?: string;
}) {
  if (!WEBHOOK_URL) return; // silently skip if not configured

  const preview = body.length > 300 ? body.slice(0, 300) + "…" : body;
  const footer = authorName ? `Posted by ${authorName} in *${courseTitle}*` : `*${courseTitle}*`;

  const payload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📢 *${title}*\n${preview}`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: footer },
          ...(url ? [{ type: "mrkdwn", text: `<${url}|View announcement>` }] : []),
        ],
      },
    ],
  };

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[slack/announcement]", err);
  }
}
