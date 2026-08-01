import { useState } from 'react';
import Head from 'next/head';
import { getOpenSessions } from '../lib/sessions';
import { TOPICS, CAPACITY, PRICE_LABEL, nextSaturdays, formatSaturday } from '../lib/topics';

export default function Home({ initialSessions }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [modal, setModal] = useState(null); // { topicId, dateIso }
  const [form, setForm] = useState({ name: '', email: '' });
  const [status, setStatus] = useState({ loading: false, error: '', ok: '' });

  const saturdays = nextSaturdays(8);

  function openModal(topicId, dateIso) {
    setModal({ topicId: topicId || TOPICS[0].id, dateIso: dateIso || saturdays[0] });
    setForm({ name: '', email: '' });
    setStatus({ loading: false, error: '', ok: '' });
  }
  function closeModal() { setModal(null); }

  async function refreshSessions() {
    const res = await fetch('/api/sessions', { cache: 'no-store' });
    const data = await res.json();
    if (data.sessions) setSessions(data.sessions);
  }

  async function submit(e) {
    e.preventDefault();
    setStatus({ loading: true, error: '', ok: '' });
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: modal.topicId, dateIso: modal.dateIso, name: form.name, email: form.email }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg =
          data.error === 'no_account'
            ? "Cet email ne correspond à aucun client Filme connu. Vérifiez l'adresse utilisée pour vos locations, ou contactez-nous."
            : data.error === 'full'
            ? 'Cette session est déjà complète. Choisissez un autre samedi.'
            : data.error === 'already_registered'
            ? 'Cet email est déjà inscrit sur cette session.'
            : data.error || 'Erreur, réessayez.';
        setStatus({ loading: false, error: msg, ok: '' });
        return;
      }

      setStatus({
        loading: false,
        error: '',
        ok: data.validated
          ? "🎉 Inscription confirmée — la session vient d'atteindre 6 participants, la formation est validée !"
          : `Inscription confirmée. ${CAPACITY - data.count} place(s) restante(s) sur cette session.`,
      });
      await refreshSessions();
      setTimeout(closeModal, data.validated ? 2600 : 1600);
    } catch {
      setStatus({ loading: false, error: 'Erreur réseau, réessayez.', ok: '' });
    }
  }

  return (
    <>
      <Head>
        <title>Workshops Filme — Ateliers du samedi</title>
        <meta name="description" content="Ateliers pratiques du samedi chez Filme : prise en main du matériel de location, 149 € HT, 6 places maximum." />
      </Head>

      <div className="page">
        <header className="hero">
          <img src="https://www.filme.fr/cdn/shop/files/Filme-Logo-sd.svg?v=1707646401&width=140" alt="Filme" className="logo" />
          <h1>Les ateliers du samedi, avec le matériel que vous louez déjà.</h1>
          <p className="lead">
            Une journée 100% pratique (9h–18h) chez Filme à Montreuil, 6 participants maximum, pour prendre en main le
            matériel avant votre prochain tournage.
          </p>
          <div className="pill-row">
            <span className="pill price">{PRICE_LABEL} / personne</span>
            <span className="pill">6 places max par session</span>
            <span className="pill">Réservé aux clients Filme</span>
            <span className="pill">Validée dès 6 inscrits</span>
          </div>
        </header>

        <section className="section">
          <div className="section-head">
            <h2>Sessions ouvertes</h2>
            <span className="hint">Triées de la plus remplie (la plus susceptible d'être programmée) à la moins remplie</span>
          </div>
          <div className="card">
            {sessions.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📅</div>
                Aucune session pour le moment. Choisissez une formation ci-dessous pour proposer un samedi.
              </div>
            ) : (
              sessions.map((s) => {
                const pct = Math.min(100, Math.round(s.rate * 100));
                let badge = <span className="badge badge-gray">{CAPACITY - s.count} places dispo</span>;
                if (s.validated) badge = <span className="badge badge-green">✅ Formation validée</span>;
                else if (s.rate >= 0.5) badge = <span className="badge badge-amber">🔥 {CAPACITY - s.count} place(s) restante(s)</span>;

                return (
                  <div className="chart-row" key={s.id}>
                    <div className="meta">
                      <div className="topic-title">{s.topic.title}</div>
                      <div className="date-label">{s.dateLabel}</div>
                    </div>
                    <div className="bar-track">
                      <div className={`bar-fill ${s.validated ? 'full' : ''}`} style={{ width: `${pct}%` }} />
                      <div className="bar-label">{s.count}/{CAPACITY} inscrits · {pct}%</div>
                    </div>
                    <div className="action">
                      {badge}
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={s.validated}
                        onClick={() => openModal(s.topicId, s.dateIso)}
                      >
                        {s.validated ? 'Complet' : "S'inscrire"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Les 10 formations</h2>
            <span className="hint">Choisissez une formation pour proposer ou rejoindre un samedi</span>
          </div>
          <div className="topics-grid">
            {TOPICS.map((t, i) => (
              <div className="card topic-card" key={t.id}>
                <div className="idx">Formation {String(i + 1).padStart(2, '0')}</div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
                <div className="level">{t.level} · {PRICE_LABEL} · 1 journée (9h–18h)</div>
                <button className="btn btn-primary btn-sm" onClick={() => openModal(t.id, null)}>Choisir un samedi</button>
              </div>
            ))}
          </div>
        </section>

        <footer className="page-footer">
          Filme — Location de matériel audiovisuel · Montreuil · <a href="mailto:location@filme.fr">location@filme.fr</a>
        </footer>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <button className="modal-close" onClick={closeModal}>✕</button>
            <h2>S'inscrire à un workshop</h2>
            <div className="modal-sub">{PRICE_LABEL} — 6 places maximum</div>

            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">Formation</label>
                <select
                  className="form-input"
                  value={modal.topicId}
                  onChange={(e) => setModal({ ...modal, topicId: e.target.value })}
                >
                  {TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Samedi</label>
                <select
                  className="form-input"
                  value={modal.dateIso}
                  onChange={(e) => setModal({ ...modal, dateIso: e.target.value })}
                >
                  {saturdays.map((d) => (
                    <option key={d} value={d}>{formatSaturday(d)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nom complet</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Jeanne Dupont"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email client Filme</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="jeanne@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              {status.error && <div className="form-error">{status.error}</div>}
              {status.ok && <div className="form-success">{status.ok}</div>}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={status.loading}>
                  {status.loading ? 'Vérification client Filme…' : "Confirmer l'inscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export async function getServerSideProps() {
  try {
    const sessions = await getOpenSessions();
    return { props: { initialSessions: sessions } };
  } catch (err) {
    console.error('[index] getServerSideProps', err);
    return { props: { initialSessions: [] } };
  }
}
