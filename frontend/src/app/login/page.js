'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ErrorBox, Field, Spinner } from '@/components/ui';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await auth.login(email, password); router.push('/dashboard'); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">← DEVORA</Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Sign in</h1>
        </div>
        
        <Field label="Email"><input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input type="password" className="input" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <ErrorBox message={error} />
        <button className="btn-primary w-full py-2" disabled={busy}>{busy && <Spinner />} Sign in</button>
        <p className="text-center text-sm text-slate-400"><>No account? <Link href="/register" className="text-brand-400 hover:underline">Create one</Link></></p>
      </form>
    </div>
  );
}
