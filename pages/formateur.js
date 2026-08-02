import { useEffect, useState } from 'react';
import Head from 'next/head';
import { withFormateurAuth } from '../lib/auth';
import { CAPACITY } from '../lib/topics';
import UserBar from '../components/UserBar';

export default function FormateurDashboard({ session }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/formateur/sessions')
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(() => setError('Impossible de charger vos sessions'));
  }, []);

  return (
    <>
      <Head>
        <title>Espace formateur — Workshops Filme</title>
        <meta name="robots" content="noindex" />
      </Head>
      <UserBar session={session} />

      <div className="page" style={{ maxWidth: 820, margin: '0 auto', padding: '80px 24px 60px' }}>
        <div className="brand-crumb">
          <a href="https://www.filme.fr" title="Retour à filme.fr">
            <img src="https://www.filme.fr/cdn/shop/files/Filme-Logo-sd.svg?v=1707646401&width=120" alt="Filme" className="logo" />
          </a>
          <nav className="breadcrumb"><a href="https://www.filme.fr">Home</a> {'>'} Événements</nav>
        </div>
        <div className="page-header">
          <h1>Mes sessions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Connecté en tant que <strong>{session.name || session.email}</strong> — sessions à venir des formations qui vous sont assignées.
          </p>
        </div>

        {error && <div className="form-error">{error}</div>}
        {!sessions && !error && <div className="loading">Chargement…</div>}

        {sessions && sessions.length === 0 && (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">📅</div>
              Aucune session à venir pour le moment.
            </div>
          </div>
        )}

        {sessions && sessions.length > 0 && (
          <div className="card">
            {sessions.map((s) => (
              <div key={s.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.topic?.title || s.topicId}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                      {s.dateLabel}{' '}
                      <span className={`badge ${s.validated ? 'badge-green' : 'badge-amber'}`} style={{ marginLeft: 6 }}>
                        {s.validated ? '✅ Confirmée' : 'En attente de validation'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {s.registrants.length}/{s.topic?.maxParticipants || CAPACITY} inscrits
                  </div>
                </div>
                {s.registrants.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {s.registrants.map((r) => (
                      <div key={r.id} style={{ fontSize: 13, color: 'var(--text)' }}>
                        {r.name} <span style={{ color: 'var(--text-muted)' }}>· {r.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export const getServerSideProps = withFormateurAuth(async (ctx) => {
  return { props: { session: ctx.formateur } };
});
