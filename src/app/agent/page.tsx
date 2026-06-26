"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Bonjour 👋 Je suis l'assistant d'Aniria. Dites-moi votre projet — site internet, application métier, automatisation IA — et je vous oriente. Comment puis-je vous aider ?";

const SUGGESTIONS = [
  "Je veux une application métier",
  "Automatiser ma prospection",
  "Refaire mon site internet",
  "Prendre rendez-vous",
];

export default function AgentPage() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply || "…" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connexion impossible. Réessayez." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fffdfa] via-[#f7ede6] to-[#fbe7e0] px-4 py-6 sm:py-10">
      <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-2xl flex-col sm:h-[calc(100vh-5rem)]">
        {/* En-tête */}
        <div className="mb-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#814ac8] hover:opacity-70 transition-opacity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Retour
          </Link>
          <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-[#814ac8] shadow-sm">
            Démo · Agent IA Aniria
          </span>
        </div>

        {/* Fenêtre de chat */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_30px_70px_-30px_rgba(129,74,200,0.35)] backdrop-blur">
          {/* barre du chat */}
          <div className="flex items-center gap-3 border-b border-violet-100 px-5 py-4">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#df7afe] to-[#814ac8] text-white shadow-md">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2M20 14h2M15 13v2M9 13v2" /></svg>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-gray-900">Assistant Aniria</div>
              <div className="text-xs text-green-600">En ligne · répond en quelques secondes</div>
            </div>
          </div>

          {/* messages */}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "rounded-br-md bg-gradient-to-br from-[#b35cff] to-[#814ac8] text-white"
                      : "rounded-bl-md border border-violet-100 bg-white text-gray-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-violet-100 bg-white px-4 py-3 shadow-sm">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#b35cff] [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#b35cff] [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#b35cff]" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* suggestions */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-[#814ac8] transition-colors hover:bg-violet-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-violet-100 px-3 py-3 sm:px-4"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez votre message…"
              className="flex-1 rounded-full border border-violet-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-[#b35cff]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#df7afe] to-[#814ac8] text-white shadow-md transition-transform hover:scale-105 disabled:opacity-40"
              aria-label="Envoyer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
            </button>
          </form>
        </div>

        <p className="mt-3 text-center text-xs text-gray-500">
          Démo d&apos;agent IA conçue par Aniria — un agent comme celui-ci peut être connecté à votre activité.
        </p>
      </div>
    </main>
  );
}
