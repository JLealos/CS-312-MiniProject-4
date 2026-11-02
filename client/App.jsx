import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import Signup from './components/Signup';
import Signin from './components/Signin';
import BlogPostForm from './components/BlogPostForm';
import PostList from './components/PostList';
import PostPage from './components/PostPage';

function CreateDialog({ user, onClose, onSaved }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => previous?.focus();
  }, []);
  return <dialog ref={dialog} className="create-dialog" aria-labelledby="create-post-heading" onCancel={onClose}>
    <div className="modal-header"><h2 className="modal-title fs-5" id="create-post-heading">Create a post</h2><button className="btn-close" aria-label="Close" onClick={onClose} /></div>
    <div className="modal-body"><BlogPostForm user={user} onCancel={onClose} onSubmit={async body => { await api('/posts', { method: 'POST', body }); onSaved(); }} /></div>
  </dialog>;
}

export default function App() {
  const [location, setLocation] = useState(() => window.location.pathname + window.location.search);
  const [session, setSession] = useState(null), [error, setError] = useState('');
  const [creating, setCreating] = useState(false), [revision, setRevision] = useState(0), [busy, setBusy] = useState(false);
  const url = new URL(location, window.location.origin);
  const user = session?.user;
  function navigate(path) {
    window.history.pushState({}, '', path); setLocation(path); setCreating(false); setError(''); window.scrollTo(0, 0);
  }
  async function loadSession() {
    setError('');
    try { setSession(await api('/session')); }
    catch (error) { setError(error.message); }
  }
  useEffect(() => { loadSession(); }, []);
  useEffect(() => {
    function pop() { setLocation(window.location.pathname + window.location.search); setCreating(false); setError(''); }
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    document.title = `${url.pathname === '/signup' ? 'Sign up' : url.pathname === '/signin' ? 'Sign in' : 'Blog'} | The Community Notebook`;
  }, [location]);
  async function logout() {
    setBusy(true); setError('');
    try { await api('/logout', { method: 'POST' }); setSession(await api('/session')); navigate('/signin'); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const postRoute = url.pathname.match(/^\/posts\/(\d+)(\/edit)?$/);
  const link = (path) => (event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); navigate(path); } };
  return <>
    <nav className="navbar border-bottom bg-white"><div className="container gap-2"><a className="navbar-brand" href="/" onClick={link('/')}>The Community Notebook</a>
      <div className="d-flex flex-wrap align-items-center gap-2">{user ? <><span className="text-secondary small">Hi, {user.name}</span><button className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={logout}>Sign out</button></> : session && <><a className="btn btn-sm btn-outline-secondary" href="/signin" onClick={link('/signin')}>Sign in</a><a className="btn btn-sm btn-primary" href="/signup" onClick={link('/signup')}>Sign up</a></>}</div>
    </div></nav>
    {error && <div className="container mt-3"><div className="alert alert-danger" role="alert">{error} {!session && <button className="btn btn-sm btn-outline-danger" onClick={loadSession}>Retry</button>}</div></div>}
    {!session ? !error && <main className="container py-4" role="status">Loading notebook…</main>
      : url.pathname === '/signup' ? <Signup navigate={navigate} onSuccess={() => navigate('/signin?registered=1')} />
      : url.pathname === '/signin' ? <Signin navigate={navigate} registered={url.searchParams.get('registered') === '1'} onSuccess={data => { setSession(data); navigate('/'); }} />
      : url.pathname === '/' ? <main className="container py-4"><header className="intro p-4 p-md-5 mb-4 rounded"><p className="text-uppercase small mb-2">The Community Notebook</p><h1 className="display-5">A space to share your good ideas.</h1><p className="lead mb-0">Write something worth sharing and find posts from the community.</p></header>
        <PostList user={user} navigate={navigate} search={url.search} revision={revision} onCreate={() => setCreating(true)} /></main>
      : postRoute ? <PostPage key={url.pathname} id={postRoute[1]} editing={Boolean(postRoute[2])} user={user} navigate={navigate} />
      : <main className="container py-4"><h1>Page not found</h1><a href="/" onClick={link('/')}>Back to all posts</a></main>}
    <footer className="text-center text-secondary small py-4">Made locally, shared thoughtfully</footer>
    {creating && user && <CreateDialog user={user} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setRevision(n => n + 1); }} />}
  </>;
}
