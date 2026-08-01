import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getSession } from '../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const errorMsg = router.query.error === 'lien-invalide' ? 'Ce lien a expiré ou est invalide. Demandez-en un nouveau ci-dessous.' : '';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === 'no_account'
            ? "Cet email ne correspond à aucun compte client Filme. Vérifiez l'adresse utilisée pour vos locations, ou contactez-nous."
            : data.error || "Erreur lors de l'envoi"
        );
        return;
      }
      setSent(true);
    } catch {
      setError('Erreur réseau, réessayez');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Connexion — Workshops Filme</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="form-card">
          <div className="form-logo">
            <img src="https://www.filme.fr/cdn/shop/files/Filme-Logo-sd.svg?v=1707646401&width=120" alt="Filme" style={{ height: 28, display: 'block' }} />
          </div>
          <div className="form-tagline">Connexion à votre espace Workshops</div>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Vérifiez votre email</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Un lien de connexion vient d'être envoyé à <strong>{email}</strong>.<br />
                Il est valable 15 minutes.
              </p>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}
                onClick={() => setSent(false)}
              >
                Renvoyer un lien
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {(error || errorMsg) && <div className="form-error">{error || errorMsg}</div>}
              <div className="form-group">
                <label className="form-label">Email client Filme</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="jeanne@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
                {loading ? 'Envoi…' : 'Recevoir mon lien de connexion'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(ctx) {
  const session = getSession(ctx.req);
  if (session?.isAdmin) return { redirect: { destination: '/admin', permanent: false } };
  if (session) return { redirect: { destination: '/mes-inscriptions', permanent: false } };
  return { props: {} };
}
