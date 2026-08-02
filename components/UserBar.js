import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// Popup "Mes inscriptions" — accessible depuis le menu compte, sur n'importe
// quelle page (cf. UserBar ci-dessous). Reprend le même style que les autres
// popups du site (modal-overlay/modal/card/empty/badge), au lieu de l'ancienne
// page dédiée /mes-inscriptions.
function MyRegistrationsModal({ onClose }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/my/registrations')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setItems(d.registrations || []); })
      .catch(() => { if (!cancelled) setError('Impossible de charger vos inscriptions'); });
    return () => { cancelled = true; };
  }, []);

  async function cancelRegistration(reg) {
    if (!window.confirm(`Annuler votre inscription à « ${reg.topicTitle} » du ${reg.dateLabel} ?`)) return;
    setRemovingId(reg.id);
    setError('');
    try {
      const res = await fetch(`/api/my/registrations/${reg.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setItems((list) => list.filter((r) => r.id !== reg.id));
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>Mes inscriptions</h2>

        {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}
        {!items && !error && <div className="loading" style={{ marginTop: 16 }}>Chargement…</div>}

        {items && items.length === 0 && (
          <div className="empty" style={{ marginTop: 16 }}>
            <div className="empty-icon">📅</div>
            Vous n'avez aucune inscription à venir.
          </div>
        )}

        {items && items.length > 0 && (
          <div style={{ marginTop: 16 }}>
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
                  onClick={() => cancelRegistration(r)}
                >
                  {removingId === r.id ? '…' : 'Annuler'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// Icône "compte" fixe en haut de page (aligné sur le pictogramme utilisé par
// filme.fr) — un clic ouvre un petit menu avec les entrées Se connecter /
// Mes inscriptions / Déconnexion selon l'état de connexion.
export default function UserBar({ session }) {
  const [open, setOpen] = useState(false);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <>
    <div ref={ref} className="user-menu">
      <button
        type="button"
        className="user-menu-icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Compte"
        aria-expanded={open}
      >
        <Icon name="user" size={30} />
      </button>

      {open && (
        <div className="user-menu-dropdown">
          {session ? (
            <>
              <div className="user-menu-label">{session.name || session.email}</div>
              {session.isFormateur ? (
                <a href="/formateur" className="user-menu-item">Mes sessions</a>
              ) : (
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => { setShowRegistrations(true); setOpen(false); }}
                >
                  Mes inscriptions
                </button>
              )}
              <a href="/api/logout" className="user-menu-item">Déconnexion</a>
            </>
          ) : (
            <a href="/login" className="user-menu-item">Se connecter</a>
          )}
        </div>
      )}
    </div>
    {showRegistrations && <MyRegistrationsModal onClose={() => setShowRegistrations(false)} />}
    </>
  );
}
