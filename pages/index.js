import { useState } from 'react';
import Head from 'next/head';
import { getOpenSessions } from '../lib/sessions';
import { getVisibleTopics, getAllTopics, CAPACITY, PRICE_LABEL, nextSaturdays, formatSaturday } from '../lib/topics';
import { getSiteContent, CONTENT_DEFAULTS } from '../lib/content';
import { getSession } from '../lib/auth';
import AdminBar from '../components/AdminBar';

// ─── Texte éditable en place (mode admin uniquement) ─────────────────────────
function EditableText({ isAdmin, value, onSave, tag: Tag = 'span', multiline = false, className, style }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [loading, setLoading] = useState(false);

  if (!isAdmin) {
    return <Tag className={className} style={style}>{value}</Tag>;
  }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: multiline ? 'column' : 'row', gap: 6, alignItems: multiline ? 'stretch' : 'center', width: multiline ? '100%' : 'auto', maxWidth: '100%' }}>
        {multiline ? (
          <textarea className="form-input" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
        ) : (
          <input className="form-input" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus style={{ minWidth: 220 }} />
        )}
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDraft(value); setEditing(false); }}>Annuler</button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await onSave(draft);
              setLoading(false);
              setEditing(false);
            }}
          >
            {loading ? '…' : 'OK'}
          </button>
        </span>
      </span>
    );
  }

  return (
    <Tag className={className} style={{ ...style, cursor: 'pointer' }} onClick={() => setEditing(true)} title="Cliquer pour éditer">
      {value} <span style={{ fontSize: 11, opacity: 0.4 }}>✏️</span>
    </Tag>
  );
}

// ─── Carte formation — mode normal + mode édition admin ──────────────────────
function TopicCard({ topic, index, isAdmin, onOpenRegister, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: topic.title, level: topic.level, desc: topic.desc });
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onSaved(data.topic);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleArchived() {
    setArchiving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !topic.archived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onSaved(data.topic);
    } catch (err) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  }

  if (editing) {
    return (
      <div className="card topic-card">
        <div className="idx">Formation {String(index + 1).padStart(2, '0')} · édition</div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Titre</label>
          <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Niveau</label>
          <input className="form-input" value={form.level || ''} onChange={(e) => setForm({ ...form, level: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={4} value={form.desc || ''} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setEditing(false); setForm({ title: topic.title, level: topic.level, desc: topic.desc }); setError(''); }}
          >
            Annuler
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card topic-card" style={{ opacity: topic.archived ? 0.55 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div className="idx">Formation {String(index + 1).padStart(2, '0')}</div>
        {topic.archived && <span className="badge badge-gray">Archivée</span>}
      </div>
      <h3>{topic.title}</h3>
      <p>{topic.desc}</p>
      <div className="level">{topic.level} · {PRICE_LABEL} · 1 journée (9h–18h)</div>
      {error && <div className="form-error">{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!topic.archived && (
          <button className="btn btn-primary btn-sm" onClick={() => onOpenRegister(topic.id)}>
            Choisir un ou plusieurs samedis
          </button>
        )}
        {isAdmin && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>✏️ Éditer</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleArchived} disabled={archiving}>
              {archiving ? '…' : topic.archived ? 'Désarchiver' : 'Archiver'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Formulaire de création (admin uniquement) ───────────────────────────────
function NewTopicCard({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', level: '', desc: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Le titre est requis.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onCreated(data.topic);
      setForm({ title: '', level: '', desc: '' });
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="card topic-card" style={{ alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', boxShadow: 'none', cursor: 'pointer', minHeight: 160 }} onClick={() => setOpen(true)}>
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>+ Nouvelle formation</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card topic-card">
      <div className="idx">Nouvelle formation</div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-group">
        <label className="form-label">Titre</label>
        <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex : Drone FPV cinématique" required />
      </div>
      <div className="form-group">
        <label className="form-label">Niveau</label>
        <input className="form-input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="Ex : Débutant" />
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-input" rows={4} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Annuler</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? 'Création…' : 'Créer'}</button>
      </div>
    </form>
  );
}

export default function Home({ initialSessions, initialTopics, initialContent, isAdmin, admin }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [topics, setTopics] = useState(initialTopics);
  const [content, setContent] = useState(initialContent);
  const [modal, setModal] = useState(null); // { topicId, dates: string[] }
  const [form, setForm] = useState({ name: '', email: '' });
  const [status, setStatus] = useState({ loading: false, error: '', results: [] });

  const saturdays = nextSaturdays(8);
  const selectableTopics = topics.filter((t) => !t.archived);

  function updateTopicInList(updated) {
    setTopics((list) => list.map((t) => (t.id === updated.id ? updated : t)));
  }
  function addTopicToList(created) {
    setTopics((list) => [...list, created]);
  }

  async function saveContent(key, value) {
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setContent((c) => ({ ...c, [key]: data.value }));
    } catch (err) {
      alert(err.message || "Erreur lors de l'enregistrement");
    }
  }

  function openModal(topicId, dateIso) {
    setModal({ topicId: topicId || selectableTopics[0]?.id, dates: dateIso ? [dateIso] : [] });
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

      {isAdmin && <AdminBar email={admin.email} />}

      <div className="page" style={isAdmin ? { paddingTop: 56 } : undefined}>
        <header className="hero">
          <img src="https://www.filme.fr/cdn/shop/files/Filme-Logo-sd.svg?v=1707646401&width=140" alt="Filme" className="logo" />
          <EditableText isAdmin={isAdmin} tag="h1" value={content.hero_title} onSave={(v) => saveContent('hero_title', v)} />
          <EditableText isAdmin={isAdmin} tag="p" className="lead" multiline value={content.hero_lead} onSave={(v) => saveContent('hero_lead', v)} />
          <div className="pill-row">
            <EditableText isAdmin={isAdmin} tag="span" className="pill" value={content.price_label} onSave={(v) => saveContent('price_label', v)} />
            <EditableText isAdmin={isAdmin} tag="span" className="pill" value={content.pill_capacity} onSave={(v) => saveContent('pill_capacity', v)} />
            <EditableText isAdmin={isAdmin} tag="span" className="pill" value={content.pill_audience} onSave={(v) => saveContent('pill_audience', v)} />
            <EditableText isAdmin={isAdmin} tag="span" className="pill" value={content.pill_validation} onSave={(v) => saveContent('pill_validation', v)} />
          </div>
        </header>

        <section className="section">
          <div className="section-head">
            <EditableText isAdmin={isAdmin} tag="h2" value={content.sessions_heading} onSave={(v) => saveContent('sessions_heading', v)} />
            <EditableText isAdmin={isAdmin} tag="span" className="hint" value={content.sessions_hint} onSave={(v) => saveContent('sessions_hint', v)} />
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
            <EditableText isAdmin={isAdmin} tag="h2" value={content.topics_heading} onSave={(v) => saveContent('topics_heading', v)} />
            <EditableText isAdmin={isAdmin} tag="span" className="hint" value={content.topics_hint} onSave={(v) => saveContent('topics_hint', v)} />
          </div>
          {topics.length === 0 && !isAdmin ? (
            <div className="card"><div className="empty">Aucune formation disponible pour le moment.</div></div>
          ) : (
            <div className="topics-grid">
              {topics.map((t, i) => (
                <TopicCard key={t.id} topic={t} index={i} isAdmin={isAdmin} onOpenRegister={(id) => openModal(id, null)} onSaved={updateTopicInList} />
              ))}
              {isAdmin && <NewTopicCard onCreated={addTopicToList} />}
            </div>
          )}
        </section>

        <footer className="page-footer">
          <EditableText isAdmin={isAdmin} tag="span" value={content.footer_text} onSave={(v) => saveContent('footer_text', v)} />
          {' · '}
          {isAdmin ? (
            <EditableText isAdmin={isAdmin} tag="span" value={content.footer_email} onSave={(v) => saveContent('footer_email', v)} />
          ) : (
            <a href={`mailto:${content.footer_email}`}>{content.footer_email}</a>
          )}
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
                  {selectableTopics.map((t) => (
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

export async function getServerSideProps(ctx) {
  const session = getSession(ctx.req);
  const isAdmin = !!session;

  try {
    const [sessions, topics, content] = await Promise.all([
      getOpenSessions(),
      isAdmin ? getAllTopics() : getVisibleTopics(),
      getSiteContent(),
    ]);
    return { props: { initialSessions: sessions, initialTopics: topics, initialContent: content, isAdmin, admin: session || null } };
  } catch (err) {
    console.error('[index] getServerSideProps', err);
    return { props: { initialSessions: [], initialTopics: [], initialContent: CONTENT_DEFAULTS, isAdmin, admin: session || null } };
  }
}
