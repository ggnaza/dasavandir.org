// Attestation invitation emails. Pure (no imports) so it can be unit tested with
// `node --test` (see lib/attestation-invite-email.test.ts).

const FROM = "Dasavandir <info@dasavandir.org>";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The email a teacher gets when invited to attestation tests.
 * - `newAccount`: the link sets their password and lands them on their tests.
 * - otherwise: the link is the tests page; they sign in as usual.
 */
export function attestationInviteEmail({
  to,
  subjects,
  url,
  newAccount,
}: {
  to: string;
  subjects: string[];
  url: string;
  newAccount: boolean;
}): { from: string; to: string; subject: string; html: string } {
  const list = subjects.map((s) => `<li style="margin:0 0 4px">${esc(s)}</li>`).join("");
  const action = newAccount
    ? "Սեղմեք ստորև՝ գաղտնաբառ ստեղծելու համար։ Դրանից հետո կտեսնեք Ձեր թեստերը և կարող եք սկսել։"
    : "Մուտք գործեք dasavandir.org Ձեր հաշվով. Ձեր թեստերը կլինեն «Attestation» բաժնում։";
  const button = newAccount ? "Ստեղծել գաղտնաբառ և սկսել →" : "Բացել թեստերը →";
  const note = newAccount
    ? "Հղումը միանգամյա է և ժամանակավոր։ Եթե այն չաշխատի, խնդրեք համակարգողին կրկին ուղարկել հրավերը։"
    : "Եթե մոռացել եք գաղտնաբառը, մուտքի էջում ընտրեք «Forgot password?»։";
  return {
    from: FROM,
    to,
    subject: "Հրավեր՝ կամավոր ատեստավորման թեստերի | dasavandir.org",
    html: `<!DOCTYPE html>
<html lang="hy">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <tr><td style="background:#EC5328;padding:32px 40px">
          <p style="margin:0;color:#fff;font-size:22px;font-weight:700">Dasavandir<span style="font-weight:400;opacity:0.7">.org</span></p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827">Կամավոր ատեստավորման թեստեր</h1>
          <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Բարև Ձեզ,</p>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6">Դուք հրավիրված եք հանձնելու հետևյալ թեստ(եր)ը՝</p>
          <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#111827;line-height:1.6">${list}</ul>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">${action}</p>
          <a href="${esc(url)}" style="display:inline-block;background:#EC5328;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">${button}</a>
          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6">Ձեր հաշիվը՝ ${esc(to)}։ ${note}</p>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #f0f0f0">
          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">Teach For Armenia · <a href="https://dasavandir.org" style="color:#EC5328;text-decoration:none">dasavandir.org</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

/** A same-site path to continue to, or null. Blocks `//host` and `/\host` open redirects. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
