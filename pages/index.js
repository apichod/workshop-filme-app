import { useState } from 'react';
import Head from 'next/head';
import { getOpenSessions } from '../lib/sessions';
import { getVisibleTopics, CAPACITY, PRICE_LABEL, nextSaturdays, formatSaturday } from '../lib/topics';

export default function Home({ initialSessions, topics }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [modal, setModal] = useState(null); // { topicId, dates: string[] }
  const [form, setForm] = useState({ name: '', email: '' });
  const [status, setStatus] = useState({ loading: false, error: '', results: [] });

  const saturdays = nextSaturdays(8);

  function openModal(topicId, dateIso) {
    setModal({ topicId: topicId || topics[0]?.id, dates: dateIso ? [dateIso] : [] });
    setForm({ name: '', email: '' });
    setStatus({ loading: false, error: '', results: [] });
  }
  function closeModal() { setModal(null); }

  function toggleDate(dateIso) {
    setModal((m) => ({
      ...m,
      dates: m.dates.includes(dateIso) ? m.dates.filter((d) => d !== dateIso) : [...m.dates, dateIso].sort(),
    }));
  }

  async function refreshSessions() {
    const res = await fetch('/api/sessions', { cache: 'no-store' });
    const data = await res.json();
    if (data.sessions) setSessions(data.sessions);
  }

  async function submit(e) {
    e.preventDefault();

    if (!modal.dates.length) {
      setStatus({ loading: false, error: 'Sélectionnez au moins un samedi.', results: [] });
      return;
    }

    setStatus({ loading: true, error: '', results: [] });

    // Une requête par samedi sélectionné — même formation, même personne.
    const results = [];
    for (const dateIso of modal.dates) {
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicId: modal.topicId, dateIso, name: form.name, email: form.email }),
        });
        const data = await res.json();
        results.push({ dateIso, ok: res.ok, error: data.error, validated: data.validated, count: data.count });
        // Email non reconnu : inutile d'essayer les autres dates, ça échouera pareil.
        if (!res.ok && data.error === 'no_account') break;
      } catch {
        results.push({ dateIso, ok: false, error: 'network' });
      }
    }

    if (results.some((r) => r.error === 'no_account')) {
      setStatus({
        loading: false,
        error: "Cet email ne correspond à aucun client Filme connu. Vérifiez l'adresse utilisée pour vos locations, ou contactez-nous.",
        results: [],
      });
      return;
    }

    setStatus({ loading: false, error: '', results });
    await refreshSessions();
    if (results.every((r) => r.ok)) setTimeout(closeModal, 2200);
  }

  function resultLabel(r) {
    if (r.ok) return r.validated ? '🎉 Formation validée !' : `Confirmée (${CAPACITY - r.count} place(s) restante(s))`;
    if (r.error === 'full') return 'Session déjà complète';
    if (r.error === 'already_registered') return 'Déjà inscrit(e) sur cette session';
    if (r.error === 'topic_archived') return "Cette formation n'est plus proposée";
    return 'Erreur, réessayez';
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
            <h2>Les formations</h2>
            <span className="hint">Choisissez une formation pour proposer ou rejoindre un ou plusieurs samedis</span>
          </div>
          {topics.length === 0 ? (
            <div className="card"><div className="empty">Aucune formation disponible pour le moment.</div></div>
          ) : (
            <div className="topics-grid">
              {topics.map((t, i) => (
                <div className="card topic-card" key={t.id}>
                  <div className="idx">Formation {String(i + 1).padStart(2, '0')}</div>
                  <h3>{t.title}</h3>
                  <p>{t.desc}</p>
                  <div className="level">{t.level} · {PRICE_LABEL} · 1 journée (9h–18h)</div>
                  <button className="btn btn-primary btn-sm" onClick={() => openModal(t.id, null)}>Choisir un ou plusieurs samedis</button>
                </div>
              ))}
            </div>
          )}
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
            <div className="modal-sub">{PRICE_LABEL} — 6 places maximum · vous pouvez cocher plusieurs samedis pour la même formation</div>

            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">Formation</label>
                <select
                  className="form-input"
                  value={modal.topicId}
                  onChange={(e) => setModal({ ...modal, topicId: e.target.value })}
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Samedis ({modal.dates.length} sélectionné{modal.dates.length > 1 ? 's' : ''})</label>
                <div className="checkbox-list">
                  {saturdays.map((d) => (
                    <label className="checkbox-item" key={d}>
                      <input
                        type="checkbox"
                        checked={modal.dates.includes(d)}
                        onChange={() => toggleDate(d)}
                      />
                      {formatSaturday(d)}
                    </label>
                  ))}
                </div>
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

              {status.results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {status.results.map((r) => (
                    <div key={r.dateIso} className={r.ok ? 'form-success' : 'form-error'} style={{ marginTop: 0 }}>
                      {formatSaturday(r.dateIso)} — {resultLabel(r)}
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={status.loading}>
                  {status.loading ? 'Vérification client Filme…' : `Confirmer l'inscription${modal.dates.length > 1 ? ` (${modal.dates.length} samedis)` : ''}`}
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
    const [sessions, topics] = await Promise.all([getOpenSessions(), getVisibleTopics()]);
    return { props: { initialSessions: sessions, topics } };
  } catch (err) {
    console.error('[index] getServerSideProps', err);
    return { props: { initialSessions: [], topics: [] } };
  }
}
