'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Fetch helper: { data, loading, error, reload, setData } */
export function useFetch(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!path) { setLoading(false); return; }
    try {
      setError('');
      setData(await api(path));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}
