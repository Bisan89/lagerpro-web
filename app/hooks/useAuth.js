'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const PERMISSIONS = {
  Admin:       ['artiklar', 'order', 'orders', 'kunder', 'lager', 'inkop', 'redovisning'],
  Lager:       ['artiklar', 'order', 'orders', 'lager', 'inkop'],
  Forsaljning: ['artiklar', 'order', 'orders', 'kunder'],
};

export function useAuth(page) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const u = sessionStorage.getItem('user');
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');

    if (!u || !url || !token) {
      router.push('/');
      return;
    }

    const parsed = JSON.parse(u);
    const allowed = PERMISSIONS[parsed.Role] || PERMISSIONS['Forsaljning'];

    if (page && !allowed.includes(page)) {
      router.push('/dashboard');
      return;
    }

    setUser(parsed);
    setReady(true);
  }, []);

  return { user, ready };
}