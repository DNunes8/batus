import { studio } from "@/lib/studio.config";

// Thin Resend wrapper + the app's transactional emails. We POST to the
// Resend HTTP API directly — no SDK dependency to carry through the hand-off.
// Every send is best-effort: if the keys aren't set (pre-Resend-setup) or the
// call fails, we log and return. Sending email must NEVER break the flow that
// triggered it.
//
// Look matches supabase/email-templates/recovery.html (the password email) so
// every email the studio sends is visually consistent: logo, serif headline,
// warm off-white palette, table-based for Outlook safety.
//
// NOTE: these are the emails OUR code sends (waitlist, welcome). The auth
// emails (password reset, etc.) are written by Supabase's template editor and
// merely delivered through Resend's SMTP — they don't live here.
//
// Config (Vercel env): RESEND_API_KEY + RESEND_FROM
// (e.g. "Batus <noreply@batusboxe.com>" — domain must be verified in Resend).

// Canonical, absolute site origin for links + the logo inside emails. Pinned
// so outbound mail never points at the wrong host: previously the origin was
// read from the request Host header (fallback "batus-mu.vercel.app"), which
// could differ from the batusboxe.com address we send FROM. Override with
// NEXT_PUBLIC_SITE_URL if the domain ever changes. No trailing slash.
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://batusboxe.com").replace(
    /\/$/,
    "",
  );
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string; // plain-text alt — multipart mail is less spam-prone.
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

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Shared branded shell — single source of truth for the look. Mirrors the
// recovery.html template so app + auth emails are indistinguishable in style.
function emailShell(opts: {
  siteUrl: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
}): string {
  const cta = opts.cta
    ? `
        <tr><td align="center" style="padding:4px 8px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td bgcolor="#0A0A0A" style="border-radius:6px;">
              <a href="${opts.cta.url}" style="display:inline-block;padding:16px 32px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:0.08em;color:#FAFAF7;text-decoration:none;text-transform:uppercase;border-radius:6px;">${escapeHtml(opts.cta.label)} &rarr;</a>
            </td>
          </tr></table>
        </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-PT"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:${SANS};color:#0A0A0A;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF7;"><tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr><td align="center" style="padding:8px 0 28px;">
          <img src="${opts.siteUrl}/logo-stacked.png" alt="${escapeHtml(studio.name)}" width="72" height="72" style="display:block;border:0;outline:none;text-decoration:none;height:72px;width:auto;">
        </td></tr>
        <tr><td align="center" style="padding:0 8px 18px;">
          <h1 style="margin:0;font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif;font-size:34px;font-weight:700;letter-spacing:0.06em;line-height:1.1;color:#0A0A0A;text-transform:uppercase;">${escapeHtml(opts.heading)}</h1>
        </td></tr>
        <tr><td style="padding:0 8px 24px;font-size:16px;line-height:1.6;color:#0A0A0A;">
          ${opts.bodyHtml}
        </td></tr>
        ${cta}
        <tr><td align="center" style="padding:28px 8px 8px;border-top:1px solid #E5E5E0;font-size:11px;letter-spacing:0.2em;line-height:1.7;text-transform:uppercase;color:#999;">
          ${escapeHtml(studio.fullName)}<br><span style="color:#bbb;">${escapeHtml(studio.coach)} · ${escapeHtml(studio.city)}</span>
        </td></tr>
      </table>
    </td>
  </tr></table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Waitlist promotion — a booked spot freed up and this student moved in.
// ---------------------------------------------------------------------------
export async function sendWaitlistPromotionEmail(args: {
  to: string;
  studentName: string | null;
  className: string;
  dateLabel: string;
  timeLabel: string;
  siteUrl: string;
}): Promise<void> {
  const { to, studentName, className, dateLabel, timeLabel, siteUrl } = args;
  const firstName = studentName?.trim().split(" ")[0] || "Olá";

  const subject = `Tens vaga na aula de ${className}`;

  const bodyHtml = `
          <p style="margin:0 0 14px;">${escapeHtml(firstName)}, abriu uma vaga e <strong>entraste</strong> nesta aula:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid #E5E5E0;border-radius:8px;"><tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:17px;font-weight:700;">${escapeHtml(className)}</p>
            <p style="margin:0;font-size:14px;color:#777;">${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</p>
          </td></tr></table>
          <p style="margin:0;">Já estás confirmado. Se não puderes ir, cancela a marcação para libertar o lugar para o próximo da lista.</p>`;

  const html = emailShell({
    siteUrl,
    heading: "Tens vaga",
    bodyHtml,
    cta: { label: "Ver a minha marcação", url: `${siteUrl}/perfil` },
  });

  const text = [
    "Tens vaga!",
    "",
    `${firstName}, abriu uma vaga e entraste nesta aula:`,
    "",
    className,
    `${dateLabel} · ${timeLabel}`,
    "",
    "Já estás confirmado. Se não puderes ir, cancela a marcação para libertar o lugar.",
    "",
    `Ver a tua marcação: ${siteUrl}/perfil`,
    "",
    `${studio.fullName} · ${studio.city}`,
  ].join("\n");

  await sendEmail({ to, subject, html, text });
}

// ---------------------------------------------------------------------------
// Welcome — fired on signup. New students land pending, so this nudges them
// to reach the coach for approval before they can book.
// ---------------------------------------------------------------------------
export async function sendWelcomeEmail(args: {
  to: string;
  siteUrl: string;
}): Promise<void> {
  const { to, siteUrl } = args;
  const ig = studio.social.instagram;
  const cta = ig
    ? { label: "Falar no Instagram", url: `https://instagram.com/${ig}` }
    : { label: "Falar com o treinador", url: `${siteUrl}/contacto` };

  const subject = `Bem-vindo ao ${studio.name}`;

  const bodyHtml = `
          <p style="margin:0 0 14px;">Recebemos o teu registo. Bem-vindo!</p>
          <p style="margin:0;">Antes da primeira aula, o ${escapeHtml(studio.coach)} aprova cada novo aluno. Fala com ele para combinarem a tua entrada e ficas logo a poder marcar aulas no horário.</p>`;

  const html = emailShell({
    siteUrl,
    heading: `Bem-vindo ao ${studio.name}`,
    bodyHtml,
    cta,
  });

  const text = [
    `Bem-vindo ao ${studio.name}!`,
    "",
    "Recebemos o teu registo.",
    "",
    `Antes da primeira aula, o ${studio.coach} aprova cada novo aluno. Fala com ele para combinarem a tua entrada.`,
    "",
    `${cta.label}: ${cta.url}`,
    "",
    `${studio.fullName} · ${studio.city}`,
  ].join("\n");

  await sendEmail({ to, subject, html, text });
}

// ---------------------------------------------------------------------------
// Payment reminder — sent on the cutoff day to students who haven't paid this
// month. Friendly, not a dunning notice: the coach never has to bring it up.
// ---------------------------------------------------------------------------
export async function sendPaymentReminderEmail(args: {
  to: string;
  studentName: string | null;
  monthLabel: string;
  siteUrl: string;
}): Promise<void> {
  const { to, studentName, monthLabel, siteUrl } = args;
  const firstName = studentName?.trim().split(" ")[0] || "Olá";
  const ig = studio.social.instagram;
  const cta = ig
    ? { label: "Falar no Instagram", url: `https://instagram.com/${ig}` }
    : { label: "Falar com o treinador", url: `${siteUrl}/contacto` };

  const subject = `Lembrete: mensalidade de ${monthLabel}`;

  const bodyHtml = `
          <p style="margin:0 0 14px;">${escapeHtml(firstName)}, passámos só para lembrar que ainda não registámos a tua mensalidade de <strong>${escapeHtml(monthLabel)}</strong>.</p>
          <p style="margin:0;">Para continuares a marcar aulas, é só acertares com o ${escapeHtml(studio.coach)}. Qualquer dúvida, fala connosco.</p>`;

  const html = emailShell({
    siteUrl,
    heading: "Lembrete de pagamento",
    bodyHtml,
    cta,
  });

  const text = [
    `Lembrete: mensalidade de ${monthLabel}`,
    "",
    `${firstName}, ainda não registámos a tua mensalidade de ${monthLabel}.`,
    "",
    `Para continuares a marcar aulas, acerta com o ${studio.coach}.`,
    "",
    `${cta.label}: ${cta.url}`,
    "",
    `${studio.fullName} · ${studio.city}`,
  ].join("\n");

  await sendEmail({ to, subject, html, text });
}
