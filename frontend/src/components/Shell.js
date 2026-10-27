'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Layers } from 'lucide-react';
import { useRequireAuth } from '@/lib/auth';
import { Loading } from './ui';

export default function Shell({ children }) {
  const { user, ready, logout } = useRequireAuth();
  const router = useRouter();
  if (!ready || !user) return <Loading />;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600"><Layers className="h-4 w-4" /></span> DEVORA
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-400 sm:inline">{user.name}</span>
            <button className="btn-ghost" onClick={() => { logout(); router.push('/login'); }}><LogOut className="h-4 w-4" /> Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
