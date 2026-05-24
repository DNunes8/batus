import { studio } from "@/lib/studio.config";

// Thin Resend wrapper. We POST to the Resend HTTP API directly — no SDK
// dependency to carry through the hand-off. Every send is best-effort:
// if the keys aren't configured yet (pre-Resend-setup) or the call fails,
// we log and return. Sending email must NEVER break the booking/auth flow
// that triggered it.
//
// Config (Vercel env): RESEND_API_KEY + RESEND_FROM (e.g.
// "Batus <noreply@batusboxe.com>" — must be on a domain verified in Resend).

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  // Plain-text alternative. Always pass it: multipart text+html mail is
  // less likely to be flagged as spam than html-only.
  text?: string;
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    console.warn(
      `[email] skipped "${subject}" — RESEND_API_KEY/RESEND_FROM not set`,
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      console.error(`[email] Resend ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Sent when a waitlisted student is auto-promoted into a class (a booked
// spot freed up). They won't be refreshing the app, so this is how they
// find out they're in.
export async function sendWaitlistPromotionEmail(args: {
  to: string;
  studentName: string | null;
  className: string;
  dateLabel: string;
  timeLabel: string;
  perfilUrl: string;
}): Promise<void> {
  const { to, studentName, className, dateLabel, timeLabel, perfilUrl } = args;
  const firstName = studentName?.trim().split(" ")[0] || "Olá";

  const subject = `Tens vaga na aula de ${className}`;

  const text = [
    "Tens vaga!",
    "",
    `${firstName}, abriu uma vaga e entraste nesta aula:`,
    "",
    `${className}`,
    `${dateLabel} · ${timeLabel}`,
    "",
    "Já estás confirmado. Se não puderes ir, cancela a marcação para libertar o lugar para o próximo da lista.",
    "",
    `Ver a tua marcação: ${perfilUrl}`,
    "",
    `${studio.fullName} · ${studio.city}`,
  ].join("\n");

  const html = `
  <div style="background:#f4f4f5;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
      <div style="background:#111111;padding:18px 24px">
        <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:3px">
          ${escapeHtml(studio.name.toUpperCase())}
        </p>
      </div>
      <div style="padding:24px">
        <h1 style="font-size:20px;margin:0 0 16px;color:#111111">Tens vaga!</h1>
        <p style="font-size:15px;line-height:1.5;margin:0 0 16px;color:#333333">
          ${escapeHtml(firstName)}, abriu uma vaga e <strong>entraste</strong> nesta aula:
        </p>
        <div style="border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:0 0 16px">
          <p style="font-size:16px;font-weight:600;margin:0 0 4px;color:#111111">
            ${escapeHtml(className)}
          </p>
          <p style="font-size:14px;color:#666666;margin:0">
            ${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}
          </p>
        </div>
        <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:#333333">
          Já estás confirmado. Se não puderes ir, cancela a marcação para
          libertar o lugar para o próximo da lista.
        </p>
        <a href="${perfilUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
          Ver a minha marcação
        </a>
      </div>
      <div style="border-top:1px solid #eeeeee;padding:16px 24px">
        <p style="font-size:12px;color:#999999;margin:0">
          ${escapeHtml(studio.fullName)} · ${escapeHtml(studio.city)}
        </p>
      </div>
    </div>
  </div>`;

  await sendEmail({ to, subject, html, text });
}
