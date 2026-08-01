import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { withAuth } from '../../lib/auth';
import AdminBar from '../../components/AdminBar';
import UserBar from '../../components/UserBar';

function fmtDT(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminHome({ admin }) {
  const router = useRouter();
  const email = typeof router.query.email === 'string' ? router.query.email : '';
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!email) { setResult(null); return; }
    setLoading(true);
    setError('');
    fetch(`/api/admin/clients?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setResult(d);
      })
      .catch(() => setError('Impossible de charger ce client'))
      .finally(() => setLoading(false));
  }, [email]);

  return (
    <>
      <Head>
        <title>Admin — Workshops Filme</title>
        <meta name="robots" content="noindex" />
      </Head>
      <AdminBar />
      <UserBar session={admin} />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div className="page-header">
          <h1>Consulter un client</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Entrez l'email d'un client dans le bandeau ci-dessus pour voir son profil Booqable et ses inscriptions aux workshops.
          </p>
        </div>

        {!email && (
          <div className="empty">
            <div className="empty-icon">🔍</div>
            Aucun client sélectionné pour l'instant.
          </div>
        )}

        {loading && <div className="loading">Chargement…</div>}
        {error && <div className="form-error">{error}</div>}

        {result && (
          <>
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <div className="card-title" style={{ padding: 0, border: 'none', marginBottom: 12 }}>Client</div>
              {result.customer ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
                  <div><strong>{result.customer.name}</strong></div>
                  <div style={{ color: 'var(--text-muted)' }}>{result.customer.email}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>ID Booqable : {result.customer.id}</div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>
                  Aucun client Booqable trouvé pour <strong>{email}</strong>. (Il/elle ne pourrait pas s'inscrire tant que cet email n'est pas rattaché à un compte client Filme.)
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Inscriptions aux workshops</div>
              {result.registrations.length === 0 ? (
                <div className="empty">Aucune inscription pour cet email</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Formation</th>
                      <th>Samedi</th>
                      <th>Statut session</th>
                      <th>Inscrit(e) le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.registrations.map((r) => (
                      <tr key={r.id}>
                        <td>{r.topicTitle}</td>
                        <td>{r.dateLabel}</td>
                        <td>
                          <span className={`badge ${r.validated ? 'badge-green' : 'badge-amber'}`}>
                            {r.validated ? 'Validée' : 'En attente'}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmtDT(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export const getServerSideProps = withAuth(async (ctx) => {
  return { props: { admin: ctx.admin } };
});
