import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { getOpenSessions } from '../lib/sessions';
import { getVisibleTopics, getAllTopics, CAPACITY, VALIDATION_THRESHOLD, PRICE_LABEL, TOPIC_CATEGORIES, TOPIC_TYPES, SCHEDULE_OPTIONS, nextWeekdayDates, topicWeekday, scheduleOption, yearSaturdays, formatSaturday, formatPrice, parsePriceValue } from '../lib/topics';
import { getSiteContent, CONTENT_DEFAULTS } from '../lib/content';
import { getClosedDates } from '../lib/closedDates';
import { getAllFormateurs, getVisibleFormateurs } from '../lib/formateurs';
import { getSession } from '../lib/auth';
import AdminBar from '../components/AdminBar';
import UserBar from '../components/UserBar';
import Icon, { ICON_PATHS } from '../components/Icon';

// ─── Vignette placeholder (tant qu'aucune vraie photo n'est fournie) ─────────
function ImgPlaceholder({ className, iconSize = 22 }) {
  return (
    <div className={`img-placeholder ${className || ''}`}>
      <Icon name="camera" size={iconSize} />
    </div>
  );
}

// ─── Sélecteur d'icône (admin) — cliquer l'icône ouvre un petit choix ────────
const BULLET_ICON_CHOICES = Object.keys(ICON_PATHS);

function BulletIconPicker({ isAdmin, icon, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!isAdmin) {
    return <span className="icon-wrap"><Icon name={icon} /></span>;
  }

  return (
    <span className="icon-wrap icon-picker" ref={ref}>
      <button type="button" className="icon-picker-trigger" onClick={() => setOpen((o) => !o)} title="Changer l'icône">
        <Icon name={icon} />
      </button>
      {open && (
        <span className="icon-picker-panel">
          {BULLET_ICON_CHOICES.map((name) => (
            <button
              key={name}
              type="button"
              className={`icon-picker-option ${name === icon ? 'active' : ''}`}
              onClick={() => { onChange(name); setOpen(false); }}
              title={name}
            >
              <Icon name={name} size={16} />
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

// ─── Une bannière Hero du carrousel — titre + texte + puces + CTA, toutes
// éditables en place (mode admin). Toutes les bannières ont la même
// structure (contrairement à l'ancienne version où la 1ère bannière était un
// cas particulier) : elles sont interchangeables, ajoutables et supprimables
// depuis l'admin (cf. addHero/removeHero dans Home).
function DEFAULT_HERO_BULLETS() {
  return [
    { text: '', icon: 'users' },
    { text: '', icon: 'camera' },
    { text: '', icon: 'user' },
    { text: '', icon: 'shield' },
  ];
}

function newHero() {
  return {
    id: `hero-${Date.now()}`,
    title: 'Nouvelle bannière',
    lead: '',
    bullets: DEFAULT_HERO_BULLETS(),
    ctaText: '',
    ctaLink: '',
  };
}

// Lit la liste des bannières depuis le JSON stocké dans content.heroes_json —
// tableau vide (jamais d'exception) si absent/invalide, pour laisser
// l'appelant décider du repli (bannières par défaut).
function parseHeroes(raw) {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function HeroSlideEditor({ isAdmin, hero, onChange }) {
  const bullets = hero.bullets && hero.bullets.length ? hero.bullets : DEFAULT_HERO_BULLETS();

  function updateBullet(i, patch) {
    onChange({ bullets: bullets.map((b, bi) => (bi === i ? { ...b, ...patch } : b)) });
  }

  return (
    <div className="hero-copy">
      <EditableText isAdmin={isAdmin} tag="h1" value={hero.title} onSave={(v) => onChange({ title: v })} />
      <EditableText isAdmin={isAdmin} tag="p" className="lead" multiline value={hero.lead} onSave={(v) => onChange({ lead: v })} />
      <div className="hero-stats">
        {bullets.map((b, i) => (
          <div className="stat-item" key={i}>
            <BulletIconPicker isAdmin={isAdmin} icon={b.icon || 'users'} onChange={(name) => updateBullet(i, { icon: name })} />
            <EditableText isAdmin={isAdmin} tag="strong" value={b.text} onSave={(v) => updateBullet(i, { text: v })} />
          </div>
        ))}
      </div>
      {(isAdmin || (hero.ctaText && hero.ctaLink)) && (
        <div className="hero-cta-row">
          <a
            className="hero-cta"
            href={hero.ctaLink || '#'}
            onClick={(e) => { if (isAdmin) e.preventDefault(); }}
          >
            <EditableText isAdmin={isAdmin} tag="span" value={hero.ctaText || (isAdmin ? 'Texte du bouton' : '')} onSave={(v) => onChange({ ctaText: v })} />
            <Icon name="arrowRight" size={14} />
          </a>
          {isAdmin && (
            <span className="hero-cta-link-edit">
              Lien :{' '}
              <EditableText isAdmin={isAdmin} tag="span" value={hero.ctaLink || ''} onSave={(v) => onChange({ ctaLink: v })} />
            </span>
          )}
        </div>
      )}
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

// Catégorie utilisée par le filtre "Statut" (Formations disponibles) : une
// formation à date fixe est "Programmée", tout comme une formation à planning
// flexible dont une session a déjà atteint le seuil de validation (elle a
// donc, elle aussi, une date confirmée) — les autres restent "Date flexible".
function topicStatusLabel(topic, sessions) {
  const hasValidatedSession = sessions.some((s) => s.topicId === topic.id && s.validated);
  return topic.scheduleMode === 'fixed' || hasValidatedSession ? 'Programmé' : 'Date flexible';
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
    formateurId: topic?.formateurId || '',
  };
}

function TopicFormModal({ mode, topic, onClose, onSaved, onTopicsReplaced, formateurs }) {
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
    if (!form.formateurId) { setError('Le formateur est requis.'); return; }
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
            <label className="form-label">Formateur</label>
            <select className="form-input" value={form.formateurId} onChange={(e) => set('formateurId', e.target.value)} required>
              <option value="">— Choisir un formateur —</option>
              {formateurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {formateurs.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                Aucun formateur pour l'instant — ajoutez-en un dans Préférences → Formateurs avant de créer une formation.
              </div>
            )}
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
          {[formatPrice(topic.price), topic.level, topic.duration || '1 journée (9h–18h)', `${topic.maxParticipants || CAPACITY} participants max`].filter(Boolean).join(' · ')}
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
function TopicCard({ topic, index, isAdmin, onOpenRegister, onSaved, onDeleted, onTopicsReplaced, formateurs }) {
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
        <div className="level">{[formatPrice(topic.price), topic.level, topic.duration || '1 journée (9h–18h)'].filter(Boolean).join(' · ')}</div>
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
        <TopicFormModal mode="edit" topic={topic} onClose={() => setShowEdit(false)} onSaved={onSaved} onTopicsReplaced={onTopicsReplaced} formateurs={formateurs} />
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
function NewTopicCard({ onCreated, formateurs }) {
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
        <TopicFormModal mode="create" topic={null} onClose={() => setOpen(false)} onSaved={onCreated} formateurs={formateurs} />
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

// ─── Onglet Préférences — gestion des formateurs (CRUD) ──────────────────────
const WEEKDAYS = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
  { key: 'samedi', label: 'Samedi' },
  { key: 'dimanche', label: 'Dimanche' },
];

// Heures rondes seulement (pas de minutes) pour les créneaux de disponibilité.
const AVAILABILITY_HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

// Complète les jours manquants par un tableau vide, et la liste de dates
// ponctuelles — pour toujours itérer sur une forme complète quel que soit
// l'état (partiel ou vide) stocké en base.
function normalizeAvailability(a) {
  const base = {};
  WEEKDAYS.forEach((d) => { base[d.key] = Array.isArray(a?.[d.key]) ? a[d.key] : []; });
  base.dates = Array.isArray(a?.dates) ? a.dates : [];
  base.dateOverrides = Array.isArray(a?.dateOverrides) ? a.dateOverrides : [];
  return base;
}

const CAL_MONTH_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const CAL_WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
// Indexé par Date.getDay() (0 = dimanche ... 6 = samedi) — pour retrouver la
// clé WEEKDAYS (et donc les créneaux récurrents applicables) d'une date du calendrier.
const JS_DAY_TO_WEEKDAY_KEY = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function weekdayKeyForDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return JS_DAY_TO_WEEKDAY_KEY[d.getDay()];
}

function toIsoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildMonthCells(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

// Petit calendrier mensuel : on clique sur un jour pour le marquer (ou
// démarquer) comme disponible.
// - variant "compact" (par défaut) : le jour sélectionné s'affiche avec une croix.
// - variant "detailed" : cases plus grandes, affichant directement les
//   horaires applicables (créneaux du jour de semaine correspondant, ou
//   l'horaire d'une "date spécifique" le cas échéant) au lieu d'une croix.
function AvailabilityCalendar({ dates, onToggle, variant = 'compact', weeklySlots, dateOverrides }) {
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells = buildMonthCells(monthDate);
  const selectedSet = new Set(dates || []);
  const overrideMap = new Map((dateOverrides || []).map((o) => [o.date, o]));
  const detailed = variant === 'detailed';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{CAL_MONTH_LABELS[monthDate.getMonth()]} {monthDate.getFullYear()}</div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 4 }}>
        {CAL_WEEKDAY_LABELS.map((l) => <div key={l}>{l}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const iso = toIsoLocal(d);
          const isPast = d < today;
          const isSelected = selectedSet.has(iso);
          const isToday = d.getTime() === today.getTime();
          const override = overrideMap.get(iso);
          const slots = override ? [{ start: override.start, end: override.end }] : (weeklySlots?.[weekdayKeyForDate(iso)] || []);

          if (!detailed) {
            return (
              <button
                key={iso}
                type="button"
                disabled={isPast}
                onClick={() => onToggle(iso)}
                title={isSelected ? 'Retirer — ne sera plus présent ce jour-là' : 'Marquer comme présent ce jour-là'}
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: isPast ? 'default' : 'pointer',
                  border: isToday ? '1px solid var(--red)' : '1px solid var(--border)',
                  background: isSelected ? '#e8ab5c' : 'transparent',
                  color: isSelected ? '#fff' : isPast ? 'var(--text-muted)' : 'var(--text)',
                  opacity: isPast ? 0.4 : 1,
                }}
              >
                {isSelected ? '✕' : d.getDate()}
              </button>
            );
          }

          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => onToggle(iso)}
              title={isSelected ? 'Retirer — ne sera plus présent ce jour-là' : 'Marquer comme présent ce jour-là'}
              style={{
                minHeight: 54,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 2,
                padding: '4px 2px',
                borderRadius: 6,
                cursor: isPast ? 'default' : 'pointer',
                border: isToday ? '1px solid var(--red)' : '1px solid var(--border)',
                background: isSelected ? 'rgba(232,171,92,0.12)' : 'transparent',
                opacity: isPast ? 0.4 : 1,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: isSelected ? 700 : 400, color: isPast ? 'var(--text-muted)' : 'var(--text)' }}>{d.getDate()}</span>
              {isSelected && (
                slots.length > 0 ? (
                  <span style={{ fontSize: 9.5, lineHeight: 1.2, color: override ? '#b5732a' : 'var(--text-muted)', textAlign: 'center' }}>
                    {slots.map((s, si) => <div key={si}>{s.start}–{s.end}</div>)}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--red)' }} title="Aucun créneau défini pour ce jour de la semaine">⚠</span>
                )
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Éditeur "agenda" des disponibilités :
// - créneaux horaires récurrents chaque semaine (heures rondes) par jour ;
// - un calendrier pour cocher des dates ponctuelles disponibles (sans horaire précis) ;
// - des "dates spécifiques" avec un horaire particulier, qui remplace les deux
//   règles ci-dessus pour cette date précise.
function AvailabilityEditor({ value, onChange }) {
  const [addingDay, setAddingDay] = useState(null);
  const [drafts, setDrafts] = useState(() => WEEKDAYS.reduce((acc, d) => ({ ...acc, [d.key]: { start: '', end: '' } }), {}));
  const [overrideDraft, setOverrideDraft] = useState({ date: '', start: '', end: '' });
  const [agendaView, setAgendaView] = useState('liste'); // 'liste' | 'calendrier'

  function setDraft(day, field, v) {
    setDrafts((d) => ({ ...d, [day]: { ...d[day], [field]: v } }));
  }

  function addSlot(day) {
    const { start, end } = drafts[day];
    if (!start || !end || start >= end) return;
    const dayList = value[day] || [];
    onChange({ ...value, [day]: [...dayList, { start, end }].sort((a, b) => a.start.localeCompare(b.start)) });
    setDrafts((d) => ({ ...d, [day]: { start: '', end: '' } }));
    setAddingDay(null);
  }

  function removeSlot(day, idx) {
    const dayList = (value[day] || []).slice();
    dayList.splice(idx, 1);
    onChange({ ...value, [day]: dayList });
  }

  function toggleDate(iso) {
    const dates = value.dates || [];
    const next = dates.includes(iso) ? dates.filter((d) => d !== iso) : [...dates, iso].sort();
    onChange({ ...value, dates: next });
  }

  function addOverride() {
    const { date, start, end } = overrideDraft;
    if (!date || !start || !end || start >= end) return;
    const overrides = (value.dateOverrides || []).filter((o) => o.date !== date);
    onChange({ ...value, dateOverrides: [...overrides, { date, start, end }].sort((a, b) => a.date.localeCompare(b.date)) });
    setOverrideDraft({ date: '', start: '', end: '' });
  }

  function removeOverride(idx) {
    const overrides = (value.dateOverrides || []).slice();
    overrides.splice(idx, 1);
    onChange({ ...value, dateOverrides: overrides });
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Créneaux de disponibilité</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {WEEKDAYS.map((d) => (
          <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 84, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{d.label}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(value[d.key] || []).map((slot, i) => (
                <span key={i} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {slot.start}–{slot.end}
                  <button
                    type="button"
                    onClick={() => removeSlot(d.key, i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 11, lineHeight: 1 }}
                    title="Retirer ce créneau"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            {addingDay === d.key ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <select className="form-input" style={{ width: 84, padding: '6px 8px' }} value={drafts[d.key].start} onChange={(e) => setDraft(d.key, 'start', e.target.value)}>
                  <option value="">--</option>
                  {AVAILABILITY_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <select className="form-input" style={{ width: 84, padding: '6px 8px' }} value={drafts[d.key].end} onChange={(e) => setDraft(d.key, 'end', e.target.value)}>
                  <option value="">--</option>
                  {AVAILABILITY_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => addSlot(d.key)}>Ajouter</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingDay(null)}>Annuler</button>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingDay(d.key)}>+ Ajouter un créneau</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Dates de disponibilité</div>
          <div style={{ display: 'flex', gap: 2, border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
            <button
              type="button"
              onClick={() => setAgendaView('liste')}
              title="Vue liste"
              style={{ display: 'flex', alignItems: 'center', border: 'none', borderRadius: 4, padding: '4px 6px', cursor: 'pointer', background: agendaView === 'liste' ? '#f2f2f2' : 'transparent', color: agendaView === 'liste' ? 'var(--text)' : 'var(--text-muted)' }}
            >
              <Icon name="list" size={14} />
            </button>
            <button
              type="button"
              onClick={() => setAgendaView('calendrier')}
              title="Vue calendrier"
              style={{ display: 'flex', alignItems: 'center', border: 'none', borderRadius: 4, padding: '4px 6px', cursor: 'pointer', background: agendaView === 'calendrier' ? '#f2f2f2' : 'transparent', color: agendaView === 'calendrier' ? 'var(--text)' : 'var(--text-muted)' }}
            >
              <Icon name="calendar" size={14} />
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Cocher les dates de présence — les horaires appliqués sont automatiquement ceux définis ci-dessus pour le jour de la semaine correspondant (ex : une date qui tombe un lundi applique les créneaux de « Lundi »).
        </div>
        {agendaView === 'liste' ? (
          <>
            <div style={{ maxWidth: 320, margin: '0 auto' }}>
              <AvailabilityCalendar dates={value.dates || []} onToggle={toggleDate} />
            </div>
            {(value.dates || []).length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(value.dates || []).slice().sort().map((iso) => {
                  const slots = value[weekdayKeyForDate(iso)] || [];
                  return (
                    <div key={iso} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{formatSaturday(iso)}</span>
                      {slots.length > 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>{slots.map((s) => `${s.start}–${s.end}`).join(', ')}</span>
                      ) : (
                        <span style={{ color: 'var(--red)' }}>⚠ Aucun créneau défini pour ce jour de la semaine</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <AvailabilityCalendar dates={value.dates || []} onToggle={toggleDate} variant="detailed" weeklySlots={value} dateOverrides={value.dateOverrides || []} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Date spécifique (horaire particulier)</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Pour une date précise avec un horaire différent — remplace, pour cette date, les créneaux hebdomadaires et la présence confirmée via le calendrier ci-dessus.
        </div>
        {(value.dateOverrides || []).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, alignItems: 'flex-start' }}>
            {(value.dateOverrides || []).map((o, i) => (
              <span key={`${o.date}-${i}`} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {formatSaturday(o.date)} : {o.start}–{o.end}
                <button
                  type="button"
                  onClick={() => removeOverride(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 11, lineHeight: 1 }}
                  title="Retirer cette date spécifique"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input type="date" className="form-input" style={{ width: 150, padding: '6px 8px' }} value={overrideDraft.date} onChange={(e) => setOverrideDraft((o) => ({ ...o, date: e.target.value }))} />
          <select className="form-input" style={{ width: 84, padding: '6px 8px' }} value={overrideDraft.start} onChange={(e) => setOverrideDraft((o) => ({ ...o, start: e.target.value }))}>
            <option value="">--</option>
            {AVAILABILITY_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <span style={{ color: 'var(--text-muted)' }}>–</span>
          <select className="form-input" style={{ width: 84, padding: '6px 8px' }} value={overrideDraft.end} onChange={(e) => setOverrideDraft((o) => ({ ...o, end: e.target.value }))}>
            <option value="">--</option>
            {AVAILABILITY_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addOverride}>+ Ajouter</button>
        </div>
      </div>
    </div>
  );
}

function emptyFormateurForm(f) {
  return {
    name: f?.name || '',
    email: f?.email || '',
    phone: f?.phone || '',
    bio: f?.bio || '',
    bioLong: f?.bioLong || '',
    specialties: f?.specialties || '',
    photoUrl: f?.photoUrl || '',
    availability: normalizeAvailability(f?.availability),
  };
}

function FormateurForm({ formateur, onCancel, onSaved, topics, onTopicUpdated, bordered = true }) {
  const [form, setForm] = useState(emptyFormateurForm(formateur));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [topicSavingId, setTopicSavingId] = useState(null);
  const [topicError, setTopicError] = useState('');

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function toggleTopicAssignment(topic, checked) {
    setTopicSavingId(topic.id);
    setTopicError('');
    try {
      const res = await fetch(`/api/admin/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formateurId: checked ? formateur.id : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onTopicUpdated?.(data.topic);
    } catch (err) {
      setTopicError(err.message || 'Erreur');
    } finally {
      setTopicSavingId(null);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Le nom est requis.'); return; }
    if (!form.email.trim()) { setError("L'email est requis."); return; }
    setLoading(true);
    setError('');
    try {
      const url = formateur ? `/api/admin/formateurs/${formateur.id}` : '/api/admin/formateurs';
      const method = formateur ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onSaved(data.formateur, !formateur);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={bordered ? { border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 12 } : undefined}>
      {error && <div className="form-error">{error}</div>}
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Nom</label>
          <input className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex : Jeanne Dupont" required />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Email de connexion</label>
          <input className="form-input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jeanne@filme.fr" required />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Téléphone</label>
          <input className="form-input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="06 12 34 56 78" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Bio courte</label>
        <textarea className="form-input" rows={2} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="1-3 phrases de présentation, affichées sur la carte formateur" />
      </div>
      <div className="form-group">
        <label className="form-label">Bio longue</label>
        <textarea className="form-input" rows={5} value={form.bioLong} onChange={(e) => set('bioLong', e.target.value)} placeholder="Présentation détaillée, affichée dans la popup « En savoir plus »" />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Spécialité(s)</label>
          <input className="form-input" value={form.specialties} onChange={(e) => set('specialties', e.target.value)} placeholder="Ex : Prise de vue, Étalonnage" />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Photo (URL)</label>
          <input className="form-input" value={form.photoUrl} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://…" />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Disponibilités</label>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <AvailabilityEditor value={form.availability} onChange={(v) => set('availability', v)} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Créneaux horaires récurrents chaque semaine, plus des dates ponctuelles si besoin — usage interne pour la
          planification, non affichés publiquement.
        </div>
      </div>

      {formateur ? (
        <div className="form-group">
          <label className="form-label">Formations assignées</label>
          {topicError && <div className="form-error">{topicError}</div>}
          {!topics || topics.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune formation pour le moment.</div>
          ) : (
            <div className="checkbox-list">
              {topics.map((t) => (
                <label className={`checkbox-item ${topicSavingId === t.id ? 'checkbox-item-disabled' : ''}`} key={t.id}>
                  <input
                    type="checkbox"
                    checked={t.formateurId === formateur.id}
                    disabled={topicSavingId === t.id}
                    onChange={(e) => toggleTopicAssignment(t, e.target.checked)}
                  />
                  {t.title}{t.archived ? ' (archivée)' : ''}
                </label>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          L'assignation des formations sera possible une fois le formateur créé.
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Enregistrement…' : formateur ? 'Enregistrer' : 'Ajouter le formateur'}
        </button>
      </div>
    </form>
  );
}

// Popup d'édition d'un formateur depuis sa carte homepage (réutilise
// FormateurForm, déjà utilisé "en ligne" dans Préférences → Formateurs).
function FormateurFormModal({ formateur, onClose, onSaved, topics, onTopicUpdated }) {
  const [showJson, setShowJson] = useState(false);
  return (
    <>
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {formateur && (
          <button
            type="button"
            className="link-btn"
            onClick={() => setShowJson(true)}
            style={{ position: 'absolute', top: 22, right: 52, fontSize: 13, whiteSpace: 'nowrap' }}
          >
            ⇅ Export / Import JSON
          </button>
        )}
        <h2>Éditer le formateur</h2>
        <div style={{ marginTop: 16 }}>
          <FormateurForm
            formateur={formateur}
            onCancel={onClose}
            onSaved={(f) => { onSaved(f); onClose(); }}
            topics={topics}
            onTopicUpdated={onTopicUpdated}
            bordered={false}
          />
        </div>
      </div>
    </div>
    {showJson && formateur && (
      <FormateurJsonModal
        formateur={formateur}
        onClose={() => setShowJson(false)}
        onImported={(f) => {
          // Le formulaire garde ses propres champs en mémoire (state local) :
          // après un import JSON, on ferme toute la modale plutôt que de la
          // laisser ouverte avec d'anciennes valeurs affichées (il fallait
          // sinon rouvrir la fenêtre pour voir les données importées).
          onSaved(f);
          setShowJson(false);
          onClose();
        }}
      />
    )}
    </>
  );
}

// Popup admin Export / Import JSON pour un formateur donné, accessible
// depuis "En savoir plus" — même mécanisme que TopicJsonModal, mais
// s'appuie directement sur PATCH /api/admin/formateurs/{id} (toujours mise à
// jour CE formateur, quel que soit le champ "id" présent dans le JSON collé).
function FormateurJsonModal({ formateur, onClose, onImported }) {
  const [tab, setTab] = useState('export');
  const [importText, setImportText] = useState(JSON.stringify(formateur, null, 2));
  const [log, setLog] = useState([]);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportText = JSON.stringify(formateur, null, 2);

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
      if (!parsed || typeof parsed !== 'object') throw new Error('Le JSON doit être un objet : { "name": "…", … }');
    } catch (err) {
      setLog([`✗ JSON invalide — ${err.message}`]);
      return;
    }
    if (!parsed.name?.trim?.()) { setLog(['✗ Le nom est requis']); return; }
    if (!parsed.email?.trim?.()) { setLog(["✗ L'email est requis"]); return; }

    setImporting(true);
    try {
      const res = await fetch(`/api/admin/formateurs/${formateur.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone ?? '',
          bio: parsed.bio ?? '',
          bioLong: parsed.bioLong ?? '',
          specialties: Array.isArray(parsed.specialties) ? parsed.specialties.join(', ') : (parsed.specialties ?? ''),
          photoUrl: parsed.photoUrl ?? '',
          availability: normalizeAvailability(parsed.availability),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      setLog([`✓ ${data.formateur.name} — mis à jour (id: ${data.formateur.id})`]);
      onImported(data.formateur);
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
        <h2>Export / Import — {formateur.name}</h2>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 12 }}>
          <button type="button" className={`btn btn-sm ${tab === 'export' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('export')}>Export</button>
          <button type="button" className={`btn btn-sm ${tab === 'import' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('import')}>Import</button>
        </div>

        {tab === 'export' ? (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
              Copiez ce JSON pour sauvegarder ou dupliquer ce formateur ailleurs.
            </p>
            <textarea
              className="form-input"
              readOnly
              rows={14}
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
              Collez le JSON de ce formateur (modifié si besoin) pour le mettre à jour. Le champ « id » est ignoré :
              cela met toujours à jour CE formateur, jamais n'en crée un autre.
            </p>
            <textarea
              className="form-input"
              rows={14}
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

// Popup public "En savoir plus" pour un formateur.
function FormateurDetailModal({ formateur, isAdmin, onClose, onSaved }) {
  const [showJson, setShowJson] = useState(false);
  const specialtyTags = (formateur.specialties || '').split(',').map((s) => s.trim()).filter(Boolean);
  return (
    <>
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {isAdmin && (
          <button
            type="button"
            className="link-btn"
            onClick={() => setShowJson(true)}
            style={{ position: 'absolute', top: 22, right: 52, fontSize: 13, whiteSpace: 'nowrap' }}
          >
            ⇅ Export / Import JSON
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          {formateur.photoUrl ? (
            <img src={formateur.photoUrl} alt={formateur.name} className="formateur-photo" style={{ width: 96, height: 96 }} />
          ) : (
            <div className="formateur-photo formateur-photo-placeholder" style={{ width: 96, height: 96 }}>
              <Icon name="user" size={36} />
            </div>
          )}
          <h2 style={{ margin: 0 }}>{formateur.name}</h2>
          {specialtyTags.length > 0 && (
            <div className="formateur-tags">
              {specialtyTags.map((s) => <span className={`badge ${categoryStyle(s).badgeClass}`} key={s}>{s}</span>)}
            </div>
          )}
          {(formateur.bioLong || formateur.bio) && (
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginTop: 12 }}>
              {formateur.bioLong || formateur.bio}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
    {showJson && (
      <FormateurJsonModal
        formateur={formateur}
        onClose={() => setShowJson(false)}
        onImported={(f) => { onSaved?.(f); setShowJson(false); }}
      />
    )}
    </>
  );
}

// Carte formateur — section publique "Nos formateurs". Toujours "En savoir
// plus" ; en admin, également Éditer / Archiver (même logique que TopicCard).
function FormateurCard({ formateur, isAdmin, onSaved, topics, onTopicUpdated }) {
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');
  const specialtyTags = (formateur.specialties || '').split(',').map((s) => s.trim()).filter(Boolean);

  async function toggleArchived() {
    setArchiving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/formateurs/${formateur.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !formateur.archived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onSaved(data.formateur);
    } catch (err) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="card formateur-card" style={{ opacity: formateur.archived ? 0.55 : 1 }}>
      {formateur.archived && <span className="badge badge-gray">Archivé</span>}
      {formateur.photoUrl ? (
        <img src={formateur.photoUrl} alt={formateur.name} className="formateur-photo" />
      ) : (
        <div className="formateur-photo formateur-photo-placeholder"><Icon name="user" size={26} /></div>
      )}
      <div className="formateur-name">{formateur.name}</div>
      {specialtyTags.length > 0 && (
        <div className="formateur-tags">
          {specialtyTags.map((s) => <span className={`badge ${categoryStyle(s).badgeClass}`} key={s}>{s}</span>)}
        </div>
      )}
      {formateur.bio && <p className="formateur-bio">{formateur.bio}</p>}

      {error && <div className="form-error">{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        <button type="button" className="link-btn" onClick={() => setShowDetail(true)}>En savoir plus</button>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>✏️ Éditer</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleArchived} disabled={archiving}>
              {archiving ? '…' : formateur.archived ? 'Désarchiver' : 'Archiver'}
            </button>
          </div>
        )}
      </div>

      {showDetail && <FormateurDetailModal formateur={formateur} isAdmin={isAdmin} onClose={() => setShowDetail(false)} onSaved={onSaved} />}
      {showEdit && (
        <FormateurFormModal
          formateur={formateur}
          onClose={() => setShowEdit(false)}
          onSaved={onSaved}
          topics={topics}
          onTopicUpdated={onTopicUpdated}
        />
      )}
    </div>
  );
}

function FormateursPreferences({ formateurs, onCreated, onUpdated, onDeleted, topics, onTopicUpdated }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  async function remove(f) {
    if (!window.confirm(`Supprimer définitivement « ${f.name} » ? Cette action est irréversible.`)) return;
    setDeletingId(f.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/formateurs/${f.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onDeleted(f.id);
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8, marginBottom: 16 }}>
        Les formateurs assignés aux formations reçoivent un lien de connexion dédié (comme l'admin) pour voir
        uniquement les sessions qui leur sont assignées. Ils sont aussi listés en bas de page.
      </p>

      {error && <div className="form-error">{error}</div>}

      {!showAdd ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(true)} style={{ marginBottom: 16 }}>
          + Ajouter un formateur
        </button>
      ) : (
        <FormateurForm
          onCancel={() => setShowAdd(false)}
          onSaved={(f) => { onCreated(f); setShowAdd(false); }}
        />
      )}

      {formateurs.length === 0 ? (
        <div className="empty">Aucun formateur pour le moment.</div>
      ) : (
        formateurs.map((f) =>
          editingId === f.id ? (
            <FormateurForm
              key={f.id}
              formateur={f}
              onCancel={() => setEditingId(null)}
              onSaved={(updated) => { onUpdated(updated); setEditingId(null); }}
              topics={topics}
              onTopicUpdated={onTopicUpdated}
            />
          ) : (
            <div
              key={f.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{f.name}</div>
                <div style={{ color: 'var(--text-muted)' }}>{f.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(f.id)}>✏️ Éditer</button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={deletingId === f.id}
                  onClick={() => remove(f)}
                  style={{ color: '#c0392b' }}
                >
                  {deletingId === f.id ? '…' : 'Supprimer'}
                </button>
              </div>
            </div>
          )
        )
      )}
    </>
  );
}

function PreferencesModal({ closedDates, onToggle, onSessionsChanged, topics, onTopicDeleted, onTopicUpdated, formateurs, onFormateurCreated, onFormateurUpdated, onFormateurDeleted, onClose }) {
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
          <button type="button" className={`btn btn-sm ${tab === 'formateurs' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('formateurs')}>Formateurs</button>
        </div>

        {tab === 'samedis' && <SaturdaysPreferences closedDates={closedDates} onToggle={onToggle} />}
        {tab === 'inscriptions' && <RegistrationsPreferences onChanged={onSessionsChanged} />}
        {tab === 'formations' && <ActiveTopicsPreferences topics={topics} onDeleted={onTopicDeleted} />}
        {tab === 'formateurs' && (
          <FormateursPreferences
            formateurs={formateurs}
            onCreated={onFormateurCreated}
            onUpdated={onFormateurUpdated}
            onDeleted={onFormateurDeleted}
            topics={topics}
            onTopicUpdated={onTopicUpdated}
          />
        )}

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
function SessionTypeFilter({ label = 'Type', options, selected, onToggle, onReset }) {
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
        {label} <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className="filter-panel">
          <div className="filter-panel-head">
            <strong>{label}</strong>
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

// Vue calendrier alternative pour "Événements à venir" : agenda mensuel avec
// les sessions placées sur leur date, cliquables (comme le bouton
// S'inscrire) — sauf si la session est complète.
function SessionsCalendar({ sessions, onSelect }) {
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells = buildMonthCells(monthDate);
  const byDate = new Map();
  sessions.forEach((s) => {
    const list = byDate.get(s.dateIso) || [];
    list.push(s);
    byDate.set(s.dateIso, list);
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{CAL_MONTH_LABELS[monthDate.getMonth()]} {monthDate.getFullYear()}</div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 6 }}>
        {CAL_WEEKDAY_LABELS.map((l) => <div key={l}>{l}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const iso = toIsoLocal(d);
          const isToday = d.getTime() === today.getTime();
          const isPast = d < today;
          const daySessions = byDate.get(iso) || [];
          const visible = daySessions.slice(0, 2);
          const extra = daySessions.length - visible.length;
          return (
            <div
              key={iso}
              style={{
                minHeight: 92,
                border: isToday ? '1px solid var(--red)' : '1px solid var(--border)',
                borderRadius: 6,
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                opacity: isPast && daySessions.length === 0 ? 0.5 : 1,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.getDate()}</div>
              {visible.map((s) => {
                const isFull = s.count >= s.capacity;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isFull}
                    onClick={() => onSelect(s)}
                    title={`${s.topic?.title || ''}${isFull ? ' — Complet' : ''}`}
                    style={{
                      textAlign: 'left',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 5px',
                      fontSize: 10.5,
                      lineHeight: 1.25,
                      cursor: isFull ? 'default' : 'pointer',
                      background: isFull ? 'var(--bg)' : s.validated ? 'rgba(74,160,110,0.18)' : 'rgba(90,120,220,0.16)',
                      color: isFull ? 'var(--text-muted)' : 'var(--text)',
                    }}
                  >
                    {s.topic?.title || 'Session'}
                  </button>
                );
              })}
              {extra > 0 && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>+{extra} autre{extra > 1 ? 's' : ''}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home({ initialSessions, initialTopics, initialContent, initialClosedDates, initialFormateurs, isAdmin, session }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [topics, setTopics] = useState(initialTopics);
  const [content, setContent] = useState(initialContent);
  const [formateurs, setFormateurs] = useState(initialFormateurs || []);
  const [heroSlide, setHeroSlide] = useState(0);
  // Bannières Hero : liste dynamique (ajout/suppression depuis l'admin),
  // repli sur les bannières par défaut si le JSON est absent/invalide.
  const parsedHeroes = parseHeroes(content.heroes_json);
  const heroes = parsedHeroes.length ? parsedHeroes : parseHeroes(CONTENT_DEFAULTS.heroes_json);
  const safeHeroSlide = Math.min(heroSlide, heroes.length - 1);
  // Défilement automatique du carrousel Hero (visiteurs uniquement — coupé en
  // mode admin pour ne pas changer de slide pendant une édition en cours).
  useEffect(() => {
    if (isAdmin) return;
    if (heroes.length <= 1) return;
    const id = setInterval(() => setHeroSlide((s) => (s + 1) % heroes.length), 6000);
    return () => clearInterval(id);
  }, [heroSlide, isAdmin, heroes.length]);
  const [modal, setModal] = useState(null); // { topicId, dates: string[] }
  const [showModalTopicDetail, setShowModalTopicDetail] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [status, setStatus] = useState({ loading: false, error: '', results: [] });
  const [showTerms, setShowTerms] = useState(false);
  const [showTopicsJson, setShowTopicsJson] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [closedDates, setClosedDates] = useState(initialClosedDates || []);
  const [sessionSort, setSessionSort] = useState('rate'); // 'rate' (défaut) ou 'date'
  const [sessionsView, setSessionsView] = useState('liste'); // 'liste' | 'calendrier'
  const [sessionTypeFilter, setSessionTypeFilter] = useState([]); // types cochés dans "Filtrer par : Type" ([] = tous)
  const [topicTypeFilter, setTopicTypeFilter] = useState([]); // idem pour "Formations disponibles"
  const [topicStatusFilter, setTopicStatusFilter] = useState([]); // filtre "Statut : Programmé / Date flexible"
  const [topicSort, setTopicSort] = useState(''); // '' (ordre par défaut), 'newest', 'price_desc', 'price_asc', 'popular'

  const selectableTopics = topics.filter((t) => !t.archived);
  const usedSessionTypes = [...new Set(sessions.map((s) => s.topic?.type || 'Formation'))];
  const usedTopicTypes = [...new Set(topics.map((t) => t.type || 'Formation'))];
  const usedTopicStatuses = [...new Set(topics.map((t) => topicStatusLabel(t, sessions)))];

  // Lien "dynamique" vers le catalogue (utilisé par le CTA des bannières
  // Hero, cf. hero.ctaLink) : ?type=…&statut=…&trie=… au chargement de la
  // page pré-sélectionne les filtres/tri du catalogue, puis fait défiler
  // jusqu'à la section #formations. Comparaison insensible aux accents/casse
  // pour rester tolérant sur la façon dont le lien a été tapé.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get('type');
    const statutParam = params.get('statut');
    const trieParam = params.get('trie');
    if (!typeParam && !statutParam && !trieParam) return;

    const normalize = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

    if (typeParam) {
      const wanted = typeParam.split(',').map(normalize);
      const matched = usedTopicTypes.filter((t) => wanted.includes(normalize(t)));
      if (matched.length) setTopicTypeFilter(matched);
    }
    if (statutParam) {
      const statusAliases = { programme: 'Programmé', flexible: 'Date flexible', datefexible: 'Date flexible' };
      const wanted = statutParam.split(',').map(normalize);
      const matched = usedTopicStatuses.filter((s) => wanted.includes(normalize(s)) || wanted.some((w) => normalize(statusAliases[w] || '') === normalize(s)));
      if (matched.length) setTopicStatusFilter(matched);
    }
    if (trieParam) {
      const sortAliases = {
        newest: 'newest', nouveaute: 'newest', nouveautes: 'newest',
        pricedesc: 'price_desc', prixdesc: 'price_desc',
        priceasc: 'price_asc', prixasc: 'price_asc',
        popular: 'popular', populaire: 'popular', populaires: 'popular',
      };
      const key = normalize(trieParam).replace(/[\s_-]+/g, '');
      if (sortAliases[key]) setTopicSort(sortAliases[key]);
    }

    requestAnimationFrame(() => {
      document.getElementById('formations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nombre total d'inscrits (toutes sessions à venir confondues) par formation
  // — sert de proxy à "Les plus demandées".
  const topicPopularity = new Map();
  sessions.forEach((s) => {
    topicPopularity.set(s.topicId, (topicPopularity.get(s.topicId) || 0) + s.count);
  });
  const filteredTopics = topics
    .filter((t) => !topicTypeFilter.length || topicTypeFilter.includes(t.type || 'Formation'))
    .filter((t) => !topicStatusFilter.length || topicStatusFilter.includes(topicStatusLabel(t, sessions)));
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
  function toggleTopicStatus(t) {
    setTopicStatusFilter((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));
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

  function addFormateurToList(created) {
    setFormateurs((list) => [...list, created]);
  }
  function updateFormateurInList(updated) {
    setFormateurs((list) => list.map((f) => (f.id === updated.id ? updated : f)));
  }
  function removeFormateurFromList(id) {
    setFormateurs((list) => list.filter((f) => f.id !== id));
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

  // Bannières Hero — toute la liste est réenregistrée à chaque modification
  // (une seule clé JSON en base, cf. lib/content.js heroes_json).
  function updateHeroes(nextHeroes) {
    saveContent('heroes_json', JSON.stringify(nextHeroes));
  }
  function updateHero(index, patch) {
    updateHeroes(heroes.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }
  function addHero() {
    const next = [...heroes, newHero()];
    updateHeroes(next);
    setHeroSlide(next.length - 1);
  }
  function removeHero(index) {
    if (heroes.length <= 1) return;
    if (!confirm('Supprimer cette bannière ?')) return;
    const next = heroes.filter((_, i) => i !== index);
    updateHeroes(next);
    setHeroSlide((s) => Math.min(s, next.length - 1));
  }
  function duplicateHero(index) {
    const clone = { ...heroes[index], id: `hero-${Date.now()}`, bullets: (heroes[index].bullets || []).map((b) => ({ ...b })) };
    const next = [...heroes.slice(0, index + 1), clone, ...heroes.slice(index + 1)];
    updateHeroes(next);
    setHeroSlide(index + 1);
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

  // Pour chaque date proposée dans le modal d'inscription : nombre d'inscrits
  // déjà connus pour cette formation à cette date, et statut (validée ou non).
  // Une date sans session existante n'a simplement encore aucun inscrit.
  function dateStatusLabel(dateIso) {
    if (!modalTopic) return '';
    const capacity = modalTopic.maxParticipants || CAPACITY;
    const threshold = Number.isFinite(modalTopic.minParticipants) ? modalTopic.minParticipants : VALIDATION_THRESHOLD;
    const session = sessions.find((s) => s.topicId === modalTopic.id && s.dateIso === dateIso);
    const count = session?.count || 0;
    const validated = !!session?.validated;
    return validated
      ? `(${count}/${capacity} · confirmé · reste ${Math.max(0, capacity - count)})`
      : `(${count}/${capacity} · non confirmé · manque ${Math.max(0, threshold - count)})`;
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
          <nav className="breadcrumb"><a href="https://www.filme.fr">Home</a> {'>'} Événements</nav>
        </div>
      </div>

      <section className="hero-banner">
        <div className="hero-bg">
          <ImgPlaceholder iconSize={40} />
        </div>

        {isAdmin && (
          <div className="hero-admin-actions">
            <button type="button" onClick={addHero}>+ Ajouter une bannière</button>
            <button type="button" onClick={() => duplicateHero(safeHeroSlide)}>⧉ Dupliquer cette bannière</button>
            <button type="button" onClick={() => removeHero(safeHeroSlide)} disabled={heroes.length <= 1}>
              Supprimer cette bannière
            </button>
          </div>
        )}

        <div className="hero-banner-inner">
          <HeroSlideEditor
            isAdmin={isAdmin}
            hero={heroes[safeHeroSlide]}
            onChange={(patch) => updateHero(safeHeroSlide, patch)}
          />
        </div>

        {heroes.length > 1 && (
          <>
            <button type="button" className="hero-arrow hero-arrow-prev" onClick={() => setHeroSlide((s) => (s + heroes.length - 1) % heroes.length)} aria-label="Bannière précédente">‹</button>
            <button type="button" className="hero-arrow hero-arrow-next" onClick={() => setHeroSlide((s) => (s + 1) % heroes.length)} aria-label="Bannière suivante">›</button>

            <div className="hero-dots">
              {heroes.map((h, i) => (
                <button
                  key={h.id || i}
                  type="button"
                  className={`hero-dot ${safeHeroSlide === i ? 'active' : ''}`}
                  onClick={() => setHeroSlide(i)}
                  aria-label={`Aller à la bannière ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
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
              {sessionsView === 'liste' && usedSessionTypes.length > 1 && (
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
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                {sessionsView === 'liste' && (
                  <div className="sort-row">
                    <span className="sort-label">Trier par :</span>
                    <div className="sort-select-wrap">
                      <select className="sort-select" value={sessionSort} onChange={(e) => setSessionSort(e.target.value)}>
                        <option value="rate">Taux de remplissage</option>
                        <option value="date">Date</option>
                      </select>
                      <Icon name="chevronDown" size={14} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 2, border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
                  <button
                    type="button"
                    onClick={() => setSessionsView('liste')}
                    title="Vue liste"
                    style={{ display: 'flex', alignItems: 'center', border: 'none', borderRadius: 4, padding: '5px 7px', cursor: 'pointer', background: sessionsView === 'liste' ? '#f2f2f2' : 'transparent', color: sessionsView === 'liste' ? 'var(--text)' : 'var(--text-muted)' }}
                  >
                    <Icon name="list" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionsView('calendrier')}
                    title="Vue calendrier"
                    style={{ display: 'flex', alignItems: 'center', border: 'none', borderRadius: 4, padding: '5px 7px', cursor: 'pointer', background: sessionsView === 'calendrier' ? '#f2f2f2' : 'transparent', color: sessionsView === 'calendrier' ? 'var(--text)' : 'var(--text-muted)' }}
                  >
                    <Icon name="calendar" size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
          {sessionsView === 'calendrier' && sessions.length > 0 ? (
            <div className="card" style={{ padding: 16 }}>
              {visibleSessions.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📅</div>
                  Aucune session ne correspond à ce filtre.
                </div>
              ) : (
                <SessionsCalendar sessions={visibleSessions} onSelect={(s) => openModal(s.topicId, s.dateIso)} />
              )}
            </div>
          ) : (
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
          )}
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

        <section className="section" id="formations" style={{ scrollMarginTop: 24 }}>
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
            {(usedTopicTypes.length > 1 || usedTopicStatuses.length > 1) && (
              <div className="filter-row">
                <span className="sort-label">Filtrer par :</span>
                {usedTopicTypes.length > 1 && (
                  <SessionTypeFilter
                    label="Type"
                    options={usedTopicTypes}
                    selected={topicTypeFilter}
                    onToggle={toggleTopicType}
                    onReset={() => setTopicTypeFilter([])}
                  />
                )}
                {usedTopicStatuses.length > 1 && (
                  <SessionTypeFilter
                    label="Statut"
                    options={usedTopicStatuses}
                    selected={topicStatusFilter}
                    onToggle={toggleTopicStatus}
                    onReset={() => setTopicStatusFilter([])}
                  />
                )}
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
                <TopicCard key={t.id} topic={t} index={topics.indexOf(t)} isAdmin={isAdmin} onOpenRegister={(id) => openModal(id, null)} onSaved={updateTopicInList} onDeleted={removeTopicFromList} onTopicsReplaced={setTopics} formateurs={formateurs} />
              ))}
              {isAdmin && <NewTopicCard onCreated={addTopicToList} formateurs={formateurs} />}
            </div>
          )}
        </section>

        {formateurs.length > 0 && (
          <section className="section">
            <div className="section-head">
              <div>
                <EditableText isAdmin={isAdmin} tag="h2" value={content.formateurs_heading} onSave={(v) => saveContent('formateurs_heading', v)} />
                <EditableText isAdmin={isAdmin} tag="span" className="hint" value={content.formateurs_hint} onSave={(v) => saveContent('formateurs_hint', v)} />
              </div>
            </div>
            <div className="formateurs-grid">
              {formateurs.map((f) => (
                <FormateurCard key={f.id} formateur={f} isAdmin={isAdmin} onSaved={updateFormateurInList} topics={topics} onTopicUpdated={updateTopicInList} />
              ))}
            </div>
          </section>
        )}

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
            <h2>S'inscrire à un événement</h2>

            <form onSubmit={submit}>
              <div className="form-group">
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
                  <div className="modal-sub" style={{ marginTop: 6 }}>
                    {modalTopic.type || 'Formation'} · {formatPrice(modalTopic.price)} · {modalTopic.maxParticipants || CAPACITY} places maximum
                  </div>
                )}
                {modalTopic && (
                  <button
                    type="button"
                    className="link-btn"
                    style={{ marginTop: 6, alignSelf: 'flex-start', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setShowModalTopicDetail(true)}
                  >
                    <Icon name="info" size={13} /> En savoir plus sur cet événement
                  </button>
                )}
              </div>

              {modalTopic?.fixedDate ? (
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <div className="checkbox-list">
                    <div className="checkbox-item">
                      <span>
                        Le {formatSaturday(modalTopic.fixedDate)} — date fixe, non modifiable
                        <span style={{ color: 'var(--text-muted)' }}> {dateStatusLabel(modalTopic.fixedDate)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">
                    Date(s) souhaitée(s) ({modal.dates.length} sélectionné{modal.dates.length > 1 ? 's' : ''})
                  </label>
                  <p className="modal-sub" style={{ margin: '-4px 0 2px' }}>
                    Dates flexibles : choisis tes dispos pour cette formation et si une date atteint le minimum d'inscriptions requises elle sera confirmée.
                  </p>
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
                          <span>
                            {formatSaturday(d)}
                            {takenByOther
                              ? ' — réservé par une autre formation'
                              : <span style={{ color: 'var(--text-muted)' }}> {dateStatusLabel(d)}</span>}
                          </span>
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
          onTopicUpdated={updateTopicInList}
          formateurs={formateurs}
          onFormateurCreated={addFormateurToList}
          onFormateurUpdated={updateFormateurInList}
          onFormateurDeleted={removeFormateurFromList}
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
    const [sessions, topics, content, closedDates, formateurs] = await Promise.all([
      getOpenSessions(),
      isAdmin ? getAllTopics() : getVisibleTopics(),
      getSiteContent(),
      getClosedDates(),
      isAdmin ? getAllFormateurs() : getVisibleFormateurs(),
    ]);
    return {
      props: {
        initialSessions: sessions,
        initialTopics: topics,
        initialContent: content,
        initialClosedDates: closedDates,
        initialFormateurs: formateurs,
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
        initialFormateurs: [],
        isAdmin,
        session: session || null,
      },
    };
  }
}
