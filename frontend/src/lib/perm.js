// Mirrors backend/src/lib/enums.js `perm` — the server is the source of truth, this only hides UI.
export const perm = {
  manage: ['MANAGER'],
  build: ['MANAGER', 'DEVELOPER'],
  qa: ['MANAGER', 'TESTER'],
};
export const can = (role, group) => perm[group].includes(role);

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const TASK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
export const BUG_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const TEST_STATUSES = ['NOT_RUN', 'PASSED', 'FAILED'];
export const label = (s) => (s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export const priorityColor = {
  LOW: 'bg-slate-700/60 text-slate-300',
  MEDIUM: 'bg-sky-900/60 text-sky-300',
  HIGH: 'bg-amber-900/60 text-amber-300',
  CRITICAL: 'bg-red-900/60 text-red-300',
};
export const statusColor = {
  BACKLOG: 'bg-slate-700/60 text-slate-300', TODO: 'bg-sky-900/60 text-sky-300',
  IN_PROGRESS: 'bg-amber-900/60 text-amber-300', IN_REVIEW: 'bg-violet-900/60 text-violet-300', DONE: 'bg-emerald-900/60 text-emerald-300',
  OPEN: 'bg-red-900/60 text-red-300', RESOLVED: 'bg-emerald-900/60 text-emerald-300', CLOSED: 'bg-slate-700/60 text-slate-300',
  NOT_RUN: 'bg-slate-700/60 text-slate-300', PASSED: 'bg-emerald-900/60 text-emerald-300', FAILED: 'bg-red-900/60 text-red-300',
  DRAFT: 'bg-slate-700/60 text-slate-300', APPROVED: 'bg-sky-900/60 text-sky-300', IMPLEMENTED: 'bg-emerald-900/60 text-emerald-300',
  PLANNED: 'bg-slate-700/60 text-slate-300', ACTIVE: 'bg-emerald-900/60 text-emerald-300', COMPLETED: 'bg-slate-700/60 text-slate-400',
  MANAGER: 'bg-violet-900/60 text-violet-300', DEVELOPER: 'bg-sky-900/60 text-sky-300', TESTER: 'bg-amber-900/60 text-amber-300',
};
