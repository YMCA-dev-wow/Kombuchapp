"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";

type Stats = {
  totalsByRecipe: { name: string; total: number }[];
  totalsByCustomer: { name: string; total: number; recipes: { name: string; total: number }[] }[];
  weekly: Record<string, string | number>[];
  monthly: Record<string, string | number>[];
  recipeNames: string[];
  totalProduced: number;
  currentStock: number;
  totalSoldOrGiven: number;
  totalRevenue: number;
};

type Period = "semaine" | "mois";

// Palette de couleurs pour distinguer les recettes dans les graphiques.
const COLORS = ["#7a8450", "#b3452f", "#4a7a8a", "#c9a227", "#8a5a8a", "#5a8a6a", "#a26b3f", "#3f5f8a"];
// Nombre de périodes affichées (les plus récentes) pour rester lisible sur mobile.
const MAX_PERIODS = 12;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function formatEuros(amount: number): string {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "2026-S40" -> "S40" ; "2026-10" -> "oct. 26"
function formatPeriod(label: string): string {
  const week = label.match(/^\d{4}-S(\d+)$/);
  if (week) return `S${week[1]}`;
  const month = label.match(/^(\d{4})-(\d{2})$/);
  if (month) return `${MONTHS[Number(month[2]) - 1]} ${month[1].slice(2)}`;
  return label;
}

type TooltipPayload = { name: string; value: number; color: string; payload: Record<string, string | number> };

// Infobulle : détail par goût (uniquement les goûts présents) + total.
function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const items = payload.filter((p) => Number(p.value) > 0);
  return (
    <div className="rounded-lg border border-border bg-white p-2 text-xs shadow-sm">
      <p className="mb-1 font-medium">{formatPeriod(String(row.period))}</p>
      {items.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name} : {p.value}
        </p>
      ))}
      <p className="mt-1 border-t border-border pt-1 font-medium">Total : {row.Total}</p>
    </div>
  );
}

export default function AdminSuiviPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("semaine");
  // Clients dont le détail par goût est déplié.
  const [openCustomers, setOpenCustomers] = useState<Set<string>>(new Set());

  function toggleCustomer(name: string) {
    setOpenCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

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
  const colorOf = (name: string) => COLORS[Math.max(0, stats.recipeNames.indexOf(name)) % COLORS.length];
  const maxTotal = Math.max(1, ...stats.totalsByRecipe.map((r) => r.total));
  const maxCustomerTotal = Math.max(1, ...stats.totalsByCustomer.map((c) => c.total));
  const series = (period === "semaine" ? stats.weekly : stats.monthly).slice(-MAX_PERIODS);
  // Seuls les goûts présents sur la période affichée apparaissent (légende + barres).
  const visibleRecipes = stats.recipeNames.filter((name) => series.some((row) => Number(row[name] ?? 0) > 0));
  const lastRecipe = visibleRecipes[visibleRecipes.length - 1];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Suivi des commandes</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-white/60 p-4">
          <p className="text-2xl font-semibold">{stats.totalProduced}</p>
          <p className="text-xs text-muted">
            bouteilles produites au total ({stats.currentStock} en stock + {stats.totalSoldOrGiven} déjà parties)
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white/60 p-4">
          <p className="text-2xl font-semibold">{formatEuros(stats.totalRevenue)} EUR</p>
          <p className="text-xs text-muted">somme encaissée (bouteilles vendues, hors dons)</p>
        </div>
      </div>

      {!hasOrders ? (
        <p className="text-sm text-muted">Aucune commande enregistrée pour le moment.</p>
      ) : (
        <>
          {/* Classement par goût : barres horizontales, lisibles même avec beaucoup de goûts. */}
          <div>
            <h2 className="mb-3 text-sm font-medium">Bouteilles parties par goût</h2>
            <div className="space-y-2.5 rounded-xl border border-border bg-white/60 p-4">
              {stats.totalsByRecipe.map((r) => (
                <div key={r.name}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span className="shrink-0 font-medium">
                      {r.total} <span className="font-normal text-muted">({Math.round((r.total / stats.totalSoldOrGiven) * 100)} %)</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-border/60">
                    <div
                      className="h-2.5 rounded-full"
                      style={{ width: `${(r.total / maxTotal) * 100}%`, background: colorOf(r.name) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Par client : une barre totale découpée par goût, puis un classement des
              clients. Toucher un client déplie le détail de ses goûts. */}
          <div>
            <h2 className="mb-3 text-sm font-medium">Bouteilles commandées par client</h2>
            <div className="space-y-3 rounded-xl border border-border bg-white/60 p-4">
              <div>
                <p className="mb-1.5 text-xs">
                  <span className="text-lg font-semibold">{stats.totalSoldOrGiven}</span> bouteilles commandées
                  {stats.totalProduced > 0 && (
                    <span className="text-muted">
                      {" "}
                      · {Math.round((stats.totalSoldOrGiven / stats.totalProduced) * 100)} % des {stats.totalProduced} produites
                    </span>
                  )}
                </p>
                <div className="flex h-3 overflow-hidden rounded-full bg-border/60">
                  {stats.totalsByRecipe.map((r) => (
                    <div
                      key={r.name}
                      title={`${r.name} : ${r.total}`}
                      style={{ width: `${(r.total / stats.totalSoldOrGiven) * 100}%`, background: colorOf(r.name) }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {stats.totalsByRecipe.map((r) => (
                    <span key={r.name} className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(r.name) }} />
                      {r.name} ({r.total})
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1 border-t border-border pt-3">
                {stats.totalsByCustomer.map((c) => {
                  const open = openCustomers.has(c.name);
                  return (
                    <div key={c.name}>
                      <button
                        type="button"
                        onClick={() => toggleCustomer(c.name)}
                        aria-expanded={open}
                        className="block w-full py-1 text-left"
                      >
                        <div className="mb-1 flex justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate">
                            <span className="text-muted">{open ? "▾" : "▸"}</span> {c.name}
                          </span>
                          <span className="shrink-0 font-medium">
                            {c.total}{" "}
                            <span className="font-normal text-muted">
                              ({Math.round((c.total / stats.totalSoldOrGiven) * 100)} %)
                            </span>
                          </span>
                        </div>
                        <div className="flex h-2.5 rounded-full bg-border/60">
                          <div
                            className="flex h-2.5 overflow-hidden rounded-full"
                            style={{ width: `${(c.total / maxCustomerTotal) * 100}%` }}
                          >
                            {c.recipes.map((r) => (
                              <div
                                key={r.name}
                                style={{ width: `${(r.total / c.total) * 100}%`, background: colorOf(r.name) }}
                              />
                            ))}
                          </div>
                        </div>
                      </button>
                      {open && (
                        <ul className="mb-1 ml-4 mt-1 space-y-0.5 text-xs">
                          {c.recipes.map((r) => (
                            <li key={r.name} className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: colorOf(r.name) }}
                                />
                                <span className="truncate">{r.name}</span>
                              </span>
                              <span className="shrink-0">{r.total}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted">Touche un client pour voir le détail par goût.</p>
            </div>
          </div>

          {/* Évolution : barres empilées. La hauteur de chaque barre = le total
              de la période (affiché au-dessus), les couleurs = le détail par goût.
              Plus besoin d'une courbe "Total" qui écrasait l'échelle. */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Évolution des volumes</h2>
              <div className="flex rounded-full border border-border bg-white p-0.5 text-xs">
                {(["semaine", "mois"] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`rounded-full px-3 py-1 ${period === p ? "bg-accent text-accent-foreground" : ""}`}
                  >
                    Par {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white/60 p-4">
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 18, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="period" tickFormatter={formatPeriod} fontSize={11} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    {visibleRecipes.map((name) => (
                      <Bar key={name} dataKey={name} stackId="total" fill={colorOf(name)} maxBarSize={36}>
                        {name === lastRecipe && (
                          <LabelList
                            content={(props: {
                              x?: number | string;
                              y?: number | string;
                              width?: number | string;
                              index?: number;
                            }) => {
                              const x = Number(props.x ?? 0);
                              const y = Number(props.y ?? 0);
                              const width = Number(props.width ?? 0);
                              const index = props.index ?? 0;
                              const total = Number(series[index]?.Total ?? 0);
                              if (!total) return null;
                              return (
                                <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="#23201b">
                                  {total}
                                </text>
                              );
                            }}
                          />
                        )}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {visibleRecipes.map((name) => (
                  <span key={name} className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(name) }} />
                    {name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {period === "semaine" ? `${MAX_PERIODS} dernières semaines` : `${MAX_PERIODS} derniers mois`} · le chiffre au-dessus de
                chaque barre est le total de la période · touche une barre pour le détail.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
