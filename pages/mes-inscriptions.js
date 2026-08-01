import { useEffect, useState } from 'react';
import Head from 'next/head';
import { withClientAuth } from '../lib/auth';
import UserBar from '../components/UserBar';

export default function MyRegistrations({ session }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    fetch('/api/my/registrations')
      .then((r) => r.json())
      .then((d) => setItems(d.registrations || []))
      .catch(() => setError('Impossible de charger vos inscriptions'));
  }, []);

  async function cancel(reg) {
    if (!window.confirm(`Annuler votre inscription à « ${reg.topicTitle} » du ${reg.dateLabel} ?`)) return;
    setRemovingId(reg.id);
    setError('');
    try {
      const res = await fetch(`/api/my/registrations/${reg.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setItems((list) => list.filter((r) => r.id !== reg.id));
      setCancelled(true);
      setTimeout(() => setCancelled(false), 3000);
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Mes inscriptions — Workshops Filme</title>
        <meta name="robots" content="noindex" />
      </Head>
      <UserBar session={session} />

      <div className="page" style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px 60px' }}>
        <div className="brand-crumb">
          <a href="https://www.filme.fr" title="Retour à filme.fr">
            <img src="https://www.filme.fr/cdn/shop/files/Filme-Logo-sd.svg?v=1707646401&width=120" alt="Filme" className="logo" />
          </a>
          <nav className="breadcrumb"><a href="https://www.filme.fr">Home</a> {'>'} Workshops</nav>
        </div>
        <div className="page-header">
          <h1>Mes inscriptions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Connecté en tant que <strong>{session.name || session.email}</strong>.
          </p>
        </div>

        {error && <div className="form-error">{error}</div>}
        {cancelled && <div className="form-success">Inscription annulée.</div>}
        {!items && !error && <div className="loading">Chargement…</div>}

        {items && items.length === 0 && (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">📅</div>
              Vous n'avez aucune inscription à venir.
            </div>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="card">
            {items.map((r) => (
              <div
                key={r.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.topicTitle}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                    {r.dateLabel}{' '}
                    <span className={`badge ${r.validated ? 'badge-green' : 'badge-amber'}`} style={{ marginLeft: 6 }}>
                      {r.validated ? '✅ Validée' : 'En attente de validation'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={removingId === r.id}
                  onClick={() => cancel(r)}
                >
                  {removingId === r.id ? '…' : 'Annuler'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export const getServerSideProps = withClientAuth(async (ctx) => {
  return { props: { session: ctx.client } };
});
