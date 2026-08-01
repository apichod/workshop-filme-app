import { useState } from 'react';
import { useRouter } from 'next/router';

// Bandeau admin — repris du pattern AdminBar de portail-filme/pages/dashboard.js
// (recherche par email + navigation), adapté sans sidebar (pleine largeur ici).
export default function AdminBar({ email, onOpenPreferences }) {
  const router = useRouter();
  const [search, setSearch] = useState(router.query.email || '');

  function handleSearch(e) {
    e.preventDefault();
    const v = search.trim();
    router.push(v ? `/admin?email=${encodeURIComponent(v)}` : '/admin');
  }

  return (
    <div
      style={{
        background: '#fff',
        borderBottom: '1px solid rgba(20,2,2,0.12)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        Admin
      </span>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 240 }}>
        <input
          type="email"
          placeholder="Email client à consulter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input"
          style={{ maxWidth: 320 }}
        />
        <button type="submit" className="btn btn-primary btn-sm">Voir</button>
      </form>

      {onOpenPreferences && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenPreferences}>⚙️ Préférences</button>
      )}
      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{email}</span>
      <a href="/api/admin/logout" className="btn btn-ghost btn-sm">Déconnexion</a>
    </div>
  );
}
