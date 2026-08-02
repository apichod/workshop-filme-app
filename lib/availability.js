// ─── Disponibilité (salle de cours ou formateur) ─────────────────────────────
// La salle de cours (cf. lib/content.js, clé classroom_availability_json) et
// chaque formateur (cf. lib/formateurs.js, colonne availability) partagent
// exactement la même forme, éditée par le même composant (AvailabilityEditor,
// pages/index.js) :
//   {
//     lundi: [{ start, end }], mardi: [...], ..., dimanche: [...],  // créneaux hebdomadaires (indicatifs)
//     dates: ['2026-08-15', ...],           // dates ponctuelles cochées "disponible"
//     dateOverrides: [{ date, start, end }] // dates avec un horaire particulier
//   }
// Une date est "disponible" si elle a une date spécifique (dateOverrides), ou
// si elle est cochée dans `dates` — les créneaux hebdomadaires ne servent qu'à
// proposer un horaire par défaut, ils ne rendent pas une date disponible à eux
// seuls (il faut la cocher explicitement dans le calendrier).

export function isDateAvailable(availability, dateIso) {
  if (!availability) return false;
  const overrides = availability.dateOverrides || [];
  if (overrides.some((o) => o.date === dateIso)) return true;
  return (availability.dates || []).includes(dateIso);
}

// Lit une disponibilité stockée en JSON (texte) — objet vide (jamais
// d'exception) si absent/invalide.
export function parseAvailability(raw) {
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

// Une date est disponible pour une formation si la salle ET tous les
// formateurs qui lui sont assignés sont disponibles ce jour-là. Une formation
// sans formateur assigné (cas normalement empêché à la création) n'est
// bloquée que par la salle, pour ne pas la rendre indisponible par erreur de
// données.
export function isTopicDateAvailable({ roomAvailability, formateurs, dateIso }) {
  if (!isDateAvailable(roomAvailability, dateIso)) return false;
  return (formateurs || []).every((f) => isDateAvailable(f?.availability, dateIso));
}
