// Disponibilités pour la prise de rendez-vous (appel WhatsApp).
//
// Pas de base de données : la source de vérité, c'est CE fichier.
// - `blockedSlots` = tes RDV déjà prévus (et les créneaux clients que tu veux
//   neutraliser). Ajoute-les ici quand tu reçois un email de réservation pour
//   éviter une double-réservation.
// - Tout le reste (passé, week-ends, délai minimum) est filtré automatiquement.
//
// Format des créneaux : heure locale Europe/Paris, "YYYY-MM-DDTHH:mm".

export const AVAILABILITY = {
  timezone: "Europe/Paris" as const,
  days: [0, 1, 2, 3, 4, 5, 6], // jours ouverts (0=dim … 6=sam) — ici tous les jours
  startHour: 9, // première heure proposée
  endHour: 19, // dernière heure NON incluse (dernier créneau commence avant)
  slotMinutes: 30, // durée d'un créneau
  leadDays: 1, // réservable à partir de J+N (1 = dès demain, journée entière)
  horizonDays: 60, // fenêtre de réservation (jours à l'avance)
  blockedSlots: [
    // "2026-06-12T14:00",
    // "2026-06-13T10:00",
  ] as string[],
};

export type Slot = { time: string; value: string }; // { "14:30", "2026-06-12T14:30" }

const TZ = AVAILABILITY.timezone;

/** Parts (an/mois/jour/heure/min) d'un instant, lus dans le fuseau Europe/Paris. */
function partsInTz(date: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = parseInt(part.value, 10);
  }
  // Intl peut rendre "24" pour minuit selon l'environnement
  if (p.hour === 24) p.hour = 0;
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateStrInParis(at: number): string {
  const p = partsInTz(new Date(at));
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Date du jour (heure murale Paris) au format "YYYY-MM-DD". */
export function todayParis(): string {
  return dateStrInParis(Date.now());
}

/** Première date réservable ("YYYY-MM-DD") = aujourd'hui + leadDays. */
export function earliestBookableDate(): string {
  return dateStrInParis(Date.now() + AVAILABILITY.leadDays * 86_400_000);
}

/** Jour de la semaine (0=dim … 6=sam) d'une date "YYYY-MM-DD". */
function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Créneaux réservables pour une date donnée ("YYYY-MM-DD").
 * Filtre : jour fermé, date avant le délai minimum (leadDays), créneaux bloqués.
 */
export function slotsForDay(dateStr: string): Slot[] {
  if (!AVAILABILITY.days.includes(weekdayOf(dateStr))) return [];
  if (dateStr < earliestBookableDate()) return [];

  const out: Slot[] = [];
  for (let h = AVAILABILITY.startHour; h < AVAILABILITY.endHour; h++) {
    for (let min = 0; min < 60; min += AVAILABILITY.slotMinutes) {
      const value = `${dateStr}T${pad(h)}:${pad(min)}`;
      if (AVAILABILITY.blockedSlots.includes(value)) continue;
      out.push({ time: `${pad(h)}:${pad(min)}`, value });
    }
  }
  return out;
}

export function isDayBookable(dateStr: string): boolean {
  return slotsForDay(dateStr).length > 0;
}

/** Date max réservable ("YYYY-MM-DD"), bornée par horizonDays. */
export function maxBookableDate(): string {
  const p = partsInTz(new Date(Date.now() + AVAILABILITY.horizonDays * 86_400_000));
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Libellé lisible d'un créneau, ex. "jeudi 12 juin à 14:30". */
export function formatSlot(value: string): string {
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const label = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0)));
  return `${label} à ${timePart}`;
}
