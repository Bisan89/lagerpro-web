'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleConnect(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token }),
      });
      const data = await res.json();

      if (data.ok) {
        // حفظ البيانات في sessionStorage
        sessionStorage.setItem('turso_url', url);
        sessionStorage.setItem('turso_token', token);
        router.push('/login');
      } else {
        setError('فشل الاتصال — تحقق من URL و Token');
      }
    } catch {
      setError('خطأ في الاتصال');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-[#2D3E50] p-8 text-center">
          <h1 className="text-3xl font-bold text-white">Lager Pro</h1>
          <p className="text-gray-400 mt-1 text-sm">ربط المستودع بالسحابة</p>
        </div>

        {/* Form */}
        <form onSubmit={handleConnect} className="p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Database URL
            </label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-db.turso.io"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Auth Token
            </label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="eyJ..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2D3E50] text-white py-3 rounded-lg font-bold text-sm hover:bg-[#3d5268] transition disabled:opacity-50"
          >
            {loading ? 'جارٍ الاتصال...' : 'اتصال بالمستودع'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 pb-6">
          v1.0 | Lager Pro Web
        </p>
      </div>
    </div>
  );
}