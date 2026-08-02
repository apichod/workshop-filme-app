import { supabaseAdmin } from './supabase';

// ─── Formateurs ───────────────────────────────────────────────────────────────
// Stockés dans Supabase (table workshop_formateurs, cf.
// supabase_formateurs_migration.sql) — gérés depuis l'onglet "Formateurs" de
// la popup admin "Préférences". Chaque formateur a un email de connexion
// dédié (même mécanisme de lien magique que l'admin, cf. lib/auth.js et
// pages/api/login.js) : une fois connecté, il ne voit que les sessions des
// formations qui lui sont assignées (cf. pages/formateur.js).

function mapFormateur(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '', // usage interne (planification), non affiché publiquement
    bio: row.bio || '', // bio courte, affichée sur la carte
    bioLong: row.bio_long || '', // bio longue, affichée dans "En savoir plus"
    specialties: row.specialties || '', // liste libre séparée par des virgules, affichée en tags
    photoUrl: row.photo_url || '',
    availability: row.availability || {}, // { lundi: [{start,end}], ... } — usage interne
    archived: !!row.archived,
    sortOrder: row.sort_order, // ordre manuel (glisser-déposer), cf. supabase_formateurs_sort_order_migration.sql
    createdAt: row.created_at || null,
  };
}

// Repli si la colonne sort_order n'existe pas encore (migration
// supabase_formateurs_sort_order_migration.sql pas encore exécutée) — plutôt
// que de faire planter tout le chargement de la page (getServerSideProps
// englobe cet appel dans un Promise.all avec les sessions/formations), on se
// rabat sur l'ordre de création le temps que la migration soit appliquée.
async function selectFormateurs(filters) {
  let query = supabaseAdmin.from('workshop_formateurs').select('*');
  if (filters?.archived !== undefined) query = query.eq('archived', filters.archived);
  let { data, error } = await query.order('sort_order', { ascending: true });
  if (error?.code === '42703') {
    let fallbackQuery = supabaseAdmin.from('workshop_formateurs').select('*');
    if (filters?.archived !== undefined) fallbackQuery = fallbackQuery.eq('archived', filters.archived);
    ({ data, error } = await fallbackQuery.order('created_at', { ascending: true }));
  }
  if (error) throw error;
  return data;
}

// Tous les formateurs, y compris archivés — pour l'admin.
export async function getAllFormateurs() {
  const data = await selectFormateurs();
  return (data || []).map(mapFormateur);
}

// Formateurs visibles publiquement (section "Nos formateurs" en bas de page).
export async function getVisibleFormateurs() {
  const data = await selectFormateurs({ archived: false });
  return (data || []).map(mapFormateur);
}

export async function getFormateurById(id) {
  if (!id) return null;
  const { data, error } = await supabaseAdmin
    .from('workshop_formateurs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapFormateur(data) : null;
}

// Utilisé par la connexion (pages/api/login.js) pour reconnaître un email de
// formateur. Les emails sont toujours stockés en minuscules (cf.
// createFormateur/updateFormateur) : une comparaison stricte sur l'email
// normalisé suffit, et évite les pièges des wildcards ilike ("_" notamment,
// valide dans un email et interprété comme "un caractère quelconque").
export async function getFormateurByEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabaseAdmin
    .from('workshop_formateurs')
    .select('*')
    .eq('email', normalized)
    .maybeSingle();
  if (error) throw error;
  return data ? mapFormateur(data) : null;
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // enlève les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

export async function createFormateur({ name, email, phone, bio, bioLong, specialties, photoUrl, availability }) {
  const baseId = slugify(name) || `formateur-${Date.now()}`;
  let id = baseId;
  let i = 2;
  while (await getFormateurById(id)) {
    id = `${baseId}-${i}`;
    i++;
  }

  const existing = await getFormateurByEmail(email);
  if (existing) throw new Error('Un formateur utilise déjà cet email');

  const { data: maxRow } = await supabaseAdmin
    .from('workshop_formateurs')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from('workshop_formateurs')
    .insert({
      id,
      name,
      email: (email || '').trim().toLowerCase(),
      phone: phone || '',
      bio: bio || '',
      bio_long: bioLong || '',
      specialties: specialties || '',
      photo_url: photoUrl || '',
      availability: availability && typeof availability === 'object' ? availability : {},
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return mapFormateur(data);
}

// Réorganisation manuelle (glisser-déposer, mode admin) : réassigne
// sort_order = position dans le tableau reçu, pour tous les formateurs listés
// (l'appelant envoie systématiquement l'ordre complet).
export async function reorderFormateurs(orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabaseAdmin.from('workshop_formateurs').update({ sort_order: index }).eq('id', id)
    )
  );
}

export async function updateFormateur(id, fields) {
  const patch = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.email !== undefined) patch.email = (fields.email || '').trim().toLowerCase();
  if (fields.phone !== undefined) patch.phone = fields.phone;
  if (fields.bio !== undefined) patch.bio = fields.bio;
  if (fields.bioLong !== undefined) patch.bio_long = fields.bioLong;
  if (fields.specialties !== undefined) patch.specialties = fields.specialties;
  if (fields.photoUrl !== undefined) patch.photo_url = fields.photoUrl;
  if (fields.availability !== undefined) patch.availability = fields.availability && typeof fields.availability === 'object' ? fields.availability : {};
  if (fields.archived !== undefined) patch.archived = fields.archived;

  if (patch.email) {
    const existing = await getFormateurByEmail(patch.email);
    if (existing && existing.id !== id) throw new Error('Un formateur utilise déjà cet email');
  }

  const { data, error } = await supabaseAdmin
    .from('workshop_formateurs')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? mapFormateur(data) : null;
}

// Suppression bloquée si une formation (active ou archivée) lui est encore
// assignée — on invite à réassigner ces formations à un autre formateur avant
// de supprimer sa fiche.
export async function deleteFormateur(id) {
  const formateur = await getFormateurById(id);
  if (!formateur) return { ok: false, error: 'not_found' };

  const { count, error: countErr } = await supabaseAdmin
    .from('workshop_topics')
    .select('*', { count: 'exact', head: true })
    .eq('formateur_id', id);
  if (countErr) throw countErr;
  if ((count || 0) > 0) return { ok: false, error: 'has_topics' };

  const { error } = await supabaseAdmin.from('workshop_formateurs').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}
