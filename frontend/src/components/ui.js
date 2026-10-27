'use client';
import { X, Loader2 } from 'lucide-react';
import { label, priorityColor, statusColor } from '@/lib/perm';

export const Spinner = ({ className = '' }) => <Loader2 className={`h-4 w-4 animate-spin ${className}`} />;

export const Loading = () => (
  <div className="flex items-center justify-center gap-2 py-16 text-slate-400"><Spinner /> Loading…</div>
);

export const ErrorBox = ({ message }) =>
  message ? <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{message}</div> : null;

export const Empty = ({ children }) => (
  <div className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-500">{children}</div>
);

export const Badge = ({ value, kind = 'status', className = '' }) => (
  <span className={`badge ${(kind === 'priority' ? priorityColor : statusColor)[value] || 'bg-slate-700 text-slate-300'} ${className}`}>{label(value)}</span>
);

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-16" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label: l, children }) => (
  <label className="block"><span className="label">{l}</span>{children}</label>
);

export const Select = ({ options, value, onChange, allowEmpty, emptyLabel = '— none —', className = '', ...rest }) => (
  <select className={`input ${className}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
    {allowEmpty && <option value="">{emptyLabel}</option>}
    {options.map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, label(o)];
      return <option key={v} value={v}>{l}</option>;
    })}
  </select>
);

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div><h2 className="text-lg font-semibold text-white">{title}</h2>{subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}</div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

export const Avatar = ({ name }) => (
  <span title={name} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-[10px] font-semibold text-white">
    {(name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
  </span>
);

export const timeAgo = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
