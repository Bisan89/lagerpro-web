'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // تحقق إن في اتصال
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) {
      router.push('/');
      return;
    }
    loadUsers(url, token);
  }, []);

  async function loadUsers(url, token) {
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url, token,
          sql: 'SELECT UserId, Name, Role FROM Users WHERE IsActive=1 ORDER BY Name'
        }),
      });
      const data = await res.json();
      if (data.rows) setUsers(data.rows);
    } catch {
      setError('فشل تحميل المستخدمين');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!selectedUser) { setError('اختر مستخدماً'); return; }
    if (!pin) { setError('أدخل الـ PIN'); return; }

    setLoading(true);
    setError('');

    try {
      const url = sessionStorage.getItem('turso_url');
      const token = sessionStorage.getItem('turso_token');

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, userId: selectedUser.UserId, pin }),
      });
      const data = await res.json();

      if (data.ok) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError('PIN غلط');
        setPin('');
      }
    } catch {
      setError('خطأ في تسجيل الدخول');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-[#2D3E50] p-8 text-center">
          <h1 className="text-3xl font-bold text-white">Lager Pro</h1>
          <p className="text-gray-400 mt-1 text-sm">تسجيل الدخول</p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-5">

          {/* قائمة المستخدمين */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              اختر المستخدم:
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {users.map(user => (
                <button
                  key={user.UserId}
                  type="button"
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-right px-4 py-3 rounded-lg border text-sm font-medium transition ${
                    selectedUser?.UserId === user.UserId
                      ? 'bg-[#2D3E50] text-white border-[#2D3E50]'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {user.Name}
                  <span className="text-xs opacity-60 mr-2">({user.Role})</span>
                </button>
              ))}
            </div>
          </div>

          {/* PIN */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">PIN:</label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              maxLength={6}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2D3E50]"
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2D3E50] text-white py-3 rounded-lg font-bold text-sm hover:bg-[#3d5268] transition disabled:opacity-50"
          >
            {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}