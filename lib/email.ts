import { Resend } from "resend";

// Lazy-initialize so the constructor doesn't run at module load during Next.js build
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "Dasavandir <info@dasavandir.org>";

export async function sendActivationEmail({
  to,
  fullName,
  activationUrl,
}: {
  to: string;
  fullName: string;
  activationUrl: string;
}) {
  const name = fullName || "there";
  return getResend().emails.send({
    from: FROM,
    to,
    subject: "Activate your Dasavandir account",
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
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">Activate your account</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Hi ${esc(name)},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
              Welcome to Dasavandir! Click the button below to activate your account and confirm your email address.
            </p>
            <a href="${activationUrl}"
               style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.1px">
              Activate my account →
            </a>
            <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>
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
  return getResend().emails.send({
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
  return getResend().emails.send({
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

export async function sendEnrollmentEmail({
  to,
  firstName,
  courseTitle,
  courseUrl,
}: {
  to: string;
  firstName: string;
  courseTitle: string;
  courseUrl: string;
}) {
  const name = firstName || "there";
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `You've been enrolled in "${courseTitle}"`,
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
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">You're enrolled!</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Hi ${esc(name)},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
              You have been enrolled in <strong style="color:#111827">${esc(courseTitle)}</strong>. Click below to start learning.
            </p>
            <a href="${esc(courseUrl)}"
               style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.1px">
              Go to course →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0">
            <p style="margin:0;font-size:13px;color:#9ca3af;">Built by <a href="https://dasavandir.org" style="color:#EC5328;text-decoration:none">Teach For Armenia</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendModeratorAddedEmail({
  to,
  fullName,
  courseTitle,
  courseUrl,
}: {
  to: string;
  fullName: string;
  courseTitle: string;
  courseUrl: string;
}) {
  const name = fullName || "there";
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `You've been added as a moderator for "${courseTitle}"`,
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
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">You're now a moderator!</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Hi ${esc(name)},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
              You've been added as a moderator for <strong style="color:#111827">${esc(courseTitle)}</strong>.
              You can now manage the course content, discussions, and learners.
            </p>
            <a href="${esc(courseUrl)}"
               style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.1px">
              Go to course →
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
  return getResend().emails.send({
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

  return getResend().emails.send({
    from: FROM,
    to,
    subject,
    html: reminderHtml({ name, lessonTitle, courseTitle, lessonUrl, headline, bodyText, ctaLabel: "Go to lesson →" }),
  });
}

export async function sendAnnouncementEmail({
  to,
  firstName,
  announcementTitle,
  announcementBody,
  courseTitle,
  announcementsUrl,
}: {
  to: string;
  firstName: string;
  announcementTitle: string;
  announcementBody: string;
  courseTitle: string;
  announcementsUrl: string;
}) {
  const name = firstName || "there";
  const preview = announcementBody.length > 200 ? announcementBody.slice(0, 200) + "…" : announcementBody;
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `📢 ${announcementTitle} — ${courseTitle}`,
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
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#EC5328;text-transform:uppercase;letter-spacing:0.06em">📢 Announcement · ${esc(courseTitle)}</p>
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">${esc(announcementTitle)}</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Hi ${esc(name)},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;white-space:pre-wrap">${esc(preview)}</p>
            <a href="${announcementsUrl}"
               style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.1px">
              View announcement →
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
</html>`,
  });
}

export async function sendSubmissionVerdictEmail({
  to,
  firstName,
  assignmentTitle,
  courseTitle,
  verdict,
  instructorNote,
  assignmentUrl,
}: {
  to: string;
  firstName: string;
  assignmentTitle: string;
  courseTitle: string;
  verdict: "approved" | "needs_revision" | "not_approved";
  instructorNote?: string | null;
  assignmentUrl: string;
}) {
  const name = firstName || "there";

  const configs = {
    approved: {
      subject: `✓ Submission approved — "${assignmentTitle}"`,
      headerBg: "#16a34a",
      icon: "✓",
      headline: "Your submission was approved!",
      body: `Great work! Your submission for <strong style="color:#111827">${esc(assignmentTitle)}</strong> in <strong style="color:#111827">${esc(courseTitle)}</strong> has been reviewed and approved.`,
      ctaLabel: "View feedback →",
      noteLabel: "Note from your facilitator",
      noteBg: "#f0fdf4",
      noteBorder: "#86efac",
      noteColor: "#166534",
    },
    needs_revision: {
      subject: `↩ Revision needed — "${assignmentTitle}"`,
      headerBg: "#d97706",
      icon: "↩",
      headline: "Your submission needs revision",
      body: `Your submission for <strong style="color:#111827">${esc(assignmentTitle)}</strong> in <strong style="color:#111827">${esc(courseTitle)}</strong> has been reviewed. Please read the note below and resubmit.`,
      ctaLabel: "Revise and resubmit →",
      noteLabel: "What to revise (from your facilitator)",
      noteBg: "#fffbeb",
      noteBorder: "#fcd34d",
      noteColor: "#92400e",
    },
    not_approved: {
      subject: `✕ Submission not approved — "${assignmentTitle}"`,
      headerBg: "#dc2626",
      icon: "✕",
      headline: "Submission not approved",
      body: `Your submission for <strong style="color:#111827">${esc(assignmentTitle)}</strong> in <strong style="color:#111827">${esc(courseTitle)}</strong> has been reviewed. Please read the feedback below.`,
      ctaLabel: "View details →",
      noteLabel: "Feedback from your facilitator",
      noteBg: "#fef2f2",
      noteBorder: "#fca5a5",
      noteColor: "#991b1b",
    },
  };

  const cfg = configs[verdict];
  const noteHtml = instructorNote
    ? `<div style="margin:16px 0 0;background:${cfg.noteBg};border:1px solid ${cfg.noteBorder};border-radius:8px;padding:14px 18px">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${cfg.noteColor};text-transform:uppercase;letter-spacing:0.05em">${cfg.noteLabel}</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;white-space:pre-wrap">${esc(instructorNote)}</p>
      </div>`
    : "";

  return getResend().emails.send({
    from: FROM,
    to,
    subject: cfg.subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:${cfg.headerBg};padding:32px 40px">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px">Դasavandir<span style="font-weight:400;opacity:0.7">.org</span></p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px">
            <p style="margin:0 0 6px;font-size:28px">${cfg.icon}</p>
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">${cfg.headline}</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Hi ${esc(name)},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6">${cfg.body}</p>
            ${noteHtml}
            <div style="margin-top:28px">
              <a href="${esc(assignmentUrl)}"
                 style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.1px">
                ${cfg.ctaLabel}
              </a>
            </div>
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

export async function sendDirectMessageEmail({
  to,
  learnerName,
  fromName,
  subject,
  message,
  notificationsUrl,
}: {
  to: string;
  learnerName: string;
  fromName: string;
  subject: string;
  message: string;
  notificationsUrl: string;
}) {
  const name = learnerName || "there";
  const preview = message.length > 600 ? message.slice(0, 600) + "…" : message;
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `💬 ${subject}`,
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
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#EC5328;text-transform:uppercase;letter-spacing:0.06em">💬 Message from your facilitator</p>
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827">${esc(subject)}</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Hi ${esc(name)},</p>
            <p style="margin:0 0 6px;font-size:13px;color:#6b7280">From: <strong style="color:#111827">${esc(fromName)}</strong></p>
            <div style="margin:16px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px 24px">
              <p style="margin:0;font-size:15px;color:#111827;line-height:1.7;white-space:pre-wrap">${esc(preview)}</p>
            </div>
            <a href="${esc(notificationsUrl)}"
               style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.1px">
              View in Dasavandir →
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
</html>`,
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

// Simple branded email shell used by the reviewer emails.
function reviewShell(headline: string, bodyHtml: string, ctaLabel: string, ctaUrl: string) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
      <tr><td style="background:#EC5328;padding:20px 28px;color:#fff;font-size:18px;font-weight:700">Dasavandir</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-size:18px;color:#111827">${esc(headline)}</h1>
        <div style="font-size:14px;line-height:1.6;color:#374151">${bodyHtml}</div>
        <div style="margin:24px 0 4px">
          <a href="${ctaUrl}" style="display:inline-block;background:#EC5328;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:10px">${esc(ctaLabel)}</a>
        </div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// Sent to a group moderator when a learner in their group submits an assignment.
export async function sendReviewNeededEmail({
  to, reviewerName, learnerName, assignmentTitle, courseTitle, reviewUrl,
}: {
  to: string; reviewerName: string; learnerName: string;
  assignmentTitle: string; courseTitle: string; reviewUrl: string;
}) {
  const body = `Hi ${esc(reviewerName || "there")},<br><br>
    <strong style="color:#111827">${esc(learnerName)}</strong> just submitted
    <strong style="color:#111827">${esc(assignmentTitle)}</strong> in
    <strong style="color:#111827">${esc(courseTitle)}</strong>. It's waiting for your review.`;
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `New submission to review — "${assignmentTitle}"`,
    html: reviewShell("A submission is waiting for your review", body, "Review submission →", reviewUrl),
  });
}

// Daily digest reminder to a moderator with un-reviewed submissions.
export async function sendReviewReminderEmail({
  to, reviewerName, pendingCount, reviewUrl,
}: {
  to: string; reviewerName: string; pendingCount: number; reviewUrl: string;
}) {
  const body = `Hi ${esc(reviewerName || "there")},<br><br>
    You have <strong style="color:#111827">${pendingCount} submission${pendingCount === 1 ? "" : "s"}</strong>
    waiting for your review. Learners are waiting on your feedback.`;
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `${pendingCount} submission${pendingCount === 1 ? "" : "s"} waiting for your review`,
    html: reviewShell("Reminder: submissions awaiting your review", body, "Review now →", reviewUrl),
  });
}
