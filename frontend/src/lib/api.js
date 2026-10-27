const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const KEY = 'devora_token';

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : localStorage.getItem(KEY)),
  set: (t) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};

export async function api(path, { method = 'GET', body } = {}) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the DEVORA API. Is the backend running?');
  }
  if (res.status === 401 && typeof window !== 'undefined' && !/^\/(login|register)/.test(location.pathname)) {
    tokenStore.clear();
    location.href = '/login';
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const fields = data?.details && Object.values(data.details).flat().join(' ');
    const err = new Error([data?.error || 'Request failed', fields].filter(Boolean).join(': '));
    err.status = res.status;
    throw err;
  }
  return data;
}
