import { useState } from 'react';
import Head from 'next/head';
import { getOpenSessions } from '../lib/sessions';
import { getVisibleTopics, getAllTopics, CAPACITY, VALIDATION_THRESHOLD, PRICE_LABEL, TOPIC_CATEGORIES, nextSaturdays, formatSaturday } from '../lib/topics';
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

// ─── Popup d'édition / création d'une formation (admin uniquement) ───────────
function emptyTopicForm(topic) {
  return {
    title: topic?.title || '',
    level: topic?.level || '',
    desc: topic?.desc || '',
    fullDescription: topic?.fullDescription || '',
    program: topic?.program || '',
    price: topic?.price || '',
    duration: topic?.duration || '',
    category: topic?.category || '',
    bonus: topic?.bonus || '',
  };
}

function TopicFormModal({ mode, topic, onClose, onSaved }) {
  const [form, setForm] = useState(emptyTopicForm(topic));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Le titre est requis.'); return; }
    setLoading(true);
    setError('');
    try {
      const url = mode === 'create' ? '/api/admin/topics' : `/api/admin/topics/${topic.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onSaved(data.topic, mode);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{mode === 'create' ? 'Nouvelle formation' : 'Éditer la formation'}</h2>

        <form onSubmit={submit} style={{ marginTop: 16 }}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Catégorie</label>
            <select className="form-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">— Aucune —</option>
              {TOPIC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Titre</label>
            <input className="form-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex : Drone FPV cinématique" required />
          </div>

          <div className="form-group">
            <label className="form-label">Résumé pour la page d'accueil</label>
            <textarea className="form-input" rows={3} value={form.desc} onChange={(e) => set('desc', e.target.value)} placeholder="Texte court affiché sur la carte formation, en accueil" />
          </div>

          <div className="form-group">
            <label className="form-label">Descriptif complet</label>
            <textarea className="form-input" rows={5} value={form.fullDescription} onChange={(e) => set('fullDescription', e.target.value)} placeholder="Affiché dans la popup « En savoir plus » (visible par les visiteurs)" />
          </div>

          <div className="form-group">
            <label className="form-label">Programme</label>
            <textarea className="form-input" rows={5} value={form.program} onChange={(e) => set('program', e.target.value)} placeholder={'Une ligne par étape, ex :\n1. Prise en main du matériel\n2. Exercices pratiques\n3. Debrief'} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Niveau</label>
              <input className="form-input" value={form.level} onChange={(e) => set('level', e.target.value)} placeholder="Ex : Débutant" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Prix</label>
              <input className="form-input" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder={`Sinon : ${PRICE_LABEL}`} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Durée</label>
              <input className="form-input" value={form.duration} onChange={(e) => set('duration', e.target.value)} placeholder="Sinon : 1 journée (9h–18h)" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bonus exclusif</label>
            <input
              className="form-input"
              value={form.bonus}
              onChange={(e) => set('bonus', e.target.value)}
              placeholder="Ex : Bon d'achat de 150 € HT sur votre 1ère location Ronin 4D chez Filme"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement…' : mode === 'create' ? 'Créer la formation' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Popup public "En savoir plus" ────────────────────────────────────────────
function TopicDetailModal({ topic, onClose, onRegister }) {
  const programLines = (topic.program || '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {topic.category && <span className="badge badge-blue" style={{ marginBottom: 8, display: 'inline-block' }}>{topic.category}</span>}
        <h2>{topic.title}</h2>
        <div className="level" style={{ marginTop: 4 }}>
          {[topic.level, topic.price || PRICE_LABEL, topic.duration || '1 journée (9h–18h)'].filter(Boolean).join(' · ')}
        </div>
        {topic.bonus && (
          <div className="bonus-note" style={{ marginTop: 10 }}>🎁 {topic.bonus}</div>
        )}

        {topic.fullDescription && (
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginTop: 20 }}>
            {topic.fullDescription}
          </p>
        )}

        {programLines.length > 0 && (
          <>
            <h3 style={{ fontSize: 15, marginTop: 20, marginBottom: 8 }}>Programme</h3>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--text)', lineHeight: 1.8 }}>
              {programLines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Fermer</button>
          {!topic.archived && (
            <button type="button" className="btn btn-primary" onClick={() => { onRegister(topic.id); onClose(); }}>
              Indiquer ses disponibilités
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Carte formation — mode normal + popups édition/détail (admin) ───────────
function TopicCard({ topic, index, isAdmin, onOpenRegister, onSaved }) {
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

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

  return (
    <div className="card topic-card" style={{ opacity: topic.archived ? 0.55 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div className="idx">Formation {String(index + 1).padStart(2, '0')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {topic.category && <span className="badge badge-blue">{topic.category}</span>}
          {topic.archived && <span className="badge badge-gray">Archivée</span>}
        </div>
      </div>
      <h3>{topic.title}</h3>
      <p>{topic.desc}</p>
      {topic.bonus && <div className="bonus-note">🎁 {topic.bonus}</div>}
      <div className="level">{[topic.level, topic.price || PRICE_LABEL, topic.duration || '1 journée (9h–18h)'].filter(Boolean).join(' · ')}</div>
      {error && <div className="form-error">{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {!topic.archived && (
          <button className="btn btn-primary btn-sm" onClick={() => onOpenRegister(topic.id)}>
            Indiquer ses disponibilités
          </button>
        )}
        <button type="button" className="link-btn" onClick={() => setShowDetail(true)}>En savoir plus</button>
        {isAdmin && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>✏️ Éditer</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleArchived} disabled={archiving}>
              {archiving ? '…' : topic.archived ? 'Désarchiver' : 'Archiver'}
            </button>
          </>
        )}
      </div>

      {showDetail && <TopicDetailModal topic={topic} onClose={() => setShowDetail(false)} onRegister={onOpenRegister} />}
      {showEdit && (
        <TopicFormModal mode="edit" topic={topic} onClose={() => setShowEdit(false)} onSaved={onSaved} />
      )}
    </div>
  );
}

// ─── Carte "+ Nouvelle formation" (admin uniquement) ─────────────────────────
function NewTopicCard({ onCreated }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="card topic-card"
        style={{ alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', boxShadow: 'none', cursor: 'pointer', minHeight: 160 }}
        onClick={() => setOpen(true)}
      >
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>+ Nouvelle formation</span>
      </button>
      {open && (
        <TopicFormModal mode="create" topic={null} onClose={() => setOpen(false)} onSaved={onCreated} />
      )}
    </>
  );
}

// ─── Popup admin export / import JSON des formations ("log") ─────────────────
function TopicsJsonModal({ topics, onClose, onImported }) {
  const [tab, setTab] = useState('export');
  const [importText, setImportText] = useState('');
  const [log, setLog] = useState([]);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportText = JSON.stringify(topics, null, 2);

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Le presse-papiers peut être indisponible (contexte non sécurisé) — l'admin peut copier manuellement.
    }
  }

  async function runImport() {
    setLog([]);
    let parsed;
    try {
      parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error('Le JSON doit être un tableau : [ { "title": "...", ... }, ... ]');
    } catch (err) {
      setLog([`✗ JSON invalide — ${err.message}`]);
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/admin/topics/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');

      const lines = data.results.map((r) =>
        r.ok
          ? `✓ ${r.title || r.id} — ${r.action === 'created' ? 'créée' : 'mise à jour'} (id: ${r.id})`
          : `✗ ${r.title || r.id} — ${r.error}`
      );
      setLog(lines);

      const refreshed = await fetch('/api/admin/topics');
      const refreshedData = await refreshed.json();
      if (refreshed.ok) onImported(refreshedData.topics);
    } catch (err) {
      setLog((l) => [...l, `✗ ${err.message}`]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>Export / Import des formations (JSON)</h2>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 12 }}>
          <button type="button" className={`btn btn-sm ${tab === 'export' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('export')}>Export</button>
          <button type="button" className={`btn btn-sm ${tab === 'import' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('import')}>Import</button>
        </div>

        {tab === 'export' ? (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
              Copiez ce JSON pour sauvegarder ou dupliquer vos formations ailleurs.
            </p>
            <textarea
              className="form-input"
              readOnly
              rows={16}
              value={exportText}
              onFocus={(e) => e.target.select()}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Fermer</button>
              <button type="button" className="btn btn-primary" onClick={copyExport}>{copied ? 'Copié ✓' : 'Copier'}</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
              Collez un tableau JSON de formations. Une formation dont l'« id » existe déjà est mise à jour,
              sinon elle est créée.
            </p>
            <textarea
              className="form-input"
              rows={12}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='[ { "id": "ronin4d", "title": "…", "desc": "…", "fullDescription": "…", "program": "…", "level": "…", "price": "…", "duration": "…" } ]'
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            {log.length > 0 && (
              <div style={{ marginTop: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 12, maxHeight: 200, overflowY: 'auto' }}>
                {log.map((line, i) => (
                  <div key={i} style={{ color: line.startsWith('✗') ? 'var(--red)' : 'var(--green)' }}>{line}</div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Fermer</button>
              <button type="button" className="btn btn-primary" onClick={runImport} disabled={importing || !importText.trim()}>
                {importing ? 'Import…' : 'Importer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Popup Conditions générales de participation ─────────────────────────────
function TermsModal({ isAdmin, text, onSave, onClose }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await onSave(draft);
    setLoading(false);
    setEditing(false);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>Conditions générales de participation</h2>

        {editing ? (
          <>
            <textarea
              className="form-input"
              rows={20}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ fontFamily: 'inherit', fontSize: 13, marginTop: 16 }}
            />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setDraft(text); setEditing(false); }}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={loading}>
                {loading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7, marginTop: 16 }}>{text}</div>
            <div className="modal-actions">
              {isAdmin && <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>✏️ Éditer</button>}
              <button type="button" className="btn btn-primary" onClick={onClose}>Fermer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home({ initialSessions, initialTopics, initialContent, isAdmin, admin }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [topics, setTopics] = useState(initialTopics);
  const [content, setContent] = useState(initialContent);
  const [modal, setModal] = useState(null); // { topicId, dates: string[] }
  const [form, setForm] = useState({ name: '', email: '' });
  const [status, setStatus] = useState({ loading: false, error: '', results: [] });
  const [showTerms, setShowTerms] = useState(false);
  const [showTopicsJson, setShowTopicsJson] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const saturdays = nextSaturdays(8);
  const selectableTopics = topics.filter((t) => !t.archived);
  const usedCategories = TOPIC_CATEGORIES.filter((c) => topics.some((t) => t.category === c));
  const filteredTopics = categoryFilter ? topics.filter((t) => t.category === categoryFilter) : topics;

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
    if (r.ok) return r.validated ? '🎉 Formation validée !' : `Confirmée (${Math.max(0, VALIDATION_THRESHOLD - r.count)} inscription(s) avant validation)`;
    if (r.error === 'full') return 'Session déjà complète';
    if (r.error === 'already_registered') return 'Déjà inscrit(e) sur cette session';
    if (r.error === 'topic_archived') return "Cette formation n'est plus proposée";
    return 'Erreur, réessayez';
  }

  return (
    <>
      <Head>
        <title>Workshops Filme — Ateliers du samedi</title>
        <meta name="description" content={`Ateliers pratiques du samedi chez Filme : prise en main du matériel de location, 149 € HT, ${CAPACITY} places maximum.`} />
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
                const isFull = s.count >= s.capacity;
                let badge = <span className="badge badge-gray">{Math.max(0, s.capacity - s.count)} places dispo</span>;
                if (s.validated) badge = <span className="badge badge-green">✅ Formation validée</span>;
                else if (s.rate >= 0.5) badge = <span className="badge badge-amber">🔥 {Math.max(0, s.threshold - s.count)} avant validation</span>;

                return (
                  <div className="chart-row" key={s.id}>
                    <div className="meta">
                      <div className="topic-title">{s.topic.title}</div>
                      <div className="date-label">{s.dateLabel}</div>
                    </div>
                    <div className="bar-track">
                      <div className={`bar-fill ${s.validated ? 'full' : ''}`} style={{ width: `${pct}%` }} />
                      <div className="bar-label">{s.count}/{s.capacity} inscrits{s.validated ? ' · validée' : ''}</div>
                    </div>
                    <div className="action">
                      {badge}
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={isFull}
                        onClick={() => openModal(s.topicId, s.dateIso)}
                      >
                        {isFull ? 'Complet' : "S'inscrire"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="section">
          <div className="card" style={{ padding: '28px 24px' }}>
            <div className="timeline">
              {[1, 2, 3, 4].map((n) => (
                <div className="timeline-step" key={n}>
                  <div className="timeline-dot">{n}</div>
                  <EditableText
                    isAdmin={isAdmin}
                    tag="p"
                    value={content[`timeline_step_${n}`]}
                    onSave={(v) => saveContent(`timeline_step_${n}`, v)}
                  />
                </div>
              ))}
            </div>
            <div className="engagement-note">
              <EditableText isAdmin={isAdmin} tag="p" multiline value={content.engagement_note} onSave={(v) => saveContent('engagement_note', v)} />
              <button type="button" className="link-btn" onClick={() => setShowTerms(true)}>
                Conditions générales de participation
              </button>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <EditableText isAdmin={isAdmin} tag="h2" value={content.topics_heading} onSave={(v) => saveContent('topics_heading', v)} />
              <EditableText isAdmin={isAdmin} tag="span" className="hint" value={content.topics_hint} onSave={(v) => saveContent('topics_hint', v)} />
            </div>
            {isAdmin && (
              <button type="button" className="link-btn" onClick={() => setShowTopicsJson(true)}>
                ⇅ Export / Import JSON
              </button>
            )}
          </div>
          {usedCategories.length > 0 && (
            <div className="category-filter">
              <button
                type="button"
                className={`filter-pill ${!categoryFilter ? 'active' : ''}`}
                onClick={() => setCategoryFilter('')}
              >
                Toutes
              </button>
              {usedCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`filter-pill ${categoryFilter === c ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {topics.length === 0 && !isAdmin ? (
            <div className="card"><div className="empty">Aucune formation disponible pour le moment.</div></div>
          ) : filteredTopics.length === 0 ? (
            <div className="card"><div className="empty">Aucune formation dans cette catégorie pour le moment.</div></div>
          ) : (
            <div className="topics-grid">
              {filteredTopics.map((t) => (
                <TopicCard key={t.id} topic={t} index={topics.indexOf(t)} isAdmin={isAdmin} onOpenRegister={(id) => openModal(id, null)} onSaved={updateTopicInList} />
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
            <div className="modal-sub">{PRICE_LABEL} — {CAPACITY} places maximum · vous pouvez cocher plusieurs samedis pour la même formation</div>

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

      {showTerms && (
        <TermsModal
          isAdmin={isAdmin}
          text={content.cgv_text}
          onSave={(v) => saveContent('cgv_text', v)}
          onClose={() => setShowTerms(false)}
        />
      )}

      {showTopicsJson && (
        <TopicsJsonModal
          topics={topics}
          onClose={() => setShowTopicsJson(false)}
          onImported={(list) => setTopics(list)}
        />
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
