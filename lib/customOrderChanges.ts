import type { CustomOrderContent } from "@/lib/types";

export type CustomOrderChange = { label: string; before: string; after: string };

// "2026-11-12" -> "12/11/2026"
export function formatDesiredDate(date: string | null): string {
  if (!date) return "non précisée";
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

// Différences entre la demande initiale du client et la demande telle que
// le producteur la valide (liste vide si rien n'a changé).
export function diffCustomOrder(
  original: CustomOrderContent | null,
  current: CustomOrderContent
): CustomOrderChange[] {
  if (!original) return [];
  const changes: CustomOrderChange[] = [];
  if (original.recipe_name.trim() !== current.recipe_name.trim()) {
    changes.push({ label: "Goût", before: original.recipe_name.trim(), after: current.recipe_name.trim() });
  }
  if (original.quantity !== current.quantity) {
    changes.push({ label: "Quantité", before: String(original.quantity), after: String(current.quantity) });
  }
  if ((original.desired_date ?? null) !== (current.desired_date ?? null)) {
    changes.push({
      label: "Date souhaitée",
      before: formatDesiredDate(original.desired_date ?? null),
      after: formatDesiredDate(current.desired_date ?? null),
    });
  }
  if ((original.details ?? "").trim() !== (current.details ?? "").trim()) {
    changes.push({
      label: "Précisions",
      before: (original.details ?? "").trim() || "aucune",
      after: (current.details ?? "").trim() || "aucune",
    });
  }
  return changes;
}
