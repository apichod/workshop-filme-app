import { supabaseAdmin } from './supabase';

// ─── Constantes métier — workshops du samedi ─────────────────────────────────

export const CAPACITY = 10; // nombre max de participants avant qu'une session soit fermée
export const VALIDATION_THRESHOLD = 4; // nombre d'inscrits à partir duquel une session est validée
export const PRICE_LABEL = '149 € HT';

// Catégories disponibles pour le badge de chaque formation (une seule par formation).
export const TOPIC_CATEGORIES = ['Image', 'Lumière', 'Machinerie', 'Audio', 'Régie vidéo'];

// Type d'événement (une seule valeur par formation) — affiché en haut de la carte
// à la place du "Formation" fixe.
export const TOPIC_TYPES = ['Formation', 'Workshop', 'Démo', 'Meetup'];

// Planning proposé pour l'inscription à une formation : soit un jour de la
// semaine récurrent (les prochains mercredis/vendredis/samedis à venir, comme
// une liste de créneaux), soit une date fixe unique (n'importe quel jour).
export const SCHEDULE_OPTIONS = [
  { value: 'wednesday', label: 'Tous les mercredis', weekday: 3, plural: 'Mercredis' },
  { value: 'friday', label: 'Tous les vendredis', weekday: 5, plural: 'Vendredis' },
  { value: 'saturday', label: 'Tous les samedis', weekday: 6, plural: 'Samedis' },
  { value: 'fixed', label: 'Date fixe', weekday: null, plural: 'Dates' },
];

export function scheduleOption(scheduleMode) {
  return SCHEDULE_OPTIONS.find((o) => o.value === scheduleMode) || SCHEDULE_OPTIONS[2]; // samedi par défaut
}

// Jour de la semaine (0=dimanche...6=samedi) associé au planning d'une
// formation ; null si la formation est en date fixe.
export function topicWeekday(topic) {
  return scheduleOption(topic?.scheduleMode || 'saturday').weekday;
}

// Formate le prix affiché publiquement : "Gratuit" si le prix vaut 0 (sous
// toutes ses formes : "0", "0€", "0 € HT"…), sinon le prix de la formation, ou
// le tarif global par défaut si aucun n'est renseigné.
export function formatPrice(price) {
  const trimmed = (price ?? '').toString().trim();
  if (!trimmed) return PRICE_LABEL;
  if (/^0([.,]0+)?\s*€?\s*(ht|ttc)?\.?$/i.test(trimmed)) return 'Gratuit';
  return trimmed;
}

// Extrait une valeur numérique d'un prix (libre) pour permettre un tri
// croissant/décroissant — ex. "149 € HT" → 149, "" → valeur du tarif global.
export function parsePriceValue(price) {
  const trimmed = (price ?? '').toString().trim();
  const source = trimmed || PRICE_LABEL;
  const match = source.replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

// ─── Formations (topics) ──────────────────────────────────────────────────────
// Stockées dans Supabase (table workshop_topics, cf. supabase_topics_migration.sql)
// — éditables, créables et archivables depuis /admin/topics.

function mapTopic(row) {
  return {
    id: row.id,
    title: row.title,
    level: row.level || '',
    desc: row.description || '', // résumé affiché sur la carte homepage
    fullDescription: row.full_description || '', // descriptif complet (détail public)
    program: row.program || '', // programme (détail public)
    price: row.price || '', // prix spécifique à la formation (sinon prix global)
    duration: row.duration || '', // durée spécifique (sinon "1 journée (9h–18h)")
    category: row.category || '', // badge de catégorie (Image, Lumière, Machinerie, Audio, Régie vidéo)
    type: row.type || 'Formation', // Formation / Workshop / Démo / Meetup — affiché en haut de la carte
    bonus: row.bonus || '', // "Bonus exclusif" optionnel affiché en avant sur la carte + détail
    maxParticipants: row.max_participants ?? null, // nombre de places max spécifique (sinon CAPACITY global)
    equipment: row.equipment || '', // matériel mis à disposition (détail public)
    minParticipants: row.min_participants ?? null, // seuil de validation spécifique (sinon VALIDATION_THRESHOLD global) — 0 = priorité totale
    scheduleMode: row.schedule_mode || 'saturday', // 'wednesday' | 'friday' | 'saturday' | 'fixed'
    fixedDate: row.fixed_date || null, // date fixe (n'importe quel jour), utilisée seulement si scheduleMode === 'fixed' — réserve la date en exclusivité
    formateurId: row.formateur_id || null, // formateur qui anime la formation (cf. lib/formateurs.js)
    archived: !!row.archived,
    sortOrder: row.sort_order,
    createdAt: row.created_at || null, // pour le tri "Nouveautés"
  };
}

// Formations visibles publiquement (homepage, formulaire d'inscription)
export async function getVisibleTopics() {
  const { data, error } = await supabaseAdmin
    .from('workshop_topics')
    .select('*')
    .eq('archived', false)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapTopic);
}

// Toutes les formations, y compris archivées — pour l'admin et pour retrouver
// le titre d'une session déjà créée même si sa formation a depuis été archivée.
export async function getAllTopics() {
  const { data, error } = await supabaseAdmin
    .from('workshop_topics')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapTopic);
}

export async function getTopicById(id) {
  const { data, error } = await supabaseAdmin
    .from('workshop_topics')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTopic(data) : null;
}

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // enlève les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

const VALID_SCHEDULE_MODES = SCHEDULE_OPTIONS.map((o) => o.value);

export async function createTopic({ title, level, desc, fullDescription, program, price, duration, category, type, bonus, maxParticipants, equipment, minParticipants, scheduleMode, fixedDate, formateurId }) {
  const baseId = slugify(title) || `formation-${Date.now()}`;
  let id = baseId;
  let i = 2;
  // Évite les collisions d'id si deux formations ont un titre très proche
  while (await getTopicById(id)) {
    id = `${baseId}-${i}`;
    i++;
  }

  const { data: maxRow } = await supabaseAdmin
    .from('workshop_topics')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order || 0) + 1;

  const cleanScheduleMode = VALID_SCHEDULE_MODES.includes(scheduleMode) ? scheduleMode : 'saturday';
  // La date fixe n'a de sens qu'en planning "Date fixe" — on l'ignore sinon,
  // pour ne jamais laisser une réservation fantôme sur un autre mode.
  const cleanFixedDate = cleanScheduleMode === 'fixed' ? (fixedDate || null) : null;

  const { data, error } = await supabaseAdmin
    .from('workshop_topics')
    .insert({
      id,
      title,
      level,
      description: desc,
      full_description: fullDescription || '',
      program: program || '',
      price: price || '',
      duration: duration || '',
      category: category || '',
      type: type || 'Formation',
      bonus: bonus || '',
      max_participants: Number.isFinite(maxParticipants) ? maxParticipants : null,
      equipment: equipment || '',
      min_participants: Number.isFinite(minParticipants) ? minParticipants : null,
      schedule_mode: cleanScheduleMode,
      fixed_date: cleanFixedDate,
      formateur_id: formateurId || null,
      archived: false,
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return mapTopic(data);
}

export async function updateTopic(id, fields) {
  const patch = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.level !== undefined) patch.level = fields.level;
  if (fields.desc !== undefined) patch.description = fields.desc;
  if (fields.fullDescription !== undefined) patch.full_description = fields.fullDescription;
  if (fields.program !== undefined) patch.program = fields.program;
  if (fields.price !== undefined) patch.price = fields.price;
  if (fields.duration !== undefined) patch.duration = fields.duration;
  if (fields.category !== undefined) patch.category = fields.category;
  if (fields.type !== undefined) patch.type = fields.type;
  if (fields.bonus !== undefined) patch.bonus = fields.bonus;
  if (fields.maxParticipants !== undefined) patch.max_participants = Number.isFinite(fields.maxParticipants) ? fields.maxParticipants : null;
  if (fields.equipment !== undefined) patch.equipment = fields.equipment;
  if (fields.minParticipants !== undefined) patch.min_participants = Number.isFinite(fields.minParticipants) ? fields.minParticipants : null;
  // La date fixe n'a de sens qu'en planning "Date fixe" : si le planning
  // change vers un autre mode, on efface toute date fixe résiduelle pour ne
  // pas laisser une réservation fantôme.
  if (fields.scheduleMode !== undefined) {
    const cleanMode = VALID_SCHEDULE_MODES.includes(fields.scheduleMode) ? fields.scheduleMode : 'saturday';
    patch.schedule_mode = cleanMode;
    if (cleanMode !== 'fixed') patch.fixed_date = null;
    else if (fields.fixedDate !== undefined) patch.fixed_date = fields.fixedDate || null;
  } else if (fields.fixedDate !== undefined) {
    patch.fixed_date = fields.fixedDate || null;
  }
  if (fields.formateurId !== undefined) patch.formateur_id = fields.formateurId || null;
  if (fields.archived !== undefined) patch.archived = fields.archived;

  const { data, error } = await supabaseAdmin
    .from('workshop_topics')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? mapTopic(data) : null;
}

// Réorganisation manuelle (glisser-déposer, mode admin, tri "En vedette") :
// réassigne sort_order = position dans le tableau reçu, pour TOUTES les
// formations listées (l'appelant envoie systématiquement l'ordre complet, pas
// seulement les formations déplacées).
export async function reorderTopics(orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabaseAdmin.from('workshop_topics').update({ sort_order: index }).eq('id', id)
    )
  );
}

// Suppression définitive — active ou archivée, mais seulement si aucune
// session (passée ou à venir) ne la référence encore (sinon on perdrait la
// possibilité d'afficher le titre de ces sessions ailleurs dans l'admin, cf.
// getAllTopics). Dans ce cas, on invite à archiver la formation plutôt que de
// la supprimer (les sessions déjà ouvertes restent visibles).
export async function deleteTopic(id) {
  const topic = await getTopicById(id);
  if (!topic) return { ok: false, error: 'not_found' };

  const { count, error: countErr } = await supabaseAdmin
    .from('workshop_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', id);
  if (countErr) throw countErr;
  if ((count || 0) > 0) return { ok: false, error: 'has_sessions' };

  const { error } = await supabaseAdmin.from('workshop_topics').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}

// ─── Import JSON en masse (export/import "log" depuis l'admin) ───────────────
// Met à jour la formation si son id existe déjà, sinon la crée (avec l'id
// fourni si possible, pour permettre un aller-retour export → import fidèle).
export async function importTopic(t) {
  if (!t || !t.title || !String(t.title).trim()) throw new Error('Titre manquant');

  const id = (t.id && String(t.id).trim()) || slugify(t.title) || `formation-${Date.now()}`;
  const importedScheduleMode = t.scheduleMode || t.schedule_mode;
  const cleanScheduleMode = VALID_SCHEDULE_MODES.includes(importedScheduleMode) ? importedScheduleMode : 'saturday';
  const patch = {
    title: t.title,
    level: t.level || '',
    description: t.desc ?? t.description ?? t.summary ?? '',
    full_description: t.fullDescription ?? t.full_description ?? '',
    program: t.program || '',
    price: t.price || '',
    duration: t.duration || '',
    category: t.category || '',
    type: t.type || 'Formation',
    bonus: t.bonus || '',
    max_participants: Number.isFinite(t.maxParticipants ?? t.max_participants) ? (t.maxParticipants ?? t.max_participants) : null,
    equipment: t.equipment || '',
    min_participants: Number.isFinite(t.minParticipants ?? t.min_participants) ? (t.minParticipants ?? t.min_participants) : null,
    schedule_mode: cleanScheduleMode,
    fixed_date: cleanScheduleMode === 'fixed' ? (t.fixedDate || t.fixed_date || null) : null,
    formateur_id: t.formateurId || t.formateur_id || null,
    archived: !!t.archived,
  };

  const existing = await getTopicById(id);

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('workshop_topics')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { id, action: 'updated', topic: mapTopic(data) };
  }

  const { data: maxRow } = await supabaseAdmin
    .from('workshop_topics')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = Number.isFinite(t.sortOrder) ? t.sortOrder : (maxRow?.sort_order || 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('workshop_topics')
    .insert({ id, ...patch, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return { id, action: 'created', topic: mapTopic(data) };
}

// ─── Jours de la semaine à venir (samedi, mais aussi mercredi/vendredi) ──────

// `excluded` : dates fermées aux inscriptions (préférences admin, cf.
// lib/closedDates.js). On continue à avancer semaine après semaine jusqu'à
// obtenir `count` occurrences réellement ouvertes de ce jour de la semaine.
export function nextWeekdayDates(weekday, count = 8, excluded = []) {
  const excludedSet = new Set(excluded);
  const dates = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff)); // prochaine occurrence à venir
  // Garde-fou : ne boucle pas indéfiniment si (par erreur) toutes les dates
  // à venir étaient fermées.
  let safety = count + excludedSet.size + 260;
  while (dates.length < count && safety-- > 0) {
    const iso = isoDate(d);
    if (!excludedSet.has(iso)) dates.push(iso);
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

// Conservé pour compatibilité (préférences admin "samedis fermés", toujours
// centrées sur le samedi quel que soit le planning des formations).
export function nextSaturdays(count = 8, excluded = []) {
  return nextWeekdayDates(6, count, excluded);
}

// Liste "brute" des samedis à venir (sans exclusion) — utilisée par la popup
// admin "Préférences" pour afficher un an de samedis à inclure/exclure.
export function yearSaturdays(weeks = 52) {
  const dates = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  for (let i = 0; i < weeks; i++) {
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

export function isValidWeekdayDate(dateIso, weekday) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso || '')) return false;
  const d = new Date(`${dateIso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getDay() === weekday && d >= today;
}

export function isValidSaturday(dateIso) {
  return isValidWeekdayDate(dateIso, 6);
}

export function formatSaturday(dateIso) {
  const d = new Date(`${dateIso}T00:00:00`);
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
