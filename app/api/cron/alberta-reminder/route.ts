import { Resend } from "resend";

const LAUNCH_DATE = new Date("2026-06-17T00:00:00+04:00"); // Armenia time
const RECIPIENT = "alberta@teachforarmenia.org";
const FROM = "Dasavandir <info@dasavandir.org>";
// First email: Monday June 9 — skip any earlier run
const FIRST_SEND = new Date("2026-06-09T00:00:00+04:00");

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const nowArmenia = new Date(Date.now() + 4 * 60 * 60 * 1000);

  // Don't send before Monday June 9
  if (nowArmenia < FIRST_SEND) {
    return Response.json({ skipped: "before first send date" });
  }

  // Stop after launch day
  if (nowArmenia >= LAUNCH_DATE) {
    return Response.json({ skipped: "launch date reached" });
  }

  const msLeft = LAUNCH_DATE.getTime() - nowArmenia.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  const subject =
    daysLeft === 1
      ? "⚡ Tomorrow is launch day — Teacher Leadership Academy"
      : `📅 ${daysLeft} days until Teacher Leadership Academy launches`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#1d4ed8;padding:32px 40px;text-align:center">
            <p style="margin:0;font-size:13px;color:#bfdbfe;letter-spacing:0.05em;text-transform:uppercase">Dasavandir · Daily reminder</p>
            <p style="margin:12px 0 0;font-size:48px;font-weight:800;color:#ffffff;line-height:1">${daysLeft}</p>
            <p style="margin:4px 0 0;font-size:16px;color:#bfdbfe">${daysLeft === 1 ? "day to go" : "days to go"}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px">
            <p style="margin:0;font-size:18px;font-weight:700;color:#111827">Good morning, Alberta!</p>
            <p style="margin:12px 0 0;font-size:15px;color:#374151;line-height:1.6">
              <strong>Teacher Leadership Academy</strong> launches on <strong>June 17</strong> — that's ${daysLeft} ${daysLeft === 1 ? "day" : "days"} away.
            </p>
            <p style="margin:16px 0 0;font-size:15px;color:#374151;line-height:1.6">
              Please take a few minutes today to check that everything is ready and tested on the platform:
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%">
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#374151">☐ &nbsp;All lessons are published and in order</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#374151">☐ &nbsp;Videos, slides, and documents load correctly</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#374151">☐ &nbsp;Quizzes and assignments work end-to-end</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#374151">☐ &nbsp;Learners are enrolled and can access the course</td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin:28px 0 0">
              <tr>
                <td style="background:#1d4ed8;border-radius:8px;padding:14px 28px">
                  <a href="https://dasavandir.org/admin/courses" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">
                    Open Dasavandir →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
              You're receiving this daily until June 17. Dasavandir · Teacher Leadership Academy
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM, to: RECIPIENT, subject, html });

  if (error) {
    console.error("[alberta-reminder]", error);
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ sent: true, daysLeft, to: RECIPIENT });
}
