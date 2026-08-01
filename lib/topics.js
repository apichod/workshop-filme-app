import { supabaseAdmin } from './supabase';

// ─── Constantes métier — workshops du samedi ─────────────────────────────────

export const CAPACITY = 10; // nombre max de participants avant qu'une session soit fermée
export const VALIDATION_THRESHOLD = 4; // nombre d'inscrits à partir duquel une session est validée
export const PRICE_LABEL = '149 € HT';

// Catégories disponibles pour le badge de chaque formation (une seule par formation).
export const TOPIC_CATEGORIES = ['Image', 'Lumière', 'Machinerie', 'Audio', 'Régie vidéo'];

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
    bonus: row.bonus || '', // "Bonus exclusif" optionnel affiché en avant sur la carte + détail
    archived: !!row.archived,
    sortOrder: row.sort_order,
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

export async function createTopic({ title, level, desc, fullDescription, program, price, duration, category, bonus }) {
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
      bonus: bonus || '',
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
  if (fields.bonus !== undefined) patch.bonus = fields.bonus;
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

// ─── Import JSON en masse (export/import "log" depuis l'admin) ───────────────
// Met à jour la formation si son id existe déjà, sinon la crée (avec l'id
// fourni si possible, pour permettre un aller-retour export → import fidèle).
export async function importTopic(t) {
  if (!t || !t.title || !String(t.title).trim()) throw new Error('Titre manquant');

  const id = (t.id && String(t.id).trim()) || slugify(t.title) || `formation-${Date.now()}`;
  const patch = {
    title: t.title,
    level: t.level || '',
    description: t.desc ?? t.description ?? t.summary ?? '',
    full_description: t.fullDescription ?? t.full_description ?? '',
    program: t.program || '',
    price: t.price || '',
    duration: t.duration || '',
    category: t.category || '',
    bonus: t.bonus || '',
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
