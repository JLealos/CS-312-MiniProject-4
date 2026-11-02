import { useEffect, useState } from 'react';
import { api } from '../api';
import { PostCard } from './PostList';

function ProfileDetails({ user, onSaved }) {
  const [editing, setEditing] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [name, setName] = useState(''), [age, setAge] = useState('');
  const [occupation, setOccupation] = useState(''), [city, setCity] = useState('');
  function edit() {
    setName(user.name); setAge(user.age ?? '');
    setOccupation(user.occupation || ''); setCity(user.city || '');
    setError(''); setMessage(''); setEditing(true);
  }
  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const result = await api('/profile', { method: 'PUT', body: { name, age, occupation, city } });
      onSaved(result.user); setEditing(false); setMessage('Profile updated.');
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }
  return <>
    {message && <div className="alert alert-success" role="status">{message}</div>}
    {editing ? <form onSubmit={save}>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <p className="profile-details">Username: <strong>{user.user_id}</strong></p>
      <fieldset disabled={saving}>
        <div className="mb-3"><label className="form-label" htmlFor="profile-name">Name</label><input autoFocus className="form-control" id="profile-name" autoComplete="name" maxLength={255} value={name} onChange={e => setName(e.target.value)} required /></div>
        <div className="mb-3"><label className="form-label" htmlFor="profile-age">Age (optional)</label><input className="form-control" id="profile-age" type="number" min="0" max="120" step="1" value={age} onChange={e => setAge(e.target.value)} /></div>
        <div className="mb-3"><label className="form-label" htmlFor="profile-occupation">Occupation (optional)</label><input className="form-control" id="profile-occupation" autoComplete="organization-title" maxLength={255} value={occupation} onChange={e => setOccupation(e.target.value)} /></div>
        <div className="mb-3"><label className="form-label" htmlFor="profile-city">City (optional)</label><input className="form-control" id="profile-city" autoComplete="address-level2" maxLength={255} value={city} onChange={e => setCity(e.target.value)} /></div>
        <button className="btn btn-primary" type="submit">{saving ? 'Saving...' : 'Save profile'}</button>
        <button className="btn btn-link" type="button" onClick={() => { setEditing(false); setError(''); }}>Cancel</button>
      </fieldset>
    </form> : <>
      <dl className="mb-3 profile-details">
        <dt>Username</dt><dd>{user.user_id}</dd>
        <dt>Name</dt><dd>{user.name}</dd>
        <dt>Age</dt><dd>{user.age ?? 'Not provided'}</dd>
        <dt>Occupation</dt><dd>{user.occupation || 'Not provided'}</dd>
        <dt>City</dt><dd className="mb-0">{user.city || 'Not provided'}</dd>
      </dl>
      <button className="btn btn-outline-primary" onClick={edit}>Edit profile</button>
    </>}
  </>;
}

export default function MyProfile({ user, navigate, onUserUpdated }) {
  const [profile, setProfile] = useState(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    api('/profile', { signal: controller.signal }).then(setProfile).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.user_id, revision]);

  async function mutate(id, reaction) {
    if (!reaction && !window.confirm('Delete this post? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      const result = await api(`/posts/${id}${reaction ? '/react' : ''}`, {
        method: reaction ? 'POST' : 'DELETE', body: reaction ? { reaction } : undefined,
      });
      setProfile(current => ({ ...current, posts: reaction
        ? current.posts.map(post => post.id === id ? result.post : post)
        : current.posts.filter(post => post.id !== id) }));
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  return <main className="container py-4">
    <h1 className="h2 mb-4">My Profile</h1>
    {!user ? <div className="alert alert-light border">Sign in to view your profile. <button className="btn btn-link" onClick={() => navigate('/signin')}>Sign in</button></div> : <>
      {error && <div className="alert alert-danger" role="alert">{error} <button className="btn btn-sm btn-outline-danger" onClick={() => setRevision(n => n + 1)}>Retry</button></div>}
      {loading ? <p role="status">Loading your profile...</p> : profile && <div className="row g-4">
        <aside className="col-lg-4"><section className="card p-4" aria-labelledby="profile-details-heading">
          <h2 className="h4" id="profile-details-heading">Your details</h2>
          <ProfileDetails user={profile.user} onSaved={updated => {
            setProfile(current => ({ ...current, user: updated }));
            onUserUpdated(updated);
          }} />
        </section></aside>
        <section className="col-lg-8" aria-labelledby="profile-posts-heading">
          <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
            <div><h2 className="h3 mb-1" id="profile-posts-heading">Your posts</h2><p className="text-secondary mb-0">{profile.posts.length} {profile.posts.length === 1 ? 'entry' : 'entries'}</p></div>
            <button className="btn btn-outline-primary" onClick={() => navigate('/')}>Visit the notebook</button>
          </div>
          {!profile.posts.length && <div className="alert alert-light border">You haven't published any posts yet. Visit the notebook to start a new entry.</div>}
          <div className="row g-3" aria-busy={busy}>{profile.posts.map(post => <PostCard key={post.id} post={post} user={user} navigate={navigate}
            onTag={tag => navigate(`/?tag=${encodeURIComponent(tag)}`)} onDelete={id => mutate(id)} onReact={mutate} busy={busy} />)}</div>
        </section>
      </div>}
    </>}
  </main>;
}
