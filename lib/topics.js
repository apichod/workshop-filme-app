// ─── Constantes métier — workshops du samedi ─────────────────────────────────

export const CAPACITY = 6;
export const PRICE_LABEL = '149 € HT';

export const TOPICS = [
  {
    id: 'ronin4d',
    title: "Ronin 4D – Prise en main complète",
    level: 'Débutant à intermédiaire',
    desc: "Prise en main du DJI Ronin 4D : configuration, équilibrage, mise au point, modes de stabilisation, mouvements de caméra, bonnes pratiques de tournage et exercices en conditions réelles. Bon d'achat de 150 € HT sur votre 1ère location Ronin 4D chez Filme (valable 3 mois).",
  },
  {
    id: 'rs3pro',
    title: 'DJI RS 3 Pro – Stabilisation gimbal caméra',
    level: 'Débutant',
    desc: "Montage caméra, équilibrage rapide, modes de suivi et mouvements fluides avec le gimbal DJI RS 3 Pro, en conditions réelles de tournage.",
  },
  {
    id: 'fpv',
    title: 'Drone FPV cinématique – Pilotage & prises de vue',
    level: 'Intermédiaire',
    desc: "Bases du pilotage FPV, réglages caméra/nacelle, trajectoires et sécurité, pour intégrer des plans FPV à vos tournages.",
  },
  {
    id: 'blackmagic',
    title: 'Blackmagic Cinema Camera – Réglages & workflow',
    level: 'Débutant à intermédiaire',
    desc: "Menus, profils d'image, formats RAW/ProRes, gestion des médias et export : le workflow complet caméra Blackmagic.",
  },
  {
    id: 'aputure',
    title: 'Éclairage Aputure – Bases de la lumière sur plateau',
    level: 'Débutant',
    desc: "Placement de sources, températures de couleur, softbox et modificateurs, pour construire une lumière propre rapidement.",
  },
  {
    id: 'resolve',
    title: 'DaVinci Resolve – Étalonnage niveau 1',
    level: 'Débutant à intermédiaire',
    desc: "Prise en main de la page Color : roues chromatiques, courbes, nodes, matching de plans et export final.",
  },
  {
    id: 'son',
    title: 'Prise de son plateau – Perches, HF & enregistreurs',
    level: 'Débutant',
    desc: "Choix du micro selon la situation, réglages de gain, synchro son/image et bonnes pratiques sur plateau.",
  },
  {
    id: 'inspire3',
    title: 'DJI Inspire 3 – Prise en main drone cinéma',
    level: 'Intermédiaire',
    desc: "Configuration double opérateur, réglages caméra, planification de vol et prises de vue cinéma en extérieur.",
  },
  {
    id: 'travelling',
    title: 'Motorisation & travelling – Sliders, dolly, stabilisation',
    level: 'Débutant',
    desc: "Comparatif et prise en main des solutions mécaniques : slider motorisé, dolly, stabilisateurs, pour des mouvements de caméra fluides sans gimbal.",
  },
  {
    id: 'multicam',
    title: 'Multicam & streaming live – Régie légère',
    level: 'Intermédiaire',
    desc: "Montage d'une régie légère multicaméra pour captation d'évènement et diffusion live : switch, encodage, retours son/image.",
  },
];

export function topicById(id) {
  return TOPICS.find((t) => t.id === id) || null;
}

// ─── Samedis à venir ──────────────────────────────────────────────────────────

export function nextSaturdays(count = 8) {
  const dates = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (6 - d.getDay() + 7) % 7; // 6 = samedi
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff)); // prochain samedi à venir
  for (let i = 0; i < count; i++) {
    dates.push(isoDate(d));
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

export function isoDate(d) {
  // Ne jamais utiliser toISOString() ici : elle convertit en UTC et décale
  // la date d'un jour dans les fuseaux horaires en avance sur UTC (France
  // incluse), ce qui transformait "samedi" en "vendredi" côté navigateur.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isValidSaturday(dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso || '')) return false;
  const d = new Date(`${dateIso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getDay() === 6 && d >= today;
}

export function formatSaturday(dateIso) {
  const d = new Date(`${dateIso}T00:00:00`);
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
