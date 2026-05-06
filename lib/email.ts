import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Dasavandir <info@dasavandir.org>";

export async function sendInvitationEmail({
  to,
  firstName,
  courseTitle,
  signupUrl,
}: {
  to: string;
  firstName: string;
  courseTitle: string;
  signupUrl: string;
}) {
  const name = firstName || "there";
  return resend.emails.send({
    from: FROM,
    to,
    subject: `You're invited to "${courseTitle}"`,
    html: invitationHtml({ name, courseTitle, signupUrl, email: to }),
  });
}

export async function sendInviteLinkEmail({
  to,
  fullName,
  inviteUrl,
}: {
  to: string;
  fullName: string;
  inviteUrl: string;
}) {
  const name = fullName || "there";
  return resend.emails.send({
    from: FROM,
    to,
    subject: "You've been invited to Dasavandir",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#EC5328;padding:32px 40px">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px">Դasavandir<span style="font-weight:400;opacity:0.7">.org</span></p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">Welcome to Dasavandir!</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Hi ${esc(name)},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
              You've been invited to join Dasavandir. Click the button below to set your password and activate your account.
            </p>
            <a href="${inviteUrl}"
               style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.1px">
              Set my password →
            </a>
            <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">This link expires in 24 hours.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0">
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">
              Built by <a href="https://dasavandir.org" style="color:#EC5328;text-decoration:none">Teach For Armenia</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendNewLessonEmail({
  to,
  firstName,
  lessonTitle,
  courseTitle,
  lessonUrl,
}: {
  to: string;
  firstName: string;
  lessonTitle: string;
  courseTitle: string;
  lessonUrl: string;
}) {
  const name = firstName || "there";
  return resend.emails.send({
    from: FROM,
    to,
    subject: `New lesson available: "${lessonTitle}"`,
    html: reminderHtml({
      name,
      lessonTitle,
      courseTitle,
      lessonUrl,
      headline: "New lesson available!",
      bodyText: `A new lesson has been added to <strong style="color:#111827">${esc(courseTitle)}</strong>. Jump in and start learning.`,
      ctaLabel: "Open lesson →",
    }),
  });
}

export async function sendLessonReminderEmail({
  to,
  firstName,
  lessonTitle,
  courseTitle,
  lessonUrl,
  reminderType,
  customSubject,
  customMessage,
}: {
  to: string;
  firstName: string;
  lessonTitle: string;
  courseTitle: string;
  lessonUrl: string;
  reminderType: "not_started" | "not_completed" | "custom";
  customSubject?: string | null;
  customMessage?: string | null;
}) {
  const name = firstName || "there";
  const subject =
    customSubject ||
    (reminderType === "not_started"
      ? `Don't forget to start: "${lessonTitle}"`
      : reminderType === "not_completed"
      ? `Still time to finish: "${lessonTitle}"`
      : `Reminder: "${lessonTitle}"`);

  const bodyText =
    customMessage ||
    (reminderType === "not_started"
      ? `You haven't started <strong style="color:#111827">${esc(lessonTitle)}</strong> yet in <strong style="color:#111827">${esc(courseTitle)}</strong>. Pick up where you left off.`
      : reminderType === "not_completed"
      ? `You started <strong style="color:#111827">${esc(lessonTitle)}</strong> in <strong style="color:#111827">${esc(courseTitle)}</strong> but haven't finished yet. You're almost there!`
      : `This is a reminder about <strong style="color:#111827">${esc(lessonTitle)}</strong> in <strong style="color:#111827">${esc(courseTitle)}</strong>.`);

  const headline =
    reminderType === "not_started"
      ? "Ready to start?"
      : reminderType === "not_completed"
      ? "Almost finished!"
      : "A reminder for you";

  return resend.emails.send({
    from: FROM,
    to,
    subject,
    html: reminderHtml({ name, lessonTitle, courseTitle, lessonUrl, headline, bodyText, ctaLabel: "Go to lesson →" }),
  });
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function reminderHtml({
  name,
  lessonTitle,
  courseTitle: _courseTitle,
  lessonUrl,
  headline,
  bodyText,
  ctaLabel,
}: {
  name: string;
  lessonTitle: string;
  courseTitle: string;
  lessonUrl: string;
  headline: string;
  bodyText: string;
  ctaLabel: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#EC5328;padding:32px 40px">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px">Դasavandir<span style="font-weight:400;opacity:0.7">.org</span></p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">${esc(headline)}</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Hi ${esc(name)},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">${bodyText}</p>
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Lesson</p>
            <p style="margin:0 0 24px;font-size:16px;font-weight:600;color:#111827">${esc(lessonTitle)}</p>
            <a href="${lessonUrl}"
               style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.1px">
              ${esc(ctaLabel)}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0">
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">
              Built by <a href="https://dasavandir.org" style="color:#EC5328;text-decoration:none">Teach For Armenia</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function invitationHtml({
  name,
  courseTitle,
  signupUrl,
  email,
}: {
  name: string;
  courseTitle: string;
  signupUrl: string;
  email: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#EC5328;padding:32px 40px">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px">Դasavandir<span style="font-weight:400;opacity:0.7">.org</span></p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">You've been invited!</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Hi ${esc(name)},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
              You have been invited to enroll in <strong style="color:#111827">${esc(courseTitle)}</strong>.
              Create your free account to start learning.
            </p>
            <a href="${signupUrl}"
               style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.1px">
              Accept invitation →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0">
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">
              After signing up with <strong>${esc(email)}</strong> you will be automatically enrolled in the course.<br>
              Built by <a href="https://dasavandir.org" style="color:#EC5328;text-decoration:none">Teach For Armenia</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
