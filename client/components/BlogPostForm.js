import { useState } from 'react';

export default function BlogPostForm({ post, user, onSubmit, onCancel }) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [tags, setTags] = useState(post?.tags.join(', ') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try { await onSubmit({ title, content, tags }); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    <p className="text-secondary">Posting as <strong>{user.name}</strong></p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    <fieldset disabled={busy}>
      <div className="mb-3"><label className="form-label" htmlFor="title">Title</label>
        <input autoFocus className="form-control" id="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={255} required /></div>
      <div className="mb-3"><label className="form-label" htmlFor="tags">Tags <span className="text-secondary small">comma-separated</span></label>
        <input className="form-control" id="tags" value={tags} onChange={e => setTags(e.target.value)} /></div>
      <div className="mb-3"><label className="form-label" htmlFor="content">Blog content</label>
        <textarea className="form-control" id="content" rows={post ? 9 : 7} value={content} onChange={e => setContent(e.target.value)} required /></div>
      <button className="btn btn-primary" type="submit">{busy ? 'Saving…' : post ? 'Save changes' : 'Publish post'}</button>
      <button className="btn btn-link" type="button" onClick={onCancel}>Cancel</button>
    </fieldset>
  </form>;
}
