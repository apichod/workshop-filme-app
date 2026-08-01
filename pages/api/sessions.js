import { getOpenSessions } from '../../lib/sessions';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const sessions = await getOpenSessions();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('[api/sessions]', err);
    return res.status(500).json({ error: err.message });
  }
}
