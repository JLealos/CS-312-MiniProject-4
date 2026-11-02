import { useState } from 'react';
import { api } from '../api';

export default function AuthForm({ signup, registered, onSuccess, navigate }) {
  const [userId, setUserId] = useState(''), [name, setName] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api(signup ? '/signup' : '/signin', { method: 'POST', body: { user_id: userId, name, password } });
      onSuccess(result);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <main className="container py-5 auth-page"><section className="card p-4">
    <h1 className="h2">{signup ? 'Create your account' : 'Welcome back'}</h1>
    <p className="text-secondary">{signup ? 'Join the notebook and share your ideas.' : 'Sign in to write and manage your posts.'}</p>
    {registered && <div className="alert alert-success" role="status">Account created. You can now sign in.</div>}
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    <form onSubmit={submit}><fieldset disabled={busy}>
      <div className="mb-3"><label className="form-label" htmlFor="user_id">User ID</label><input className="form-control" id="user_id" autoComplete="username" maxLength={255} value={userId} onChange={e => setUserId(e.target.value)} required /></div>
      {signup && <div className="mb-3"><label className="form-label" htmlFor="name">Your name</label><input className="form-control" id="name" autoComplete="name" maxLength={255} value={name} onChange={e => setName(e.target.value)} required /></div>}
      <div className="mb-3"><label className="form-label" htmlFor="password">Password</label><input className="form-control" id="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} aria-describedby={signup ? 'password-help' : undefined} required />
        {signup && <div className="form-text" id="password-help">Use at least 8 characters.</div>}</div>
      <button className="btn btn-primary w-100" type="submit">{busy ? 'Please wait…' : signup ? 'Sign up' : 'Sign in'}</button>
    </fieldset></form>
    <p className="mt-3 mb-0">{signup ? 'Already have an account? ' : 'New here? '}<a href={signup ? '/signin' : '/signup'} onClick={e => { e.preventDefault(); navigate(signup ? '/signin' : '/signup'); }}>{signup ? 'Sign in' : 'Create an account'}</a></p>
  </section></main>;
}
