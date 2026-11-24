/**
 * Sends email through Resend (https://resend.com), with Pause's plain layout
 * and the safety line every email carries (FR-17a).
 *
 * Secrets (Supabase dashboard > Edge Functions > Secrets, never in git):
 * - RESEND_API_KEY: required to send. Without it, emails are logged and skipped.
 * - EMAIL_FROM: e.g. "Pause <alerts@yourdomain.com>". Until a domain is
 *   verified in Resend, the default test sender can only email the Resend
 *   account's own address.
 * - SITE_URL: where the website lives, e.g. "https://pause.example"; used for
 *   buttons and the safety line.
 */

const DEFAULT_FROM = "Pause <onboarding@resend.dev>";
const DEFAULT_SITE = "http://localhost:5173";

export function siteUrl(): string {
  return (Deno.env.get("SITE_URL") || DEFAULT_SITE).replace(/\/+$/, "");
}

/** FR-17a: scammers will copy these emails, so every one says this. */
export function safetyLine(): string {
  const host = new URL(siteUrl()).host;
  return `Pause will never ask for your recovery phrase. Before you connect your wallet, check the address bar says ${host}.`;
}

export type Email = {
  to: string;
  subject: string;
  /** Short paragraphs, plain text. */
  paragraphs: string[];
  /** Buttons only open Pause, never act on their own (FR-17a). First is main. */
  buttons?: { label: string; path: string }[];
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderEmail(email: Email): { html: string; text: string } {
  const buttons = (email.buttons ?? []).map((b) => ({
    label: b.label,
    link: `${siteUrl()}${b.path}`,
  }));
  const p = (t: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1a1a1a">${escapeHtml(t)}</p>`;
  const button = (b: { label: string; link: string }, main: boolean) =>
    `<a href="${escapeHtml(b.link)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;${main ? "background:#1a1a1a;color:#ffffff" : "border:1px solid #1a1a1a;color:#1a1a1a"}">${escapeHtml(b.label)}</a>`;
  const html = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px">`,
    ...email.paragraphs.map(p),
    buttons.length
      ? `<p style="margin:24px 0 16px">${buttons.map((b, i) => button(b, i === 0)).join("")}</p>`
      : "",
    `<p style="margin:32px 0 0;font-size:13px;line-height:1.5;color:#666">${escapeHtml(safetyLine())}</p>`,
    `</div>`,
  ].join("");
  const text = [
    ...email.paragraphs,
    ...buttons.map((b) => `${b.label}: ${b.link}`),
    "",
    safetyLine(),
  ].join("\n\n");
  return { html, text };
}

/**
 * Sends one email. Returns false (and logs why) instead of throwing, so a
 * mail problem never undoes the action that triggered it.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.warn(`RESEND_API_KEY not set; skipped "${email.subject}"`);
    return false;
  }
  const { html, text } = renderEmail(email);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || DEFAULT_FROM,
        to: [email.to],
        subject: email.subject,
        html,
        text,
      }),
    });
    if (!response.ok) {
      console.error(
        `Resend refused "${email.subject}": ${response.status} ${await response.text()}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Couldn't reach Resend for "${email.subject}"`, error);
    return false;
  }
}

/** FR-13: sent when a guardian accepts, so they can check it isn't in spam. */
export function welcomeEmail(input: {
  to: string;
  ownerName: string | null;
}): Email {
  const owner = input.ownerName ?? "The vault's owner";
  const possessive = input.ownerName ? `${input.ownerName}'s` : "this";
  return {
    to: input.to,
    subject: input.ownerName
      ? `You're now ${input.ownerName}'s guardian on Pause`
      : "You're now a guardian on Pause",
    paragraphs: [
      `Thanks for accepting. ${owner} trusts you to watch over their savings.`,
      `Every withdrawal from ${possessive} vault waits before it leaves. We'll email you here when one is waiting. If it looks like theft, the email is marked urgent and you can stop it in Pause.`,
      "Please check this email didn't land in spam. If it did, mark it as not spam so you don't miss an alert.",
    ],
    buttons: [{ label: "Open Pause", path: "/" }],
  };
}
