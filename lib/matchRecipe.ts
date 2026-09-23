// Rapproche un nom de recette saisi librement (demande "sur commande")
// d'une recette du catalogue, pour pré-sélectionner la bonne recette.
// Ex : "gingembre citron" -> "Kombucha Gingembre-Citron".

export function normalizeRecipeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .toLowerCase()
    .replace(/kombucha/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findMatchingRecipe<T extends { id: string; name: string }>(
  requestedName: string,
  recipes: T[]
): T | undefined {
  const target = normalizeRecipeName(requestedName);
  if (!target) return undefined;
  return (
    recipes.find((r) => normalizeRecipeName(r.name) === target) ??
    recipes.find((r) => {
      const n = normalizeRecipeName(r.name);
      return n.length > 0 && (n.includes(target) || target.includes(n));
    })
  );
}
