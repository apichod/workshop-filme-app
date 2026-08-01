import { requireAuth } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { VALIDATION_THRESHOLD } from '../../../../lib/topics';

// Retrait manuel d'un inscrit par l'admin (ex: erreur d'inscription, désistement
// signalé par téléphone…). Si le nombre d'inscrits repasse sous le seuil de
// validation, la session est remise en "non validée" pour rester cohérente
// avec le reste du site (badge, couleur de la barre, emails de confirmation).
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { id } = req.query;

  try {
    const { data: reg, error: fetchErr } = await supabaseAdmin
      .from('workshop_registrations')
      .select('id, session_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!reg) return res.status(404).json({ error: 'Inscription introuvable' });

    const { error: delErr } = await supabaseAdmin.from('workshop_registrations').delete().eq('id', id);
    if (delErr) throw delErr;

    const { count, error: countErr } = await supabaseAdmin
      .from('workshop_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', reg.session_id);
    if (countErr) throw countErr;

    if ((count || 0) < VALIDATION_THRESHOLD) {
      await supabaseAdmin.from('workshop_sessions').update({ validated: false }).eq('id', reg.session_id);
    }

    return res.status(200).json({ ok: true, remainingCount: count || 0 });
  } catch (err) {
    console.error('[admin/registrations DELETE]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
