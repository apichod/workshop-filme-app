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
    bio: row.bio || '',
    specialties: row.specialties || '', // liste libre séparée par des virgules, affichée en tags
    photoUrl: row.photo_url || '',
    createdAt: row.created_at || null,
  };
}

export async function getAllFormateurs() {
  const { data, error } = await supabaseAdmin
    .from('workshop_formateurs')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
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

export async function createFormateur({ name, email, bio, specialties, photoUrl }) {
  const baseId = slugify(name) || `formateur-${Date.now()}`;
  let id = baseId;
  let i = 2;
  while (await getFormateurById(id)) {
    id = `${baseId}-${i}`;
    i++;
  }

  const existing = await getFormateurByEmail(email);
  if (existing) throw new Error('Un formateur utilise déjà cet email');

  const { data, error } = await supabaseAdmin
    .from('workshop_formateurs')
    .insert({
      id,
      name,
      email: (email || '').trim().toLowerCase(),
      bio: bio || '',
      specialties: specialties || '',
      photo_url: photoUrl || '',
    })
    .select()
    .single();
  if (error) throw error;
  return mapFormateur(data);
}

export async function updateFormateur(id, fields) {
  const patch = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.email !== undefined) patch.email = (fields.email || '').trim().toLowerCase();
  if (fields.bio !== undefined) patch.bio = fields.bio;
  if (fields.specialties !== undefined) patch.specialties = fields.specialties;
  if (fields.photoUrl !== undefined) patch.photo_url = fields.photoUrl;

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
