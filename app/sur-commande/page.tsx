"use client";

import { useState } from "react";

export default function SurCommandePage() {
  const [recipeName, setRecipeName] = useState("");
  const [details, setDetails] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [desiredDate, setDesiredDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName,
          details,
          quantity,
          desiredDate: desiredDate || undefined,
          customerName,
          customerEmail: customerEmail || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Impossible de contacter le serveur. Verifie ta connexion.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="py-10 text-center">
        <p className="text-lg font-medium">Demande envoyee !</p>
        <p className="mt-1 text-sm text-muted">
          Le producteur va etudier ta demande et te recontacter pour la valider.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Sur commande</h1>
      <p className="mb-5 text-sm text-muted">
        Une recette precise en tete, une quantite ou une date particuliere ? Fais ta demande,
        elle sera validee manuellement.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Recette souhaitee</label>
          <input
            type="text"
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            placeholder="Ex : Kombucha Fraise-Basilic"
            required
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Details (optionnel)</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Quantite</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Date souhaitee (optionnel)</label>
          <input
            type="date"
            value={desiredDate}
            onChange={(e) => setDesiredDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Ton prenom / nom</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Email (optionnel)</label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {loading ? "Envoi..." : "Envoyer la demande"}
        </button>
      </form>
    </div>
  );
}
