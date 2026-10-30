"use client";

import { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // champ anti-robot invisible
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }
      setSent(true);
    } catch {
      setError("Impossible de contacter le serveur. Vérifie ta connexion.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Message envoyé !</h1>
        <p className="text-sm text-muted">
          Merci ! Une copie de ton message vient de t&apos;être envoyée sur <strong>{email}</strong>, et je te
          réponds dès que possible. Pense à vérifier tes spams si tu ne la vois pas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="mb-1 text-xl font-semibold">Contact</h1>
        <p className="text-sm text-muted">
          Une question, une remarque, une idée de goût ? Écris-moi, je te réponds par email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="contact-name" className="mb-1 block text-sm font-medium">
            Ton prénom <span className="font-normal text-muted">(optionnel)</span>
          </label>
          <input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1 block text-sm font-medium">
            Ton email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.fr"
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted">Pour recevoir une copie de ton message et ma réponse.</p>
        </div>
        <div>
          <label htmlFor="contact-message" className="mb-1 block text-sm font-medium">
            Ton message
          </label>
          <textarea
            id="contact-message"
            required
            rows={6}
            maxLength={3000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
        {/* Piège à robots : invisible et ignoré par les humains. */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {loading ? "Envoi..." : "Envoyer"}
        </button>
      </form>
    </div>
  );
}
