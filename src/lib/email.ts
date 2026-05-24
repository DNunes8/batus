import { studio } from "@/lib/studio.config";

// Thin Resend wrapper. We POST to the Resend HTTP API directly — no SDK
// dependency to carry through the hand-off. Every send is best-effort:
// if the keys aren't configured yet (pre-Resend-setup) or the call fails,
// we log and return. Sending email must NEVER break the booking/auth flow
// that triggered it.
//
// Config (Vercel env): RESEND_API_KEY + RESEND_FROM (e.g.
// "Batus <ola@batusboxe.com>" — must be on a domain verified in Resend).

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendArgs): Promise<void> {
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
      body: JSON.stringify({ from, to, subject, html }),
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
  const first = studentName?.trim().split(" ")[0];
  const hi = first ? escapeHtml(first) : "Olá";
  const cls = escapeHtml(className);

  const subject = `Tens vaga na aula de ${className}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <h1 style="font-size:20px;margin:0 0 16px">Tens vaga!</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px">
      ${hi}, abriu uma vaga e <strong>entraste</strong> nesta aula:
    </p>
    <div style="border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:0 0 16px">
      <p style="font-size:16px;font-weight:600;margin:0 0 4px">${cls}</p>
      <p style="font-size:14px;color:#555;margin:0">${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</p>
    </div>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px">
      Já estás confirmado. Se não puderes ir, cancela a marcação para libertar
      o lugar para o próximo da lista.
    </p>
    <a href="${perfilUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px">
      Ver a minha marcação
    </a>
    <p style="font-size:12px;color:#999;margin:28px 0 0">${escapeHtml(studio.name)}</p>
  </div>`;

  await sendEmail({ to, subject, html });
}
