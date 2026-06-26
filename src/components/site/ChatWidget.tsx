"use client";

import { useState, useRef, useEffect } from "react";
import BookingModal from "./BookingModal";
import { submitProjectLead } from "@/app/actions/leads";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Bonjour 👋 Je suis Léa, l'assistante d'Aniria. Une question sur un site, une application métier ou une automatisation IA ? Je suis là pour vous aider !";

const SUGGESTIONS = [
  "Je veux une application métier",
  "Automatiser ma prospection",
  "Refaire mon site",
];

const AVATAR = "/media/pages/about/team/lea.webp";
const STORAGE_KEY = "aniria:chat";
const CTA_AFTER_USER_MSGS = 3; // filet de sécurité si l'IA ne déclenche pas l'outil
// Intentions explicites : on affiche les boutons sans attendre le déclenchement IA
const CTA_KEYWORDS = /(rendez[- ]?vous|\brdv\b|prendre un appel|rappel|recontact|rappeler|me joindre|vous joindre|devis|\bappel\b)/i;

function SendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [ctaShown, setCtaShown] = useState(false);
  const [booking, setBooking] = useState(false);
  const [projectMode, setProjectMode] = useState(false);
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pSubmitting, setPSubmitting] = useState(false);
  const [pError, setPError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open, ctaShown, projectMode]);

  // Ouvertures déclenchées depuis ailleurs (boutons « Parler à l'agent » / « Prendre RDV » navbar)
  useEffect(() => {
    const openChat = () => setOpen(true);
    const openBooking = () => setBooking(true);
    window.addEventListener("aniria:open-chat", openChat);
    window.addEventListener("aniria:open-booking", openBooking);
    return () => {
      window.removeEventListener("aniria:open-chat", openChat);
      window.removeEventListener("aniria:open-booking", openBooking);
    };
  }, []);

  // Mobile : on verrouille le scroll de la page tant que le chat plein écran est
  // ouvert, sinon le scroll « fuit » sur le site en arrière-plan (scroll chaining).
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 639px)").matches) return; // desktop : carte flottante, pas de verrou
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  // Chargement de la conversation sauvegardée (après le montage → pas de mismatch d'hydratation)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length > 0) {
          setMessages(saved);
          if (saved.filter((m: Msg) => m.role === "user").length >= CTA_AFTER_USER_MSGS) {
            setCtaShown(true);
          }
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Sauvegarde à chaque évolution (uniquement après chargement, pour ne pas écraser l'historique)
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages, hydrated]);

  const buildRecap = () =>
    messages
      .slice(1) // retire le message d'accueil
      .map((m) => (m.role === "user" ? "Visiteur" : "Léa") + " : " + m.content.trim())
      .join("\n");

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    if (CTA_KEYWORDS.test(content)) setCtaShown(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply || "…" }]);
      if (data.action === "show_cta") setCtaShown(true);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connexion impossible. Réessayez." }]);
    } finally {
      setLoading(false);
      // filet de sécurité : après quelques échanges, on propose la suite même sans déclenchement IA
      if (next.filter((m) => m.role === "user").length >= CTA_AFTER_USER_MSGS) setCtaShown(true);
    }
  };

  const sendProject = async () => {
    if (pSubmitting || !pName.trim() || !pEmail.trim()) return;
    setPError("");
    setPSubmitting(true);
    const res = await submitProjectLead({ name: pName, email: pEmail, recap: buildRecap() });
    setPSubmitting(false);
    if (res.success) {
      setProjectMode(false);
      setPName("");
      setPEmail("");
      setMessages((m) => [...m, { role: "assistant", content: res.message }]);
    } else {
      setPError(res.message);
    }
  };

  const resetChat = () => {
    setMessages([{ role: "assistant", content: GREETING }]);
    setInput("");
    setCtaShown(false);
    setProjectMode(false);
    setPName("");
    setPEmail("");
    setPError("");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const hasUserMessage = messages.some((m) => m.role === "user");

  return (
    <>
      {/* Lanceur */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fermer le chat" : "Ouvrir le chat"}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#df7afe] to-[#814ac8] text-white shadow-[0_12px_30px_-8px_rgba(129,74,200,0.8)] transition-transform hover:scale-105"
      >
        {!open && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b35cff] opacity-40" />
        )}
        <span className="relative">
          {open ? (
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          ) : (
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
          )}
        </span>
      </button>

      {/* Panneau */}
      {open && (
        <div className="fixed inset-0 z-[70] flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[560px] sm:max-h-[calc(100vh-7rem)] sm:w-[calc(100vw-2.5rem)] sm:max-w-[380px] sm:rounded-3xl sm:border sm:border-white/70 sm:shadow-[0_30px_70px_-25px_rgba(129,74,200,0.5)]">
          {/* en-tête */}
          <div className="relative bg-gradient-to-br from-[#df7afe] to-[#814ac8] px-5 pt-5 pb-4 text-white">
            <div className="absolute right-2 top-2 flex items-center gap-2">
              {hasUserMessage && (
                <button
                  onClick={resetChat}
                  aria-label="Recommencer la conversation"
                  title="Recommencer"
                  className="rounded-full p-1.5 text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                title="Fermer"
                className="rounded-full p-2.5 text-white transition-colors hover:bg-white/20"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={AVATAR} alt="Léa" className="h-11 w-11 rounded-full border-2 border-white/70 object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#814ac8] bg-green-400" />
              </div>
              <div className="leading-tight">
                <div className="font-semibold">Léa · Assistante Aniria</div>
                <div className="text-[11px] text-white/80">En ligne · Réponse rapide 7j/7</div>
              </div>
            </div>
          </div>

          {/* messages */}
          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3.5 py-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-gradient-to-br from-[#b35cff] to-[#814ac8] text-white"
                      : "rounded-bl-md border border-violet-100 bg-violet-50/60 text-gray-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-violet-100 bg-violet-50/60 px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b35cff] [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b35cff] [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b35cff]" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-[#814ac8] transition-colors hover:bg-violet-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Mini-formulaire « transmettre mon projet » */}
          {projectMode && (
            <div className="mx-3 mb-2 space-y-2 rounded-2xl border border-violet-100 bg-violet-50/50 p-3">
              <div className="text-xs font-semibold text-[#814ac8]">Transmettre mon projet</div>
              <input
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="Votre nom"
                className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#b35cff]"
              />
              <input
                value={pEmail}
                onChange={(e) => setPEmail(e.target.value)}
                type="email"
                placeholder="vous@exemple.com"
                className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#b35cff]"
              />
              {pError && <p className="text-xs text-red-500">{pError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setProjectMode(false)}
                  className="flex-1 rounded-xl border border-violet-200 px-3 py-2 text-xs font-medium text-[#814ac8] transition hover:bg-white"
                >
                  Annuler
                </button>
                <button
                  onClick={sendProject}
                  disabled={pSubmitting || !pName.trim() || !pEmail.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#df7afe] to-[#814ac8] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {pSubmitting ? "Envoi…" : "Envoyer"}
                </button>
              </div>
            </div>
          )}

          {/* CTA : prendre RDV / transmettre — affichés quand le besoin est qualifié */}
          {ctaShown && hasUserMessage && !projectMode && (
            <div className="mx-3 mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setBooking(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#df7afe] to-[#814ac8] px-2 py-2.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                Prendre rendez-vous
              </button>
              <button
                type="button"
                onClick={() => setProjectMode(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-violet-300 bg-white px-2 py-2.5 text-xs font-semibold text-[#814ac8] transition hover:bg-violet-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                Transmettre
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-violet-100 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez votre message…"
              className="flex-1 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-[#b35cff]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#df7afe] to-[#814ac8] text-white transition-transform hover:scale-105 disabled:opacity-40"
              aria-label="Envoyer"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      {booking && <BookingModal recap={buildRecap()} onClose={() => setBooking(false)} />}
    </>
  );
}
