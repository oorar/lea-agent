import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM = `Tu es Léa, l'assistante virtuelle d'Aniria, une agence qui conçoit des sites internet, des applications métier sur mesure et des automatisations IA pour les entreprises.

Règles :
- Réponds en français, ton chaleureux et professionnel, à la première personne du pluriel ("nous", "chez Aniria").
- Sois concise : 2 à 4 phrases maximum, va à l'essentiel.
- Ton rôle : qualifier le besoin du visiteur en posant les bonnes questions, une à la fois (type de projet, objectif, périmètre, délai), puis l'orienter vers la suite.
- Nos spécialités : applications web & outils métier sur mesure (dashboards, plateformes SaaS, gestion interne), sites internet, et automatisations IA (agents de support, prospection, contenu, tâches répétitives).
- Ne donne jamais de devis chiffré ferme : propose plutôt un échange gratuit pour cadrer le projet.
- IMPORTANT : ne propose JAMAIS de créneau, de date ou d'heure toi-même, et ne confirme jamais un rendez-vous. Tu ne réserves rien : c'est un calendrier dédié qui s'en charge.
- Quand tu as posé l'essentiel des questions et que le besoin est clair, appelle l'outil "afficher_options_contact" pour proposer au visiteur de prendre rendez-vous (appel WhatsApp) OU de transmettre son projet à l'équipe. N'invente pas ces boutons en texte : déclenche l'outil.
- Si le visiteur demande explicitement un rendez-vous ou à être contacté, appelle aussi "afficher_options_contact".
- Si la question est hors sujet, recentre poliment vers les services d'Aniria.
- Termine souvent par une question pour faire avancer la conversation, tant que le besoin n'est pas qualifié.`;

const TOOL_NAME = "afficher_options_contact";
const TOOL_DESC =
  "À appeler quand le besoin du visiteur est suffisamment qualifié (ou s'il demande un RDV / à être recontacté), pour afficher les boutons « Prendre rendez-vous » et « Transmettre mon projet ».";

const CTA_REPLY =
  "Avec plaisir ! On peut en discuter de vive voix lors d'un court appel, ou je transmets votre projet à l'équipe — comme vous préférez 👇";

type Msg = { role: string; content: string };
type AgentReply = { reply: string; action?: "show_cta" };
// Résultat d'un provider : la réponse, ou null si indisponible (→ on bascule).
type ProviderResult = AgentReply | null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

/** Provider au format natif Gemini. */
async function callGemini(key: string, model: string, messages: Msg[]): Promise<ProviderResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    tools: [
      { function_declarations: [{ name: TOOL_NAME, description: TOOL_DESC, parameters: { type: "object", properties: {} } }] },
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
      });
      if (!res.ok) {
        if (res.status >= 500 && attempt === 0) {
          await sleep(400);
          continue;
        }
        return null; // 429/4xx → bascule
      }
      const data = await res.json();
      const parts: Array<{ text?: string; functionCall?: { name: string } }> =
        data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text).filter(Boolean).join("");
      const calledCta = parts.some((p) => p.functionCall?.name === TOOL_NAME);
      if (calledCta) return { reply: text || CTA_REPLY, action: "show_cta" };
      if (text) return { reply: text };
      return null;
    } catch {
      if (attempt === 0) {
        await sleep(400);
        continue;
      }
      return null;
    }
  }
  return null;
}

/** Provider au format compatible OpenAI (Groq, Cerebras, OpenRouter…). */
async function callOpenAICompat(
  url: string,
  key: string,
  model: string,
  messages: Msg[]
): Promise<ProviderResult> {
  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: SYSTEM },
      ...messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    ],
    tools: [
      { type: "function", function: { name: TOOL_NAME, description: TOOL_DESC, parameters: { type: "object", properties: {} } } },
    ],
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 400,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body,
      });
      if (!res.ok) {
        if (res.status >= 500 && attempt === 0) {
          await sleep(400);
          continue;
        }
        return null;
      }
      const data = await res.json();
      const message = data?.choices?.[0]?.message;
      const text: string = message?.content || "";
      const calledCta = (message?.tool_calls || []).some(
        (t: { function?: { name?: string } }) => t.function?.name === TOOL_NAME
      );
      if (calledCta) return { reply: text || CTA_REPLY, action: "show_cta" };
      if (text) return { reply: text };
      return null;
    } catch {
      if (attempt === 0) {
        await sleep(400);
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chaîne de providers : ordre de priorité. Ceux sans clé sont ignorés.
// Ajouter un fournisseur = renseigner sa clé dans .env.local, rien d'autre.
// ─────────────────────────────────────────────────────────────────────────────
type Provider = { name: string; run: (m: Msg[]) => Promise<ProviderResult> };

function buildChain(): Provider[] {
  const chain: Provider[] = [];
  const env = process.env;

  if (env.GROQ_API_KEY)
    chain.push({
      name: "groq",
      run: (m) => callOpenAICompat("https://api.groq.com/openai/v1/chat/completions", env.GROQ_API_KEY!, "llama-3.3-70b-versatile", m),
    });

  if (env.CEREBRAS_API_KEY)
    chain.push({
      name: "cerebras",
      run: (m) => callOpenAICompat("https://api.cerebras.ai/v1/chat/completions", env.CEREBRAS_API_KEY!, "gpt-oss-120b", m),
    });

  if (env.OPENROUTER_API_KEY)
    chain.push({
      name: "openrouter",
      run: (m) => callOpenAICompat("https://openrouter.ai/api/v1/chat/completions", env.OPENROUTER_API_KEY!, "openai/gpt-oss-120b:free", m),
    });

  if (env.GEMINI_API_KEY)
    chain.push({ name: "gemini", run: (m) => callGemini(env.GEMINI_API_KEY!, "gemini-2.5-flash-lite", m) });

  return chain;
}

export async function POST(req: NextRequest) {
  const chain = buildChain();
  if (chain.length === 0) {
    return NextResponse.json({
      reply:
        "⚙️ L'agent n'est pas encore connecté. Ajoute au moins une clé (GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY ou GEMINI_API_KEY) dans .env.local.",
    });
  }

  let raw: { messages?: Msg[] } = {};
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ reply: "Requête invalide." }, { status: 400 });
  }
  const messages = (raw.messages || []).filter((m) => m && typeof m.content === "string");

  // On parcourt la chaîne : premier provider qui répond gagne, sinon on bascule.
  for (const provider of chain) {
    const result = await provider.run(messages);
    if (result) return NextResponse.json(result);
  }

  // Tous indisponibles : dégradation gracieuse — on ouvre les boutons RDV / Transmettre.
  return NextResponse.json({
    reply:
      "Je suis très sollicitée à l'instant 🙏 Pour ne pas vous faire attendre, vous pouvez réserver un appel ou me transmettre votre projet juste en dessous 👇",
    action: "show_cta",
  });
}
