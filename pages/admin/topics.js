import { useEffect, useState } from 'react';
import Head from 'next/head';
import { withAuth } from '../../lib/auth';
import AdminBar from '../../components/AdminBar';
import UserBar from '../../components/UserBar';

function NewTopicForm({ onCreated }) {
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
      <button className="btn btn-primary" onClick={() => setOpen(true)} style={{ marginBottom: 20 }}>
        + Nouvelle formation
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div className="card-title" style={{ padding: 0, border: 'none', marginBottom: 12 }}>Nouvelle formation</div>
      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
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
        <textarea className="form-input" rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Création…' : 'Créer'}</button>
      </div>
    </form>
  );
}

function TopicRow({ topic, onSaved }) {
  const [form, setForm] = useState({ title: topic.title, level: topic.level, desc: topic.desc });
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');

  function change(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  }

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
      setDirty(false);
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

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16, opacity: topic.archived ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 }}>
        <span className={`badge ${topic.archived ? 'badge-gray' : 'badge-green'}`}>
          {topic.archived ? 'Archivée (masquée)' : 'Visible sur le site'}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={toggleArchived} disabled={archiving}>
          {archiving ? '…' : topic.archived ? 'Désarchiver' : 'Archiver'}
        </button>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="form-group">
        <label className="form-label">Titre</label>
        <input className="form-input" value={form.title} onChange={(e) => change('title', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Niveau</label>
        <input className="form-input" value={form.level || ''} onChange={(e) => change('level', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-input" rows={3} value={form.desc || ''} onChange={(e) => change('desc', e.target.value)} />
      </div>

      {dirty && (
        <button className="btn btn-primary btn-sm" onClick={save} disabled={loading}>
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      )}
    </div>
  );
}

export default function AdminTopics({ admin }) {
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/topics')
      .then((r) => r.json())
      .then((d) => setTopics(d.topics || []))
      .catch(() => setError('Impossible de charger les formations'));
  }, []);

  function updateInList(updated) {
    setTopics((list) => list.map((t) => (t.id === updated.id ? updated : t)));
  }
  function addToList(created) {
    setTopics((list) => [...list, created]);
  }

  return (
    <>
      <Head>
        <title>Admin — Formations</title>
        <meta name="robots" content="noindex" />
      </Head>
      <AdminBar />
      <UserBar session={admin} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div className="page-header">
          <h1>Formations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Éditez les formations existantes, archivez celles que vous ne voulez plus proposer (elles restent
            visibles pour les sessions déjà ouvertes), ou créez-en de nouvelles.
          </p>
        </div>

        <NewTopicForm onCreated={addToList} />

        {error && <div className="form-error">{error}</div>}
        {!topics && !error && <div className="loading">Chargement…</div>}
        {topics && topics.map((t) => <TopicRow key={t.id} topic={t} onSaved={updateInList} />)}
      </div>
    </>
  );
}

export const getServerSideProps = withAuth(async (ctx) => {
  return { props: { admin: ctx.admin } };
});
