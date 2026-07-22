"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Stats = {
  totalsByRecipe: { name: string; total: number }[];
  weekly: Record<string, string | number>[];
  monthly: Record<string, string | number>[];
  recipeNames: string[];
  totalProduced: number;
  currentStock: number;
  totalSoldOrGiven: number;
  totalRevenue: number;
};

// Palette de couleurs pour distinguer les recettes dans les graphiques.
const COLORS = ["#7a8450", "#b3452f", "#4a7a8a", "#c9a227", "#8a5a8a", "#5a8a6a", "#a26b3f", "#3f5f8a"];

function colorFor(index: number): string {
  return COLORS[index % COLORS.length];
}

function formatEuros(amount: number): string {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminSuiviPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (res.ok) setStats(data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted">Chargement...</p>;

  if (!stats) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold">Suivi des commandes</h1>
        <p className="text-sm text-muted">Impossible de charger les statistiques.</p>
      </div>
    );
  }

  const hasOrders = stats.totalsByRecipe.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Suivi des commandes</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-white/60 p-4">
          <p className="text-2xl font-semibold">{stats.totalProduced}</p>
          <p className="text-xs text-muted">
            bouteilles produites au total ({stats.currentStock} en stock + {stats.totalSoldOrGiven} deja parties)
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white/60 p-4">
          <p className="text-2xl font-semibold">{formatEuros(stats.totalRevenue)} EUR</p>
          <p className="text-xs text-muted">somme encaissee (bouteilles vendues, hors dons)</p>
        </div>
      </div>

      {!hasOrders ? (
        <p className="text-sm text-muted">Aucune commande enregistree pour le moment.</p>
      ) : (
        <>
          <div>
            <h2 className="mb-3 text-sm font-medium">Répartition par recette</h2>
            <div className="rounded-xl border border-border bg-white/60 p-4" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.totalsByRecipe}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry) => `${entry.name} (${entry.value})`}
                  >
                    {stats.totalsByRecipe.map((entry, i) => (
                      <Cell key={entry.name} fill={colorFor(i)} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium">Volumes par semaine</h2>
            <div className="rounded-xl border border-border bg-white/60 p-4" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="period" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  {stats.recipeNames.map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={colorFor(i)} strokeWidth={1.5} dot={false} />
                  ))}
                  <Line type="monotone" dataKey="Total" stroke="#23201b" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium">Volumes par mois</h2>
            <div className="rounded-xl border border-border bg-white/60 p-4" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="period" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  {stats.recipeNames.map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={colorFor(i)} strokeWidth={1.5} dot={false} />
                  ))}
                  <Line type="monotone" dataKey="Total" stroke="#23201b" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
