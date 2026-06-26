// Résume un échange visiteur/Léa en un brief de besoins structuré pour l'équipe.
// Utilisé côté serveur (server actions) avant l'envoi des emails.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const PROMPT = `Tu reçois un échange entre un visiteur et l'assistante "Léa" d'une agence web/IA (Aniria).
Rédige un résumé court et structuré des BESOINS du client, destiné à l'équipe commerciale.

Contraintes :
- Uniquement des puces courtes, en français, préfixées par "• ".
- Couvre, seulement quand l'info est présente : Type de projet, Objectif, Périmètre (pages, fonctionnalités), Préférences (design, techno, mobile...), Délai, Budget.
- N'invente rien : si une information n'est pas dans l'échange, ne la mentionne pas.
- Pas d'introduction, pas de conclusion, pas de formule de politesse. Réponds uniquement par les puces.`;

/**
 * Renvoie un résumé en puces, ou null si indisponible (le caller retombe alors
 * sur le transcript brut).
 */
export async function summarizeNeeds(transcript?: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key || !transcript || !transcript.trim()) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: transcript },
        ],
        temperature: 0.2,
        max_tokens: 350,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() || "";
    return text || null;
  } catch {
    return null;
  }
}
