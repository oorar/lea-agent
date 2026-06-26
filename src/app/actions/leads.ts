"use server";

import { Resend } from "resend";
import { formatSlot } from "@/lib/availability";
import { isValidPhone, waNumber } from "@/lib/phone";
import { summarizeNeeds } from "@/lib/summarize";

const TO = "contact@aniria.dev";
const FROM = "Aniria <contact@aniria.dev>";

export interface LeadResult {
  success: boolean;
  message: string;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

const ERR = "Une erreur est survenue. Écrivez-nous directement à contact@aniria.dev.";

function recapBlock(content?: string, label = "Résumé du besoin"): string {
  if (!content || !content.trim()) return "";
  return `
    <div style="margin-top:20px;padding:20px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid #222;">
      <p style="color:#999;margin:0 0 8px;font-size:13px;">${escapeHtml(label)}</p>
      <p style="color:#fff;margin:0;white-space:pre-wrap;">${escapeHtml(content)}</p>
    </div>`;
}

/** Résumé IA des besoins, avec repli sur le transcript brut. */
async function briefFrom(recap?: string): Promise<{ content: string; label: string }> {
  const summary = await summarizeNeeds(recap);
  return summary
    ? { content: summary, label: "Résumé du besoin" }
    : { content: recap || "", label: "Échange avec Léa" };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Prise de rendez-vous (appel WhatsApp). */
export async function submitBooking(input: {
  name: string;
  countryCode: string;
  phone: string;
  slot: string;
  recap?: string;
}): Promise<LeadResult> {
  const name = (input.name || "").trim();
  const phone = (input.phone || "").trim();
  const slot = (input.slot || "").trim();

  if (!name || !phone || !slot) {
    return { success: false, message: "Merci d'indiquer votre nom, téléphone et créneau." };
  }
  if (!isValidPhone(phone)) {
    return { success: false, message: "Le numéro de téléphone semble invalide." };
  }

  const resend = getResend();
  if (!resend) return { success: false, message: ERR };

  const wa = waNumber(input.countryCode || "", phone);
  const when = formatSlot(slot);
  const brief = await briefFrom(input.recap);

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:30px;background:#111;color:#fff;border-radius:12px;">
      <h1 style="color:#DF7AFE;font-size:24px;margin-bottom:20px;">📅 Nouveau rendez-vous WhatsApp</h1>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:10px 0;color:#999;width:140px;">Créneau</td><td style="padding:10px 0;color:#fff;font-weight:600;">${escapeHtml(when)}</td></tr>
        <tr><td style="padding:10px 0;color:#999;">Nom</td><td style="padding:10px 0;color:#fff;font-weight:600;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:10px 0;color:#999;">Téléphone</td><td style="padding:10px 0;color:#fff;">${escapeHtml((input.countryCode || "") + " " + phone)}</td></tr>
      </table>
      <a href="https://wa.me/${wa}" style="display:inline-block;margin-top:20px;padding:12px 22px;background:#25D366;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Ouvrir WhatsApp →</a>
      ${recapBlock(brief.content, brief.label)}
      <p style="margin-top:20px;color:#666;font-size:12px;">⚠️ Pense à ajouter ce créneau dans blockedSlots (availability.ts) pour bloquer le double-booking.</p>
    </div>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      subject: `RDV WhatsApp — ${name} · ${when}`,
      html,
    });
    if (error) return { success: false, message: ERR };
    return {
      success: true,
      message: `C'est noté ✅ Nous vous appellerons sur WhatsApp ${when}.`,
    };
  } catch {
    return { success: false, message: ERR };
  }
}

/** Transmission simple d'un projet (email, sans RDV). */
export async function submitProjectLead(input: {
  name: string;
  email: string;
  recap?: string;
}): Promise<LeadResult> {
  const name = (input.name || "").trim();
  const email = (input.email || "").trim();

  if (!name || !email || !email.includes("@")) {
    return { success: false, message: "Merci d'indiquer votre nom et un email valide." };
  }

  const resend = getResend();
  if (!resend) return { success: false, message: ERR };

  const brief = await briefFrom(input.recap);

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:30px;background:#111;color:#fff;border-radius:12px;">
      <h1 style="color:#DF7AFE;font-size:24px;margin-bottom:20px;">✉️ Projet transmis via Léa</h1>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:10px 0;color:#999;width:140px;">Nom</td><td style="padding:10px 0;color:#fff;font-weight:600;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:10px 0;color:#999;">Email</td><td style="padding:10px 0;"><a href="mailto:${escapeHtml(email)}" style="color:#DF7AFE;">${escapeHtml(email)}</a></td></tr>
      </table>
      ${recapBlock(brief.content, brief.label)}
      <p style="margin-top:20px;color:#666;font-size:12px;">Envoyé depuis l'assistante Léa — aniria.dev</p>
    </div>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      subject: `Projet via Léa — ${name}`,
      html,
      ...(email.includes("@") ? { replyTo: email } : {}),
    });
    if (error) return { success: false, message: ERR };
    return {
      success: true,
      message: "Merci ! Votre projet a bien été transmis. Nous revenons vers vous très vite.",
    };
  } catch {
    return { success: false, message: ERR };
  }
}
