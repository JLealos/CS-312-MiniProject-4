import { useEffect, useState } from 'react';
import { api } from '../api';
import BlogPostForm from './BlogPostForm';
import { PostCard } from './PostList';

export default function PostPage({ id, editing, user, navigate }) {
  const [post, setPost] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api(`/posts/${id}`, { signal: controller.signal }).then(data => setPost(data.post)).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    });
    return () => controller.abort();
  }, [id]);
  async function react(id, reaction) {
    setBusy(true); setError('');
    try { setPost((await api(`/posts/${id}/react`, { method: 'POST', body: { reaction } })).post); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function remove(id) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setBusy(true); setError('');
    try { await api(`/posts/${id}`, { method: 'DELETE' }); navigate('/'); }
    catch (error) { setError(error.message); setBusy(false); }
  }
  return <main className="container py-4 edit-page"><button className="btn btn-link px-0 text-secondary" onClick={() => navigate('/')}>Back to all posts</button>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {!post && !error && <p role="status">Loading post…</p>}
    {post && (editing ? <section className="mt-3"><h1 className="h2">Edit post</h1>{user?.user_id === post.creatorUserId
      ? <BlogPostForm key={post.id} post={post} user={user} onCancel={() => navigate('/')} onSubmit={async body => { await api(`/posts/${id}`, { method: 'PUT', body }); navigate('/'); }} />
      : <div className="alert alert-warning" role="alert">You can only edit your own posts. {!user && <a href="/signin" onClick={e => { e.preventDefault(); navigate('/signin'); }}>Sign in</a>}</div>}</section>
      : <><h1 className="visually-hidden">View post</h1><div className="row"><PostCard post={post} user={user} navigate={navigate} onTag={tag => navigate(`/?tag=${encodeURIComponent(tag)}`)} onReact={react} onDelete={remove} busy={busy} /></div></>)}
  </main>;
}
