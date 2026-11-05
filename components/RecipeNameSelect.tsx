"use client";

import { useState } from "react";

const OTHER = "__autre__";

// Menu déroulant des goûts du catalogue (orthographe et ordre des mots
// garantis), avec une option « Autre » pour une saisie libre quand le goût
// demandé n'existe pas au catalogue. `value` est toujours le nom final.
export function RecipeNameSelect({
  value,
  onChange,
  names,
  required,
  ariaLabel,
  className = "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm",
  otherPlaceholder = "Nom du goût",
}: {
  value: string;
  onChange: (name: string) => void;
  names: string[];
  required?: boolean;
  ariaLabel?: string;
  className?: string;
  otherPlaceholder?: string;
}) {
  const match = names.find((n) => n.trim().toLowerCase() === value.trim().toLowerCase());
  // « Autre » est affiché si l'utilisateur l'a choisi, ou si le nom actuel
  // n'est pas dans le catalogue (ex : "miel" saisi à la main par un client).
  const [pickedOther, setPickedOther] = useState(false);
  const showOther = pickedOther || (value.trim() !== "" && !match);

  function handleSelect(selected: string) {
    if (selected === OTHER) {
      setPickedOther(true);
      if (match) onChange("");
    } else {
      setPickedOther(false);
      onChange(selected);
    }
  }

  return (
    <div className="space-y-2">
      <select
        aria-label={ariaLabel}
        value={showOther ? OTHER : (match ?? "")}
        onChange={(e) => handleSelect(e.target.value)}
        required={required}
        className={className}
      >
        <option value="">-- Choisis un goût --</option>
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={OTHER}>Autre (à préciser)</option>
      </select>
      {showOther && (
        <input
          type="text"
          aria-label={ariaLabel ? `${ariaLabel} (précision)` : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
          required={required}
          className={className}
        />
      )}
    </div>
  );
}
