import { requireAuth } from '../../../lib/auth';
import { getCustomerByEmail } from '../../../lib/booqable';
import { supabaseAdmin } from '../../../lib/supabase';
import { formatSaturday } from '../../../lib/topics';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email requis' });

  try {
    const customer = await getCustomerByEmail(email);

    const { data, error } = await supabaseAdmin
      .from('workshop_registrations')
      .select('id, name, email, created_at, workshop_sessions(session_date, validated, topic_id, workshop_topics(title))')
      .eq('email', email)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const registrations = (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      dateIso: r.workshop_sessions?.session_date || null,
      dateLabel: r.workshop_sessions?.session_date ? formatSaturday(r.workshop_sessions.session_date) : '—',
      validated: !!r.workshop_sessions?.validated,
      topicTitle: r.workshop_sessions?.workshop_topics?.title || r.workshop_sessions?.topic_id || '—',
    }));

    return res.status(200).json({ customer, registrations });
  } catch (err) {
    console.error('[admin/clients]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});
