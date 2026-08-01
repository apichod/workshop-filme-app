// Coin "utilisateur" en haut à droite, affiché pour tout le monde (client ou
// admin) — distinct du bandeau Admin (AdminBar) qui, lui, ne s'affiche qu'en
// plus, pour les administrateurs, et se concentre sur les outils d'admin
// (recherche client, préférences).
export default function UserBar({ session }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 16,
        zIndex: 60,
        background: '#fff',
        border: '1px solid rgba(20,2,2,0.12)',
        borderRadius: 100,
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12.5,
        boxShadow: '0 2px 10px rgba(20,2,2,0.08)',
      }}
    >
      {session ? (
        <>
          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{session.name || session.email}</span>
          <a href="/mes-inscriptions" className="link-btn">Mes inscriptions</a>
          <a href="/api/logout" className="link-btn">Déconnexion</a>
        </>
      ) : (
        <a href="/login" className="btn btn-primary btn-sm">Connexion</a>
      )}
    </div>
  );
}
