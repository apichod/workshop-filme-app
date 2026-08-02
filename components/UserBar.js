import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// Icône "compte" fixe en haut de page (aligné sur le pictogramme utilisé par
// filme.fr) — un clic ouvre un petit menu avec les entrées Se connecter /
// Mes formations / Déconnexion selon l'état de connexion.
export default function UserBar({ session }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={ref} className="user-menu">
      <button
        type="button"
        className="user-menu-icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Compte"
        aria-expanded={open}
      >
        <Icon name="user" size={22} />
      </button>

      {open && (
        <div className="user-menu-dropdown">
          {session ? (
            <>
              <div className="user-menu-label">{session.name || session.email}</div>
              <a href="/mes-inscriptions" className="user-menu-item">Mes formations</a>
              <a href="/api/logout" className="user-menu-item">Déconnexion</a>
            </>
          ) : (
            <a href="/login" className="user-menu-item">Se connecter</a>
          )}
        </div>
      )}
    </div>
  );
}
