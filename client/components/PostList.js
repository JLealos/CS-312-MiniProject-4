import { useEffect, useState } from 'react';
import { api } from '../api';

export function PostCard({ post, user, navigate, onTag, onDelete, onReact, busy }) {
  return <article className="col-12"><div className="card post-card h-100"><div className="card-body">
    <div className="d-flex flex-wrap gap-2 justify-content-between mb-2 post-meta"><small className="text-secondary"><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time></small><small className="text-secondary">By {post.author}</small></div>
    <h3 className="card-title h4"><a className="post-title" href={`/posts/${post.id}`} onClick={e => { e.preventDefault(); navigate(`/posts/${post.id}`); }}>{post.title}</a></h3>
    <div className="mb-3">{post.tags.map(tag => <button key={tag} className="badge rounded-pill text-bg-warning border-0 me-1" onClick={() => onTag(tag)}>#{tag}</button>)}</div>
    <p className="card-text post-content">{post.content}</p>
    {post.updatedAt && <p className="text-secondary small">Updated {new Date(post.updatedAt).toLocaleString()}</p>}
    <div className="d-flex flex-wrap gap-2 align-items-center border-top pt-3">
      {user ? ['like', 'dislike'].map(reaction => <button key={reaction} disabled={busy} className={`btn btn-sm btn-${post.currentReaction === reaction ? '' : 'outline-'}${reaction === 'like' ? 'success' : 'secondary'}`} aria-pressed={post.currentReaction === reaction} onClick={() => onReact(post.id, post.currentReaction === reaction ? 'remove' : reaction)}>{reaction === 'like' ? 'Like' : 'Dislike'} ({reaction === 'like' ? post.likes : post.dislikes})</button>) : <span className="text-secondary small">Likes: {post.likes} · Dislikes: {post.dislikes}</span>}
      {user?.user_id === post.creatorUserId && <>
        <button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => navigate(`/posts/${post.id}/edit`)}>Edit</button>
        <button className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onDelete(post.id)}>Delete</button>
      </>}
    </div>
  </div></div></article>;
}

export default function PostList({ user, navigate, search, revision, onCreate }) {
  const [feed, setFeed] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const params = new URLSearchParams(search);
  const tag = params.get('tag') || '', sort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const [draftTag, setDraftTag] = useState(tag), [draftSort, setDraftSort] = useState(sort);
  useEffect(() => { setDraftTag(tag); setDraftSort(sort); }, [tag, sort]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api(`/posts${search}`, { signal: controller.signal }).then(setFeed).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, revision, refresh, user]);
  function filter(nextTag, nextSort = sort, page = 1) {
    navigate(`/?${new URLSearchParams({ tag: nextTag, sort: nextSort, page })}`);
  }
  async function mutate(id, reaction) {
    if (!reaction && !window.confirm('Delete this post? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      await api(`/posts/${id}${reaction ? '/react' : ''}`, { method: reaction ? 'POST' : 'DELETE', body: reaction ? { reaction } : undefined });
      setRefresh(value => value + 1);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <>
    <div className="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-3"><div><h2 className="h3 mb-1">Published posts</h2><p className="text-secondary mb-0">{feed ? `${feed.totalPosts} ${feed.totalPosts === 1 ? 'entry' : 'entries'}` : 'Loading entries…'}</p></div>
      <button className="btn btn-primary new-entry-button" onClick={() => user ? onCreate() : navigate('/signin')}>{user ? 'Start a new entry' : 'Sign in to write'}</button></div>
    <form className="row g-2 align-items-end mb-4" onSubmit={e => { e.preventDefault(); filter(draftTag, draftSort); }}>
      <div className="col-md-5"><label className="form-label" htmlFor="tag-filter">Topic</label><select className="form-select" id="tag-filter" value={draftTag} onChange={e => setDraftTag(e.target.value)}><option value="">All topics</option>{[...new Set([...(feed?.availableTags || []), ...(tag ? [tag] : [])])].sort().map(t => <option key={t}>{t}</option>)}</select></div>
      <div className="col-md-5"><label className="form-label" htmlFor="sort-order">Sort by</label><select className="form-select" id="sort-order" value={draftSort} onChange={e => setDraftSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
      <div className="col-md-2 d-grid"><button className="btn btn-outline-secondary">Apply</button></div>
    </form>
    {error && <div className="alert alert-danger" role="alert">{error} <button className="btn btn-sm btn-outline-danger" onClick={() => setRefresh(n => n + 1)}>Retry</button></div>}
    {loading ? <p role="status">Loading posts…</p> : feed && <>
      {!feed.posts.length && <div className="alert alert-light border">{tag ? `No posts found with the tag "${tag}".` : 'No posts yet. Create the first one.'}</div>}
      <div className="row g-3" aria-busy={busy}>{feed.posts.map(post => <PostCard key={post.id} post={post} user={user} navigate={navigate} onTag={filter} onDelete={id => mutate(id)} onReact={mutate} busy={busy} />)}</div>
      {feed.pageCount > 1 && <nav className="mt-4" aria-label="Post pages"><ul className="pagination justify-content-center">{Array.from({ length: feed.pageCount }, (_, i) => i + 1).map(page => <li key={page} className={`page-item ${page === feed.currentPage ? 'active' : ''}`}><button className="page-link" aria-current={page === feed.currentPage ? 'page' : undefined} onClick={() => filter(tag, sort, page)}>{page}</button></li>)}</ul></nav>}
    </>}
  </>;
}
