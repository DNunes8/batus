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
  // `||`, not `??`: .env.example ships the key with an empty value, and an
  // empty origin would turn every link and the logo in every email into a
  // relative path that resolves against the mail client.
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || "https://batusboxe.com").replace(/\/$/, "");
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string; // plain-text alt — multipart mail is less spam-prone.
};

// Returns whether the mail was actually accepted by Resend — callers that
// surface "email enviado" to the coach should only claim it when this is true.
// Still never throws: sending email must never break the flow that fired it.
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    console.warn(
      `[email] skipped "${subject}" — RESEND_API_KEY/RESEND_FROM not set`,
    );
    return false;
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
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
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
// Coach add — the coach put this student into a class from the admin calendar
// (the "ceder vagas" flow's other half). The student didn't book it themselves,
// so they get told, with the same cancel-to-free-the-seat nudge.
// ---------------------------------------------------------------------------
export async function sendCoachAddedEmail(args: {
  to: string;
  studentName: string | null;
  className: string;
  dateLabel: string;
  timeLabel: string;
  siteUrl: string;
}): Promise<boolean> {
  const { to, studentName, className, dateLabel, timeLabel, siteUrl } = args;
  const firstName = studentName?.trim().split(" ")[0] || "Olá";

  const subject = `Estás na aula de ${className}`;

  const bodyHtml = `
          <p style="margin:0 0 14px;">${escapeHtml(firstName)}, o coach <strong>adicionou-te</strong> a esta aula:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid #E5E5E0;border-radius:8px;"><tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:17px;font-weight:700;">${escapeHtml(className)}</p>
            <p style="margin:0;font-size:14px;color:#777;">${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</p>
          </td></tr></table>
          <p style="margin:0;">Já estás confirmado. Se não puderes ir, cancela a marcação para libertar o lugar para outro colega.</p>`;

  const html = emailShell({
    siteUrl,
    heading: "Estás na aula",
    bodyHtml,
    cta: { label: "Ver as minhas aulas", url: `${siteUrl}/perfil` },
  });

  const text = [
    "Estás na aula!",
    "",
    `${firstName}, o coach adicionou-te a esta aula:`,
    "",
    className,
    `${dateLabel} · ${timeLabel}`,
    "",
    "Já estás confirmado. Se não puderes ir, cancela a marcação para libertar o lugar.",
    "",
    `Ver as tuas aulas: ${siteUrl}/perfil`,
    "",
    `${studio.fullName} · ${studio.city}`,
  ].join("\n");

  return sendEmail({ to, subject, html, text });
}

// ---------------------------------------------------------------------------
// Studio-initiated changes to a class the student had booked. All three are
// BATCH senders: closing a busy day can touch dozens of students, and one
// Resend POST per student inside a server action would blow through the
// Workers subrequest budget and rate limits, half-delivering and leaving the
// rest silently untold. Resend's batch endpoint takes up to 100 per call.
// ---------------------------------------------------------------------------

const RESEND_BATCH_MAX = 100;

type BuiltEmail = { to: string; subject: string; html: string; text: string };

// Post pre-built messages in chunks. Returns how many were accepted.
async function sendBatch(messages: BuiltEmail[], label: string): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.warn(
      `[email] skipped ${label} batch (${messages.length}) — RESEND_API_KEY/RESEND_FROM not set`,
    );
    return 0;
  }
  if (messages.length === 0) return 0;

  let sent = 0;
  for (let i = 0; i < messages.length; i += RESEND_BATCH_MAX) {
    const chunk = messages.slice(i, i + RESEND_BATCH_MAX);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk.map((m) => ({ from, ...m }))),
      });
      if (!res.ok) {
        console.error(
          `[email] ${label} batch ${res.status}: ${await res.text()}`,
        );
        continue;
      }
      sent += chunk.length;
    } catch (err) {
      console.error(`[email] ${label} batch failed:`, err);
    }
  }
  return sent;
}

export type ClassChangeRecipient = {
  to: string;
  studentName: string | null;
  className: string;
  timeLabel: string;
  refunded?: boolean;
  oldTimeLabel?: string;
};

// --- cancelled -------------------------------------------------------------

function buildClassCancelled(args: {
  to: string;
  studentName: string | null;
  className: string;
  dateLabel: string;
  timeLabel: string;
  reason?: string | null;
  refunded?: boolean;
  siteUrl: string;
}): BuiltEmail {
  const { to, studentName, className, dateLabel, timeLabel, reason, refunded, siteUrl } = args;
  const firstName = studentName?.trim().split(" ")[0] || "Olá";

  const reasonHtml = reason
    ? `<p style="margin:0 0 14px;">Motivo: <strong>${escapeHtml(reason)}</strong></p>`
    : "";
  // Only claim the credit came back when it actually did.
  const refundHtml = refunded
    ? `<p style="margin:14px 0 0;">A aula foi devolvida ao teu pack — podes usá-la noutro dia.</p>`
    : "";

  const bodyHtml = `
          <p style="margin:0 0 14px;">${escapeHtml(firstName)}, esta aula <strong>não se vai realizar</strong>:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid #E5E5E0;border-radius:8px;"><tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:17px;font-weight:700;">${escapeHtml(className)}</p>
            <p style="margin:0;font-size:14px;color:#777;">${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</p>
          </td></tr></table>
          ${reasonHtml}
          <p style="margin:0;">A tua marcação foi anulada — não precisas de fazer nada. Podes marcar outra aula quando quiseres.</p>
          ${refundHtml}`;

  const text = [
    "Aula cancelada",
    "",
    `${firstName}, esta aula não se vai realizar:`,
    "",
    className,
    `${dateLabel} · ${timeLabel}`,
    ...(reason ? [`Motivo: ${reason}`] : []),
    "",
    "A tua marcação foi anulada — não precisas de fazer nada.",
    ...(refunded ? ["A aula foi devolvida ao teu pack."] : []),
    "",
    `Ver o horário: ${siteUrl}/aulas`,
    "",
    `${studio.fullName} · ${studio.city}`,
  ].join("\n");

  return {
    to,
    subject: `Aula cancelada — ${className}, ${dateLabel}`,
    html: emailShell({
      siteUrl,
      heading: "Aula cancelada",
      bodyHtml,
      cta: { label: "Ver o horário", url: `${siteUrl}/aulas` },
    }),
    text,
  };
}

export async function sendClassCancelledBatch(
  recipients: ClassChangeRecipient[],
  common: { dateLabel: string; reason?: string | null; siteUrl: string },
): Promise<number> {
  return sendBatch(
    recipients.map((r) =>
      buildClassCancelled({
        to: r.to,
        studentName: r.studentName,
        className: r.className,
        dateLabel: common.dateLabel,
        timeLabel: r.timeLabel,
        reason: common.reason,
        refunded: r.refunded,
        siteUrl: common.siteUrl,
      }),
    ),
    "class-cancelled",
  );
}

// --- back on --------------------------------------------------------------

function buildClassRestored(args: {
  to: string;
  studentName: string | null;
  className: string;
  dateLabel: string;
  timeLabel: string;
  charged?: boolean;
  siteUrl: string;
}): BuiltEmail {
  const { to, studentName, className, dateLabel, timeLabel, charged, siteUrl } = args;
  const firstName = studentName?.trim().split(" ")[0] || "Olá";

  const chargedHtml = charged
    ? `<p style="margin:14px 0 0;">A aula voltou a ser descontada do teu pack.</p>`
    : "";

  const bodyHtml = `
          <p style="margin:0 0 14px;">${escapeHtml(firstName)}, boas notícias — esta aula <strong>afinal realiza-se</strong> e a tua marcação foi reposta:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid #E5E5E0;border-radius:8px;"><tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:17px;font-weight:700;">${escapeHtml(className)}</p>
            <p style="margin:0;font-size:14px;color:#777;">${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</p>
          </td></tr></table>
          <p style="margin:0;">Se entretanto já não puderes ir, cancela no site para libertar o lugar.</p>
          ${chargedHtml}`;

  const text = [
    "A aula volta a realizar-se",
    "",
    `${firstName}, esta aula afinal realiza-se e a tua marcação foi reposta:`,
    "",
    className,
    `${dateLabel} · ${timeLabel}`,
    ...(charged ? ["A aula voltou a ser descontada do teu pack."] : []),
    "",
    "Se já não puderes ir, cancela no site para libertar o lugar.",
    "",
    `Ver as tuas aulas: ${siteUrl}/perfil`,
    "",
    `${studio.fullName} · ${studio.city}`,
  ].join("\n");

  return {
    to,
    subject: `A aula volta a realizar-se — ${className}, ${dateLabel}`,
    html: emailShell({
      siteUrl,
      heading: "Aula reposta",
      bodyHtml,
      cta: { label: "Ver as minhas aulas", url: `${siteUrl}/perfil` },
    }),
    text,
  };
}

export async function sendClassRestoredBatch(
  recipients: Array<ClassChangeRecipient & { charged?: boolean }>,
  common: { dateLabel: string; siteUrl: string },
): Promise<number> {
  return sendBatch(
    recipients.map((r) =>
      buildClassRestored({
        to: r.to,
        studentName: r.studentName,
        className: r.className,
        dateLabel: common.dateLabel,
        timeLabel: r.timeLabel,
        charged: r.charged,
        siteUrl: common.siteUrl,
      }),
    ),
    "class-restored",
  );
}

// --- moved ----------------------------------------------------------------

function buildClassRescheduled(args: {
  to: string;
  studentName: string | null;
  className: string;
  dateLabel: string;
  oldTimeLabel: string;
  newTimeLabel: string;
  siteUrl: string;
}): BuiltEmail {
  const { to, studentName, className, dateLabel, oldTimeLabel, newTimeLabel, siteUrl } = args;
  const firstName = studentName?.trim().split(" ")[0] || "Olá";

  const bodyHtml = `
          <p style="margin:0 0 14px;">${escapeHtml(firstName)}, a tua aula <strong>mudou de hora</strong>:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid #E5E5E0;border-radius:8px;"><tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:17px;font-weight:700;">${escapeHtml(className)}</p>
            <p style="margin:0;font-size:14px;color:#777;">${escapeHtml(dateLabel)}</p>
            <p style="margin:8px 0 0;font-size:15px;"><span style="text-decoration:line-through;color:#999;">${escapeHtml(oldTimeLabel)}</span> &rarr; <strong>${escapeHtml(newTimeLabel)}</strong></p>
          </td></tr></table>
          <p style="margin:0;">A tua marcação continua de pé — só mudou a hora. Se já não te der jeito, cancela no site.</p>`;

  const text = [
    "A tua aula mudou de hora",
    "",
    `${firstName}, a tua aula mudou de hora:`,
    "",
    className,
    dateLabel,
    `${oldTimeLabel} -> ${newTimeLabel}`,
    "",
    "A marcação continua de pé. Se já não te der jeito, cancela no site.",
    "",
    `Ver as tuas aulas: ${siteUrl}/perfil`,
    "",
    `${studio.fullName} · ${studio.city}`,
  ].join("\n");

  return {
    to,
    subject: `Nova hora — ${className}, ${dateLabel}`,
    html: emailShell({
      siteUrl,
      heading: "Nova hora",
      bodyHtml,
      cta: { label: "Ver as minhas aulas", url: `${siteUrl}/perfil` },
    }),
    text,
  };
}

export async function sendClassRescheduledBatch(
  recipients: ClassChangeRecipient[],
  common: { dateLabel: string; newTimeLabel: string; siteUrl: string },
): Promise<number> {
  return sendBatch(
    recipients.map((r) =>
      buildClassRescheduled({
        to: r.to,
        studentName: r.studentName,
        className: r.className,
        dateLabel: common.dateLabel,
        oldTimeLabel: r.oldTimeLabel ?? "",
        newTimeLabel: common.newTimeLabel,
        siteUrl: common.siteUrl,
      }),
    ),
    "class-rescheduled",
  );
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
function buildPaymentReminder(args: {
  to: string;
  studentName: string | null;
  monthLabel: string;
  siteUrl: string;
}): SendArgs {
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

  return { to, subject, html, text };
}

export async function sendPaymentReminderEmail(args: {
  to: string;
  studentName: string | null;
  monthLabel: string;
  siteUrl: string;
}): Promise<void> {
  await sendEmail(buildPaymentReminder(args));
}

// Batch variant for the monthly reminder cron: ONE request to Resend's batch
// endpoint (max 100 emails/call) instead of N sequential sends. Avoids both
// Resend's 2 req/s rate limit and Netlify's ~10s function timeout, and the
// caller caps the list to stay under the 100 emails/day free quota.
// Best-effort like sendEmail: logs and returns on any failure, never throws.
export async function sendPaymentReminderBatch(
  recipients: Array<{ to: string; studentName: string | null }>,
  monthLabel: string,
  siteUrl: string,
): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    console.warn(
      `[email] skipped reminder batch (${recipients.length}) — RESEND_API_KEY/RESEND_FROM not set`,
    );
    return 0;
  }
  if (recipients.length === 0) return 0;

  const payload = recipients.map((r) => ({
    from,
    ...buildPaymentReminder({
      to: r.to,
      studentName: r.studentName,
      monthLabel,
      siteUrl,
    }),
  }));

  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[email] Resend batch ${res.status}: ${await res.text()}`);
      return 0;
    }
    return recipients.length;
  } catch (err) {
    console.error("[email] reminder batch failed:", err);
    return 0;
  }
}
