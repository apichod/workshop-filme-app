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

// Popup "Mon profil" — profil client Booqable (nom, téléphone, adresse),
// consultable et modifiable directement depuis le site (cf. lib/booqable.js
// getCustomerProfile/updateCustomer, et pages/api/my/profile.js). L'email
// n'est volontairement pas modifiable ici (c'est l'identifiant de connexion).
function MyProfileModal({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/my/profile')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          if (data.error === 'no_account') setNotFound(true);
          else setError(data.error || 'Erreur');
          return;
        }
        setProfile(data.profile);
        setForm({
          name: data.profile.name || '',
          phone: data.profile.phone || '',
          address: {
            street1: data.profile.address?.street1 || '',
            zipcode: data.profile.address?.zipcode || '',
            city: data.profile.address?.city || '',
          },
        });
      })
      .catch(() => { if (!cancelled) setError('Impossible de charger votre profil'); });
    return () => { cancelled = true; };
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function setAddress(field, value) {
    setForm((f) => ({ ...f, address: { ...f.address, [field]: value } }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/my/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setProfile(data.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>Mon profil</h2>

        {notFound && (
          <div className="empty" style={{ marginTop: 16 }}>
            Aucun compte client Filme associé à cet email.
          </div>
        )}
        {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}
        {!profile && !notFound && !error && <div className="loading" style={{ marginTop: 16 }}>Chargement…</div>}

        {profile && form && (
          <form onSubmit={submit} style={{ marginTop: 16 }}>
            {saved && <div className="form-success" style={{ marginBottom: 12 }}>Profil mis à jour.</div>}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={profile.email} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Nom</label>
              <input className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone</label>
              <input className="form-input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="06 12 34 56 78" />
            </div>
            <div className="form-group">
              <label className="form-label">Adresse</label>
              <input
                className="form-input"
                value={form.address.street1}
                onChange={(e) => setAddress('street1', e.target.value)}
                placeholder="Numéro et rue"
                style={{ marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={form.address.zipcode}
                  onChange={(e) => setAddress('zipcode', e.target.value)}
                  placeholder="Code postal"
                  style={{ width: 110 }}
                />
                <input
                  className="form-input"
                  value={form.address.city}
                  onChange={(e) => setAddress('city', e.target.value)}
                  placeholder="Ville"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            {(profile.discountPct > 0 || profile.balanceDue > 0) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {profile.discountPct > 0 && <span className="badge badge-blue">Remise {profile.discountPct}%</span>}
                {profile.balanceDue > 0 && <span className="badge badge-amber">Solde dû : {profile.balanceDue.toFixed(2)} €</span>}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Fermer</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {(notFound || error) && (
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Icône "compte" fixe en haut de page (aligné sur le pictogramme utilisé par
// filme.fr) — un clic ouvre un petit menu avec les entrées Se connecter /
// Mon profil / Mes inscriptions / Déconnexion selon l'état de connexion.
export default function UserBar({ session }) {
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
                <>
                  <button
                    type="button"
                    className="user-menu-item"
                    onClick={() => { setShowProfile(true); setOpen(false); }}
                  >
                    Mon profil
                  </button>
                  <button
                    type="button"
                    className="user-menu-item"
                    onClick={() => { setShowRegistrations(true); setOpen(false); }}
                  >
                    Mes inscriptions
                  </button>
                </>
              )}
              <a href="/api/logout" className="user-menu-item">Déconnexion</a>
            </>
          ) : (
            <a href="/login" className="user-menu-item">Se connecter</a>
          )}
        </div>
      )}
    </div>
    {showProfile && <MyProfileModal onClose={() => setShowProfile(false)} />}
    {showRegistrations && <MyRegistrationsModal onClose={() => setShowRegistrations(false)} />}
    </>
  );
}
