import { supabaseAdmin } from '../../lib/supabase';
import { getCustomerByEmail } from '../../lib/booqable';
import { sendWorkshopConfirmation, sendWorkshopValidated } from '../../lib/mailer';
import { CAPACITY, getTopicById, isValidSaturday, formatSaturday } from '../../lib/topics';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { topicId, dateIso, name, email } = req.body || {};

  if (!isValidSaturday(dateIso)) return res.status(400).json({ error: 'Merci de choisir un samedi à venir' });
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: 'Nom et email requis' });

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const topic = await getTopicById(topicId);
    if (!topic) return res.status(400).json({ error: 'Formation inconnue' });

    // ─── Vérification "client Filme" via Booqable (même lib que monespace.filme.fr) ───
    const customer = await getCustomerByEmail(normalizedEmail);
    if (!customer) return res.status(403).json({ error: 'no_account' });

    // ─── Récupère ou crée la session (topic + samedi) ───
    let { data: session, error: fetchErr } = await supabaseAdmin
      .from('workshop_sessions')
      .select('*')
      .eq('topic_id', topicId)
      .eq('session_date', dateIso)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    // Une formation archivée ne peut plus ouvrir de nouvelle session, mais on
    // n'annule pas les sessions déjà ouvertes avant son archivage.
    if (!session && topic.archived) {
      return res.status(400).json({ error: 'topic_archived' });
    }

    if (!session) {
      const { data: created, error: createErr } = await supabaseAdmin
        .from('workshop_sessions')
        .insert({ topic_id: topicId, session_date: dateIso })
        .select()
        .single();
      if (createErr) throw createErr;
      session = created;
    }

    if (session.validated) return res.status(409).json({ error: 'full' });

    const { count, error: countErr } = await supabaseAdmin
      .from('workshop_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);
    if (countErr) throw countErr;
    if ((count || 0) >= CAPACITY) return res.status(409).json({ error: 'full' });

    // ─── Inscription (unique par session+email, cf. supabase.sql) ───
    const { error: insertErr } = await supabaseAdmin
      .from('workshop_registrations')
      .insert({ session_id: session.id, customer_id: customer.id, name: name.trim(), email: normalizedEmail });

    if (insertErr) {
      if (insertErr.code === '23505') return res.status(409).json({ error: 'already_registered' });
      throw insertErr;
    }

    const newCount = (count || 0) + 1;
    const nowFull = newCount >= CAPACITY;
    const dateLabel = formatSaturday(dateIso);

    if (nowFull) {
      await supabaseAdmin.from('workshop_sessions').update({ validated: true }).eq('id', session.id);
      const { data: registrants } = await supabaseAdmin
        .from('workshop_registrations')
        .select('name, email')
        .eq('session_id', session.id);
      await sendWorkshopValidated(registrants || [], topic, dateLabel);
    } else {
      await sendWorkshopConfirmation(normalizedEmail, name.trim(), topic, dateLabel, CAPACITY - newCount);
    }

    return res.status(200).json({ ok: true, count: newCount, validated: nowFull });
  } catch (err) {
    console.error('[api/register]', err);
    return res.status(500).json({ error: 'Erreur serveur, réessayez.' });
  }
}
