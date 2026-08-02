import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { getOpenSessions } from '../lib/sessions';
import { getVisibleTopics, getAllTopics, CAPACITY, VALIDATION_THRESHOLD, PRICE_LABEL, TOPIC_CATEGORIES, TOPIC_TYPES, SCHEDULE_OPTIONS, nextWeekdayDates, topicWeekday, scheduleOption, yearSaturdays, formatSaturday, formatPrice, parsePriceValue } from '../lib/topics';
import { getSiteContent, CONTENT_DEFAULTS } from '../lib/content';
import { getClosedDates } from '../lib/closedDates';
import { getSession } from '../lib/auth';
import AdminBar from '../components/AdminBar';
import UserBar from '../components/UserBar';
import Icon from '../components/Icon';

// ─── Vignette placeholder (tant qu'aucune vraie photo n'est fournie) ─────────
function ImgPlaceholder({ className, iconSize = 22 }) {
  return (
    <div className={`img-placeholder ${className || ''}`}>
      <Icon name="camera" size={iconSize} />
    </div>
  );
}

// ─── Couleurs par catégorie — badges + filtres (repérage visuel rapide) ──────
const CATEGORY_STYLES = {
  Image: { badgeClass: 'badge-cat-image', color: '#2B80FF' },
  Lumière: { badgeClass: 'badge-cat-lumiere', color: '#d97706' },
  Machinerie: { badgeClass: 'badge-cat-machinerie', color: '#52525b' },
  Audio: { badgeClass: 'badge-cat-audio', color: '#7c3aed' },
  'Régie vidéo': { badgeClass: 'badge-cat-regie', color: '#0891b2' },
};
function categoryStyle(category) {
  return CATEGORY_STYLES[category] || { badgeClass: 'badge-blue', color: '#2B80FF' };
}

// Petite note affichée sur la carte/le détail quand le planning n'est pas le
// samedi par défaut : soit une date fixe unique, soit un autre jour récurrent.
function scheduleLabel(topic) {
  if (topic.scheduleMode === 'fixed' && topic.fixedDate) {
    return `Date fixe : ${formatSaturday(topic.fixedDate)}`;
  }
  return 'Date flexible : en fonction de la demande';
}

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
    type: topic?.type || 'Formation',
    bonus: topic?.bonus || '',
    maxParticipants: topic?.maxParticipants ? String(topic.maxParticipants) : '',
    equipment: topic?.equipment || '',
    minParticipants: Number.isFinite(topic?.minParticipants) ? String(topic.minParticipants) : '',
    scheduleMode: topic?.scheduleMode || 'saturday',
    fixedDate: topic?.fixedDate || '',
  };
}

function TopicFormModal({ mode, topic, onClose, onSaved, onTopicsReplaced }) {
  const [form, setForm] = useState(emptyTopicForm(topic));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showJson, setShowJson] = useState(false);

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
    <>
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {mode === 'edit' && topic && (
          <button
            type="button"
            className="link-btn"
            onClick={() => setShowJson(true)}
            style={{ position: 'absolute', top: 22, right: 52, fontSize: 13, whiteSpace: 'nowrap' }}
          >
            ⇅ Export / Import JSON
          </button>
        )}
        <h2>{mode === 'create' ? 'Nouvelle formation' : 'Éditer la formation'}</h2>

        <form onSubmit={submit} style={{ marginTop: 16 }}>
          {error && <div className="form-error">{error}</div>}

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Type</label>
              <select className="form-input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {TOPIC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Catégorie</label>
              <select className="form-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">— Aucune —</option>
                {TOPIC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
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

          <div className="form-group">
            <label className="form-label">Matériel mis à disposition</label>
            <textarea className="form-input" rows={4} value={form.equipment} onChange={(e) => set('equipment', e.target.value)} placeholder={'Une ligne par élément, ex :\nCaméra cinéma\nOptiques\nTrépied'} />
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

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Participants min</label>
              <input
                className="form-input"
                type="number"
                min={0}
                value={form.minParticipants}
                onChange={(e) => set('minParticipants', e.target.value)}
                placeholder={`Sinon : ${VALIDATION_THRESHOLD}`}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                0 = priorité totale : dès la 1ère inscription, annule tout autre évènement à cette date (même déjà confirmé).
              </div>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Participants max</label>
              <input
                className="form-input"
                type="number"
                min={1}
                value={form.maxParticipants}
                onChange={(e) => set('maxParticipants', e.target.value)}
                placeholder={`Sinon : ${CAPACITY}`}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Planning</label>
            <select
              className="form-input"
              value={form.scheduleMode}
              onChange={(e) => {
                const mode = e.target.value;
                set('scheduleMode', mode);
                if (mode !== 'fixed') set('fixedDate', '');
              }}
            >
              {SCHEDULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {form.scheduleMode === 'fixed' && (
              <div style={{ marginTop: 8 }}>
                <input
                  className="form-input"
                  type="date"
                  value={form.fixedDate}
                  onChange={(e) => set('fixedDate', e.target.value)}
                />
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {form.scheduleMode === 'fixed'
                ? "Remplace, pour cette formation, la liste des samedis proposée par cette date unique (n'importe quel jour). Cette date est alors réservée en exclusivité : elle annule tout autre évènement déjà programmé ce jour-là et n'est plus proposée pour aucune autre formation."
                : `Les visiteurs choisiront parmi les prochains ${scheduleOption(form.scheduleMode).plural.toLowerCase()} à venir.`}
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
    {showJson && (
      <TopicJsonModal
        topic={topic}
        onClose={() => setShowJson(false)}
        onImported={(list) => {
          onTopicsReplaced?.(list);
          setShowJson(false);
          onClose();
        }}
      />
    )}
    </>
  );
}

// ─── Popup public "En savoir plus" ────────────────────────────────────────────
function TopicDetailModal({ topic, onClose, onRegister }) {
  const programLines = (topic.program || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const equipmentLines = (topic.equipment || '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {topic.category && (
          <span className={`badge ${categoryStyle(topic.category).badgeClass}`} style={{ marginBottom: 8, display: 'inline-block' }}>
            {topic.category}
          </span>
        )}
        <h2>{topic.title}</h2>
        <div className="level" style={{ marginTop: 4 }}>
          {[topic.level, formatPrice(topic.price), topic.duration || '1 journée (9h–18h)', `${topic.maxParticipants || CAPACITY} participants max`].filter(Boolean).join(' · ')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
          <Icon name="calendar" size={13} /> {scheduleLabel(topic)}
        </div>
        {topic.bonus && (
          <div className="bonus-note" style={{ marginTop: 10 }}>🎁 {topic.bonus}</div>
        )}

        {topic.fullDescription && (
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 15, color: 'var(--text)', lineHeight: 1.7, marginTop: 20 }}>
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

        {equipmentLines.length > 0 && (
          <>
            <h3 style={{ fontSize: 15, marginTop: 20, marginBottom: 8 }}>Matériel mis à disposition</h3>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--text)', lineHeight: 1.8 }}>
              {equipmentLines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Fermer</button>
          {!topic.archived && (
            <button type="button" className="btn btn-primary" onClick={() => { onRegister(topic.id); onClose(); }}>
              S'inscrire <Icon name="arrowRight" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Carte formation — mode normal + popups édition/détail (admin) ───────────
function TopicCard({ topic, index, isAdmin, onOpenRegister, onSaved, onDeleted, onTopicsReplaced }) {
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  async function remove() {
    if (!window.confirm(`Supprimer définitivement « ${topic.title} » ? Cette action est irréversible.`)) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/topics/${topic.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onDeleted(topic.id);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="card topic-card" style={{ opacity: topic.archived ? 0.55 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div className="idx">{topic.type || 'Formation'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {topic.category && <span className={`badge ${categoryStyle(topic.category).badgeClass}`}>{topic.category}</span>}
          {topic.archived && <span className="badge badge-gray">Archivée</span>}
        </div>
      </div>
      <h3>{topic.title}</h3>
      <p>{topic.desc}</p>
      {topic.bonus && <div className="bonus-note">🎁 {topic.bonus}</div>}
      <div>
        <div className="level">{[topic.level, formatPrice(topic.price), topic.duration || '1 journée (9h–18h)'].filter(Boolean).join(' · ')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
          <Icon name="calendar" size={12} /> {scheduleLabel(topic)}
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {!topic.archived && (
          <button className="btn btn-primary btn-sm" onClick={() => onOpenRegister(topic.id)}>
            S'inscrire <Icon name="arrowRight" size={14} />
          </button>
        )}
        <button type="button" className="link-btn" onClick={() => setShowDetail(true)}>En savoir plus</button>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>✏️ Éditer</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleArchived} disabled={archiving}>
              {archiving ? '…' : topic.archived ? 'Désarchiver' : 'Archiver'}
            </button>
            {topic.archived && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={remove} disabled={deleting} style={{ color: '#c0392b' }}>
                {deleting ? '…' : 'Supprimer'}
              </button>
            )}
          </div>
        )}
      </div>

      {showDetail && <TopicDetailModal topic={topic} onClose={() => setShowDetail(false)} onRegister={onOpenRegister} />}
      {showEdit && (
        <TopicFormModal mode="edit" topic={topic} onClose={() => setShowEdit(false)} onSaved={onSaved} onTopicsReplaced={onTopicsReplaced} />
      )}
    </div>
  );
}

// ─── Popup admin export / import JSON d'UNE SEULE formation ─────────────────
// Même mécanisme que TopicsJsonModal (réutilise l'API d'import en masse avec
// un tableau d'un seul élément), mais scopé à une formation : pratique pour
// sauvegarder/dupliquer/restaurer une formation précise sans toucher aux autres.
function TopicJsonModal({ topic, onClose, onImported }) {
  const [tab, setTab] = useState('export');
  const [importText, setImportText] = useState(JSON.stringify(topic, null, 2));
  const [log, setLog] = useState([]);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportText = JSON.stringify(topic, null, 2);

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
      if (Array.isArray(parsed)) parsed = parsed[0];
      if (!parsed || typeof parsed !== 'object') throw new Error('Le JSON doit être un objet : { "title": "…", … }');
    } catch (err) {
      setLog([`✗ JSON invalide — ${err.message}`]);
      return;
    }
    // Si l'id a été effacé par erreur, on le remet pour être sûr de mettre à
    // jour CETTE formation plutôt que d'en créer une nouvelle par erreur.
    if (!parsed.id) parsed.id = topic.id;

    setImporting(true);
    try {
      const res = await fetch('/api/admin/topics/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: [parsed] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');

      const [r] = data.results;
      setLog([r.ok ? `✓ ${r.title || r.id} — ${r.action === 'created' ? 'créée' : 'mise à jour'} (id: ${r.id})` : `✗ ${r.title || r.id} — ${r.error}`]);

      if (r.ok) {
        const refreshed = await fetch('/api/admin/topics');
        const refreshedData = await refreshed.json();
        if (refreshed.ok) onImported(refreshedData.topics);
      }
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
        <h2>Export / Import — {topic.title}</h2>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 12 }}>
          <button type="button" className={`btn btn-sm ${tab === 'export' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('export')}>Export</button>
          <button type="button" className={`btn btn-sm ${tab === 'import' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('import')}>Import</button>
        </div>

        {tab === 'export' ? (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
              Copiez ce JSON pour sauvegarder ou dupliquer cette formation ailleurs.
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
              Collez le JSON de cette formation (modifié si besoin) pour la mettre à jour. Gardez le champ
              « id » tel quel — si vous le changez, une nouvelle formation sera créée au lieu de mettre à jour celle-ci.
            </p>
            <textarea
              className="form-input"
              rows={16}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            {log.length > 0 && (
              <div style={{ marginTop: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
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

// ─── Popup admin "Préférences" — samedis inclus/exclus sur un an ────────────
function monthKey(dateIso) {
  return dateIso.slice(0, 7); // "2026-08"
}
function monthLabel(dateIso) {
  const d = new Date(`${dateIso}T00:00:00`);
  const s = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function dayLabel(dateIso) {
  const d = new Date(`${dateIso}T00:00:00`);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function SaturdaysPreferences({ closedDates, onToggle }) {
  const [pending, setPending] = useState(null); // date en cours d'enregistrement
  const [error, setError] = useState('');
  const year = yearSaturdays(52);
  const closedSet = new Set(closedDates);

  const groups = [];
  for (const dateIso of year) {
    const key = monthKey(dateIso);
    let group = groups.find((g) => g.key === key);
    if (!group) { group = { key, label: monthLabel(dateIso), dates: [] }; groups.push(group); }
    group.dates.push(dateIso);
  }

  async function toggle(dateIso, closed) {
    setPending(dateIso);
    setError('');
    try {
      await onToggle(dateIso, closed);
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8, marginBottom: 16 }}>
        Décochez un samedi (congés, jour férié, fermeture exceptionnelle…) pour qu'il ne soit plus proposé
        à l'inscription. Il n'apparaîtra plus dans le formulaire, et une éventuelle tentative d'inscription
        directe sur cette date sera refusée.
      </p>

      {error && <div className="form-error">{error}</div>}

      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{g.label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {g.dates.map((dateIso) => {
              const closed = closedSet.has(dateIso);
              return (
                <label
                  key={dateIso}
                  className="checkbox-item"
                  style={{ opacity: pending === dateIso ? 0.5 : 1, textDecoration: closed ? 'line-through' : 'none', color: closed ? 'var(--text-muted)' : 'var(--text)' }}
                >
                  <input
                    type="checkbox"
                    checked={!closed}
                    disabled={pending === dateIso}
                    onChange={(e) => toggle(dateIso, !e.target.checked)}
                  />
                  {dayLabel(dateIso)}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function RegistrationsPreferences({ onChanged }) {
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [deletingSessionId, setDeletingSessionId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/sessions')
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setSessions(data.sessions || []); })
      .catch(() => { if (!cancelled) setError('Impossible de charger les sessions'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function removeRegistrant(sessionId, registrant) {
    if (!window.confirm(`Retirer ${registrant.name || registrant.email} de cette session ?`)) return;
    setRemovingId(registrant.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/registrations/${registrant.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSessions((list) =>
        list.map((s) => (s.id === sessionId ? { ...s, registrants: s.registrants.filter((r) => r.id !== registrant.id) } : s))
      );
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setRemovingId(null);
    }
  }

  async function removeSession(s) {
    const label = `${s.topic?.title || s.topicId} — ${s.dateLabel}`;
    const warn = s.registrants.length > 0
      ? ` ${s.registrants.length} inscrit(s) seront prévenus par email.`
      : '';
    if (!window.confirm(`Supprimer définitivement la session « ${label} » ?${warn}`)) return;
    setDeletingSessionId(s.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/sessions/${s.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSessions((list) => list.filter((x) => x.id !== s.id));
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setDeletingSessionId(null);
    }
  }

  if (loading) return <div className="loading" style={{ marginTop: 16 }}>Chargement…</div>;

  return (
    <>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8, marginBottom: 16 }}>
        Retirez manuellement un inscrit (erreur d'inscription, désistement signalé par téléphone…), ou
        supprimez une session entière (une date restée programmée par erreur, par exemple). Si le nombre
        d'inscrits repasse sous le seuil de validation, la session redevient "non validée".
      </p>

      {error && <div className="form-error">{error}</div>}

      {(!sessions || sessions.length === 0) && !error ? (
        <div className="empty">Aucune session à venir pour le moment.</div>
      ) : (
        sessions.map((s) => (
          <div key={s.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {s.topic?.title || s.topicId} — {s.dateLabel}
                {s.validated && <span className="badge badge-green" style={{ marginLeft: 8 }}>✅ Validée</span>}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={deletingSessionId === s.id}
                onClick={() => removeSession(s)}
                style={{ color: '#c0392b' }}
              >
                {deletingSessionId === s.id ? '…' : 'Supprimer la session'}
              </button>
            </div>
            {s.registrants.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>Aucun inscrit.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {s.registrants.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{r.name} <span style={{ color: 'var(--text-muted)' }}>· {r.email}</span></span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={removingId === r.id}
                      onClick={() => removeRegistrant(s.id, r)}
                    >
                      {removingId === r.id ? '…' : 'Retirer'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}

function ActiveTopicsPreferences({ topics, onDeleted }) {
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const activeTopics = topics.filter((t) => !t.archived);

  async function remove(topic) {
    if (!window.confirm(`Supprimer définitivement « ${topic.title} » ? Cette action est irréversible.`)) return;
    setDeletingId(topic.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/topics/${topic.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onDeleted(topic.id);
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8, marginBottom: 16 }}>
        Supprimez définitivement une formation active si besoin (créée par erreur, doublon…). Impossible si
        des sessions (passées ou à venir) lui sont déjà rattachées — archivez-la plutôt dans ce cas.
      </p>

      {error && <div className="form-error">{error}</div>}

      {activeTopics.length === 0 ? (
        <div className="empty">Aucune formation active pour le moment.</div>
      ) : (
        activeTopics.map((t) => (
          <div
            key={t.id}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}
          >
            <span>{t.title}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={deletingId === t.id}
              onClick={() => remove(t)}
              style={{ color: '#c0392b' }}
            >
              {deletingId === t.id ? '…' : 'Supprimer'}
            </button>
          </div>
        ))
      )}
    </>
  );
}

function PreferencesModal({ closedDates, onToggle, onSessionsChanged, topics, onTopicDeleted, onClose }) {
  const [tab, setTab] = useState('samedis');

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>Préférences</h2>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 4, flexWrap: 'wrap' }}>
          <button type="button" className={`btn btn-sm ${tab === 'samedis' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('samedis')}>Samedis proposés</button>
          <button type="button" className={`btn btn-sm ${tab === 'inscriptions' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('inscriptions')}>Inscriptions</button>
          <button type="button" className={`btn btn-sm ${tab === 'formations' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('formations')}>Formations actives</button>
        </div>

        {tab === 'samedis' && <SaturdaysPreferences closedDates={closedDates} onToggle={onToggle} />}
        {tab === 'inscriptions' && <RegistrationsPreferences onChanged={onSessionsChanged} />}
        {tab === 'formations' && <ActiveTopicsPreferences topics={topics} onDeleted={onTopicDeleted} />}

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>Fermer</button>
        </div>
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

// ─── Filtre "Type" du planning (Formations à venir) ──────────────────────────
function SessionTypeFilter({ options, selected, onToggle, onReset }) {
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
    <div className="filter-dropdown" ref={ref}>
      <button
        type="button"
        className={`filter-trigger ${selected.length ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Type <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className="filter-panel">
          <div className="filter-panel-head">
            <strong>Type</strong>
            <button type="button" className="filter-panel-reset" onClick={onReset}>Réinitialiser</button>
          </div>
          <div className="checkbox-list">
            {options.map((t) => (
              <label className="checkbox-item" key={t}>
                <input type="checkbox" checked={selected.includes(t)} onChange={() => onToggle(t)} />
                {t}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home({ initialSessions, initialTopics, initialContent, initialClosedDates, isAdmin, session }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [topics, setTopics] = useState(initialTopics);
  const [content, setContent] = useState(initialContent);
  const [modal, setModal] = useState(null); // { topicId, dates: string[] }
  const [showModalTopicDetail, setShowModalTopicDetail] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [status, setStatus] = useState({ loading: false, error: '', results: [] });
  const [showTerms, setShowTerms] = useState(false);
  const [showTopicsJson, setShowTopicsJson] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [closedDates, setClosedDates] = useState(initialClosedDates || []);
  const [sessionSort, setSessionSort] = useState('rate'); // 'rate' (défaut) ou 'date'
  const [sessionTypeFilter, setSessionTypeFilter] = useState([]); // types cochés dans "Filtrer par : Type" ([] = tous)
  const [topicTypeFilter, setTopicTypeFilter] = useState([]); // idem pour "Formations disponibles"
  const [topicSort, setTopicSort] = useState(''); // '' (ordre par défaut), 'newest', 'price_desc', 'price_asc', 'popular'

  const selectableTopics = topics.filter((t) => !t.archived);
  const usedSessionTypes = [...new Set(sessions.map((s) => s.topic?.type || 'Formation'))];
  const usedTopicTypes = [...new Set(topics.map((t) => t.type || 'Formation'))];
  // Nombre total d'inscrits (toutes sessions à venir confondues) par formation
  // — sert de proxy à "Les plus demandées".
  const topicPopularity = new Map();
  sessions.forEach((s) => {
    topicPopularity.set(s.topicId, (topicPopularity.get(s.topicId) || 0) + s.count);
  });
  const filteredTopics = (topicTypeFilter.length ? topics.filter((t) => topicTypeFilter.includes(t.type || 'Formation')) : topics).slice();
  if (topicSort === 'newest') filteredTopics.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  else if (topicSort === 'price_desc') filteredTopics.sort((a, b) => parsePriceValue(b.price) - parsePriceValue(a.price));
  else if (topicSort === 'price_asc') filteredTopics.sort((a, b) => parsePriceValue(a.price) - parsePriceValue(b.price));
  else if (topicSort === 'popular') filteredTopics.sort((a, b) => (topicPopularity.get(b.id) || 0) - (topicPopularity.get(a.id) || 0));
  // Les formations archivées sont toujours reléguées à la fin, quel que soit
  // le tri choisi (tri stable par ailleurs : sort() est stable en JS, l'ordre
  // établi juste au-dessus est préservé au sein de chaque groupe).
  filteredTopics.sort((a, b) => (a.archived === b.archived ? 0 : a.archived ? 1 : -1));

  const sortedSessions = [...sessions].sort((a, b) =>
    sessionSort === 'date'
      ? a.dateIso.localeCompare(b.dateIso)
      : b.rate - a.rate || a.dateIso.localeCompare(b.dateIso)
  );
  const visibleSessions = sessionTypeFilter.length
    ? sortedSessions.filter((s) => sessionTypeFilter.includes(s.topic?.type || 'Formation'))
    : sortedSessions;

  function toggleSessionType(t) {
    setSessionTypeFilter((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));
  }
  function toggleTopicType(t) {
    setTopicTypeFilter((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));
  }
  const modalTopic = modal ? topics.find((t) => t.id === modal.topicId) : null;
  // Liste de dates proposées dans la popup d'inscription : les prochaines
  // occurrences du jour de semaine de la formation (mercredi/vendredi/samedi),
  // ou sa date fixe unique si elle en a une.
  const modalDates = modalTopic?.fixedDate
    ? [modalTopic.fixedDate]
    : modalTopic
      ? nextWeekdayDates(topicWeekday(modalTopic), 8, closedDates)
      : [];

  function updateTopicInList(updated) {
    setTopics((list) => list.map((t) => (t.id === updated.id ? updated : t)));
  }
  function addTopicToList(created) {
    setTopics((list) => [...list, created]);
  }
  function removeTopicFromList(id) {
    setTopics((list) => list.filter((t) => t.id !== id));
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

  async function toggleClosedDate(dateIso, closed) {
    const res = await fetch('/api/admin/closed-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateIso, closed }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    setClosedDates((list) => (closed ? [...new Set([...list, dateIso])] : list.filter((d) => d !== dateIso)));
  }

  function openModal(topicId, dateIso) {
    const tId = topicId || selectableTopics[0]?.id;
    const t = topics.find((x) => x.id === tId);
    // Une formation à date fixe n'a qu'une seule date possible : elle
    // remplace la liste de samedis à cocher.
    setModal({ topicId: tId, dates: t?.fixedDate ? [t.fixedDate] : (dateIso ? [dateIso] : []) });
    setForm({ name: '', email: '' });
    setStatus({ loading: false, error: '', results: [] });
  }
  function closeModal() { setModal(null); }

  function selectModalTopic(topicId) {
    const t = topics.find((x) => x.id === topicId);
    setModal((m) => ({ ...m, topicId, dates: t?.fixedDate ? [t.fixedDate] : [] }));
  }

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
    const threshold = Number.isFinite(modalTopic?.minParticipants) ? modalTopic.minParticipants : VALIDATION_THRESHOLD;
    if (r.ok) return r.validated ? '🎉 Formation validée !' : `Confirmée (${Math.max(0, threshold - r.count)} inscription(s) avant validation)`;
    if (r.error === 'full') return 'Session déjà complète';
    if (r.error === 'already_registered') return 'Déjà inscrit(e) sur cette session';
    if (r.error === 'topic_archived') return "Cette formation n'est plus proposée";
    if (r.error === 'date_closed') return "Cette date n'est pas disponible";
    if (r.error === 'date_taken') return "Une autre formation a déjà été validée (ou réservée) à cette date";
    return 'Erreur, réessayez';
  }

  return (
    <>
      <Head>
        <title>Workshops Filme — Ateliers du samedi</title>
        <meta name="description" content={`Ateliers pratiques du samedi chez Filme : prise en main du matériel de location, 149 € HT, ${CAPACITY} places maximum.`} />
      </Head>

      {isAdmin && <AdminBar onOpenPreferences={() => setShowPreferences(true)} />}
      <UserBar session={session} />

      <div className="page-crumb">
        <div className="brand-crumb">
          <a href="https://www.filme.fr" title="Retour à filme.fr">
            <img src="https://www.filme.fr/cdn/shop/files/Filme-Logo-sd.svg?v=1707646401&width=120" alt="Filme" className="logo" />
          </a>
          <nav className="breadcrumb"><a href="https://www.filme.fr">Home</a> {'>'} Workshops</nav>
        </div>
      </div>

      <section className="hero-banner">
        <div className="hero-bg">
          <ImgPlaceholder iconSize={40} />
        </div>
        <div className="hero-banner-inner">
          <div className="hero-copy">
            <EditableText isAdmin={isAdmin} tag="h1" value={content.hero_title} onSave={(v) => saveContent('hero_title', v)} />
            <EditableText isAdmin={isAdmin} tag="p" className="lead" multiline value={content.hero_lead} onSave={(v) => saveContent('hero_lead', v)} />
            <div className="hero-stats">
              <div className="stat-item">
                <span className="icon-wrap"><Icon name="price" /></span>
                <EditableText isAdmin={isAdmin} tag="strong" value={content.price_label} onSave={(v) => saveContent('price_label', v)} />
              </div>
              <div className="stat-item">
                <span className="icon-wrap"><Icon name="users" /></span>
                <EditableText isAdmin={isAdmin} tag="strong" value={content.pill_capacity} onSave={(v) => saveContent('pill_capacity', v)} />
              </div>
              <div className="stat-item">
                <span className="icon-wrap"><Icon name="check" /></span>
                <EditableText isAdmin={isAdmin} tag="strong" value={content.pill_validation} onSave={(v) => saveContent('pill_validation', v)} />
              </div>
              <div className="stat-item">
                <span className="icon-wrap"><Icon name="shield" /></span>
                <EditableText isAdmin={isAdmin} tag="strong" value={content.pill_audience} onSave={(v) => saveContent('pill_audience', v)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="page" style={isAdmin ? { paddingBottom: 70 } : undefined}>
        <section className="section">
          <div className="section-head">
            <div>
              <EditableText isAdmin={isAdmin} tag="h2" value={content.sessions_heading} onSave={(v) => saveContent('sessions_heading', v)} />
              <EditableText isAdmin={isAdmin} tag="span" className="hint" value={content.sessions_hint} onSave={(v) => saveContent('sessions_hint', v)} />
            </div>
          </div>
          {sessions.length > 0 && (
            <div className="filter-sort-row">
              {usedSessionTypes.length > 1 && (
                <div className="filter-row">
                  <span className="sort-label">Filtrer par :</span>
                  <SessionTypeFilter
                    options={usedSessionTypes}
                    selected={sessionTypeFilter}
                    onToggle={toggleSessionType}
                    onReset={() => setSessionTypeFilter([])}
                  />
                </div>
              )}
              <div className="sort-row" style={{ marginLeft: 'auto' }}>
                <span className="sort-label">Trier par :</span>
                <div className="sort-select-wrap">
                  <select className="sort-select" value={sessionSort} onChange={(e) => setSessionSort(e.target.value)}>
                    <option value="rate">Taux de remplissage</option>
                    <option value="date">Date</option>
                  </select>
                  <Icon name="chevronDown" size={14} />
                </div>
              </div>
            </div>
          )}
          <div className="card">
            {sessions.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📅</div>
                Aucune session pour le moment. Choisissez une formation ci-dessous pour proposer un samedi.
              </div>
            ) : visibleSessions.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📅</div>
                Aucune session ne correspond à ce filtre.
              </div>
            ) : (
              visibleSessions.map((s) => {
                // La barre représente la capacité max (1 inscrit = 1/capacity de la
                // largeur), et le remplissage passe au vert une fois le seuil de
                // validation atteint.
                const pct = Math.min(100, Math.round((s.count / s.capacity) * 100));
                const isFull = s.count >= s.capacity;
                const badge = (
                  <span className={`badge ${s.validated ? 'badge-green' : 'badge-blue'}`}>
                    {Math.max(0, s.capacity - s.count)} places dispo
                  </span>
                );

                return (
                  <div className="chart-row" key={s.id}>
                    <div className="meta">
                      <ImgPlaceholder className="session-thumb" iconSize={18} />
                      <div className="meta-text">
                        <div className="date-label"><Icon name="calendar" size={13} /> {s.dateLabel}</div>
                        <div className="topic-title">{s.topic.title}</div>
                        <div className="topic-meta">{s.topic.type || 'Formation'} · {formatPrice(s.topic.price)}</div>
                      </div>
                    </div>
                    <div className="bar-col">
                      <div className="bar-track">
                        <div className={`bar-fill ${s.validated ? 'full' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="bar-count">
                        {s.count}/{s.capacity} inscrits · {s.validated ? 'Session confirmée' : `Plus que ${Math.max(0, s.threshold - s.count)} pour confirmer`}
                      </div>
                    </div>
                    <div className="action">
                      {badge}
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isFull}
                        onClick={() => openModal(s.topicId, s.dateIso)}
                      >
                        {isFull ? 'Complet' : <>S'inscrire <Icon name="arrowRight" size={14} /></>}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="section">
          <div style={{ padding: '28px 0' }}>
            <div className="timeline">
              {[1, 2, 3, 4].map((n, i) => (
                <div className="timeline-step" key={n}>
                  <div className="timeline-icon">
                    <Icon name={['cap', 'calendar', 'bell', 'mail'][i]} size={22} />
                  </div>
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
              <span className="en-icon"><Icon name="info" size={18} /></span>
              <p>
                <EditableText isAdmin={isAdmin} tag="span" multiline value={content.engagement_note} onSave={(v) => saveContent('engagement_note', v)} />
                {' '}
                <button type="button" className="link-btn" onClick={() => setShowTerms(true)}>
                  Voir les conditions générales <Icon name="arrowRight" size={14} />
                </button>
              </p>
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
          <div className="filter-sort-row">
            {usedTopicTypes.length > 1 && (
              <div className="filter-row">
                <span className="sort-label">Filtrer par :</span>
                <SessionTypeFilter
                  options={usedTopicTypes}
                  selected={topicTypeFilter}
                  onToggle={toggleTopicType}
                  onReset={() => setTopicTypeFilter([])}
                />
              </div>
            )}
            <div className="sort-row" style={{ marginLeft: 'auto' }}>
              <span className="sort-label">Trier par :</span>
              <div className="sort-select-wrap">
                <select className="sort-select" value={topicSort} onChange={(e) => setTopicSort(e.target.value)}>
                  <option value="">Par défaut</option>
                  <option value="newest">Nouveautés</option>
                  <option value="price_desc">Prix du + cher au - cher</option>
                  <option value="price_asc">Prix du - cher au + cher</option>
                  <option value="popular">Les plus demandées</option>
                </select>
                <Icon name="chevronDown" size={14} />
              </div>
            </div>
          </div>

          {topics.length === 0 && !isAdmin ? (
            <div className="card"><div className="empty">Aucune formation disponible pour le moment.</div></div>
          ) : filteredTopics.length === 0 ? (
            <div className="card"><div className="empty">Aucune formation ne correspond à ce filtre.</div></div>
          ) : (
            <div className="topics-grid">
              {filteredTopics.map((t) => (
                <TopicCard key={t.id} topic={t} index={topics.indexOf(t)} isAdmin={isAdmin} onOpenRegister={(id) => openModal(id, null)} onSaved={updateTopicInList} onDeleted={removeTopicFromList} onTopicsReplaced={setTopics} />
              ))}
              {isAdmin && <NewTopicCard onCreated={addTopicToList} />}
            </div>
          )}
        </section>

        <div className="feature-strip">
          <div className="feature-item">
            <span className="icon-circle"><Icon name="users" size={18} /></span>
            <div>
              <EditableText isAdmin={isAdmin} tag="strong" value={content.feature_1_title} onSave={(v) => saveContent('feature_1_title', v)} />
              <EditableText isAdmin={isAdmin} tag="p" value={content.feature_1_desc} onSave={(v) => saveContent('feature_1_desc', v)} />
            </div>
          </div>
          <div className="feature-item">
            <span className="icon-circle"><Icon name="check" size={18} /></span>
            <div>
              <EditableText isAdmin={isAdmin} tag="strong" value={content.feature_2_title} onSave={(v) => saveContent('feature_2_title', v)} />
              <EditableText isAdmin={isAdmin} tag="p" value={content.feature_2_desc} onSave={(v) => saveContent('feature_2_desc', v)} />
            </div>
          </div>
          <div className="feature-item">
            <span className="icon-circle"><Icon name="shield" size={18} /></span>
            <div>
              <EditableText isAdmin={isAdmin} tag="strong" value={content.feature_3_title} onSave={(v) => saveContent('feature_3_title', v)} />
              <EditableText isAdmin={isAdmin} tag="p" value={content.feature_3_desc} onSave={(v) => saveContent('feature_3_desc', v)} />
            </div>
          </div>
        </div>

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
            <div className="modal-sub">
              {formatPrice(modalTopic?.price)} — {modalTopic?.maxParticipants || CAPACITY} places maximum
              {modalTopic?.fixedDate ? '' : " · Dates flexibles : choisis tes dispos pour cette formation et si une date atteint le minimum d'inscriptions requises elle sera validée."}
            </div>

            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">Formation</label>
                <select
                  className="form-input"
                  value={modal.topicId}
                  onChange={(e) => selectModalTopic(e.target.value)}
                >
                  {selectableTopics.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                {modalTopic && (
                  <button
                    type="button"
                    className="link-btn"
                    style={{ marginTop: 6 }}
                    onClick={() => setShowModalTopicDetail(true)}
                  >
                    En savoir plus
                  </button>
                )}
              </div>

              {modalTopic?.fixedDate ? (
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <div className="checkbox-list">
                    <div className="checkbox-item">Le {formatSaturday(modalTopic.fixedDate)} — date fixe, non modifiable</div>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">
                    {scheduleOption(modalTopic?.scheduleMode).plural} ({modal.dates.length} sélectionné{modal.dates.length > 1 ? 's' : ''})
                  </label>
                  <div className="checkbox-list">
                    {modalDates.map((d) => {
                      // Un seul évènement par date : les dates déjà validées pour une
                      // AUTRE formation, ou réservées par la date fixe d'une autre
                      // formation, ne sont plus proposables ici.
                      const takenByOther =
                        sessions.some((s) => s.validated && s.dateIso === d && s.topicId !== modal.topicId) ||
                        topics.some((t) => t.fixedDate === d && t.id !== modal.topicId);
                      return (
                        <label className={`checkbox-item ${takenByOther ? 'checkbox-item-disabled' : ''}`} key={d}>
                          <input
                            type="checkbox"
                            checked={modal.dates.includes(d)}
                            disabled={takenByOther}
                            onChange={() => toggleDate(d)}
                          />
                          {formatSaturday(d)}{takenByOther ? ' — réservé par une autre formation' : ''}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

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

      {showModalTopicDetail && modalTopic && (
        <TopicDetailModal
          topic={modalTopic}
          onClose={() => setShowModalTopicDetail(false)}
          onRegister={() => {}}
        />
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

      {showPreferences && (
        <PreferencesModal
          closedDates={closedDates}
          onToggle={toggleClosedDate}
          onSessionsChanged={refreshSessions}
          topics={topics}
          onTopicDeleted={removeTopicFromList}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </>
  );
}

export async function getServerSideProps(ctx) {
  const session = getSession(ctx.req);
  const isAdmin = !!session?.isAdmin;

  try {
    const [sessions, topics, content, closedDates] = await Promise.all([
      getOpenSessions(),
      isAdmin ? getAllTopics() : getVisibleTopics(),
      getSiteContent(),
      getClosedDates(),
    ]);
    return {
      props: {
        initialSessions: sessions,
        initialTopics: topics,
        initialContent: content,
        initialClosedDates: closedDates,
        isAdmin,
        session: session || null,
      },
    };
  } catch (err) {
    console.error('[index] getServerSideProps', err);
    return {
      props: {
        initialSessions: [],
        initialTopics: [],
        initialContent: CONTENT_DEFAULTS,
        initialClosedDates: [],
        isAdmin,
        session: session || null,
      },
    };
  }
}
