'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [warehouses, setWarehouses] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('lagerpro_warehouses');
    if (saved) setWarehouses(JSON.parse(saved));
  }, []);

  function saveWarehouses(list) {
    setWarehouses(list);
    localStorage.setItem('lagerpro_warehouses', JSON.stringify(list));
  }

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
        const newWh = { id: Date.now(), name: name.trim() || url, url, token };
        const updated = [...warehouses.filter(w => w.url !== url), newWh];
        saveWarehouses(updated);
        selectWarehouse(newWh);
      } else {
        setError('فشل الاتصال — تحقق من URL و Token');
      }
    } catch {
      setError('خطأ في الاتصال');
    }
    setLoading(false);
  }

  function selectWarehouse(wh) {
    sessionStorage.setItem('turso_url', wh.url);
    sessionStorage.setItem('turso_token', wh.token);
    sessionStorage.setItem('warehouse_name', wh.name);
    router.push('/login');
  }

  function deleteWarehouse(id) {
    if (!confirm('حذف هذا المستودع من القائمة؟')) return;
    const updated = warehouses.filter(w => w.id !== id);
    saveWarehouses(updated);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-[#2D3E50] p-8 text-center">
          <h1 className="text-3xl font-bold text-white">Lager Pro</h1>
          <p className="text-gray-400 mt-1 text-sm">اختر المستودع</p>
        </div>

        <div className="p-6 space-y-3">

          {/* قائمة المستودعات المحفوظة */}
          {warehouses.length > 0 && (
            <div className="space-y-2">
              {warehouses.map(wh => (
                <div key={wh.id} className="flex items-center gap-2">
                  <button onClick={() => selectWarehouse(wh)}
                    className="flex-1 flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-[#2D3E50] hover:bg-gray-50 transition text-left">
                    <span className="text-2xl">🏭</span>
                    <div>
                      <div className="font-bold text-gray-800">{wh.name}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[220px]">{wh.url}</div>
                    </div>
                  </button>
                  <button onClick={() => deleteWarehouse(wh.id)}
                    className="text-red-400 hover:text-red-600 text-lg px-2">×</button>
                </div>
              ))}
            </div>
          )}

          {/* زر إضافة مستودع */}
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#2D3E50] hover:text-[#2D3E50] transition text-sm font-medium">
              + إضافة مستودع جديد
            </button>
          ) : (
            <form onSubmit={handleConnect} className="space-y-3 border-2 border-gray-200 rounded-xl p-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">اسم المستودع</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="مثال: Alyarmuk"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Database URL</label>
                <input type="text" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://your-db.turso.io"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]"
                  required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Auth Token</label>
                <input type="password" value={token} onChange={e => setToken(e.target.value)}
                  placeholder="eyJ..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]"
                  required />
              </div>

              {error && <p className="text-red-500 text-xs text-center">{error}</p>}

              <div className="flex gap-2">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-[#2D3E50] text-white py-2 rounded-lg font-bold text-sm hover:bg-[#3d5268] transition disabled:opacity-50">
                  {loading ? 'جارٍ الاتصال...' : 'اتصال وحفظ'}
                </button>
                <button type="button" onClick={() => { setShowAddForm(false); setError(''); }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold text-sm hover:bg-gray-200 transition">
                  إلغاء
                </button>
              </div>
            </form>
          )}

        </div>

        <p className="text-center text-xs text-gray-400 pb-4">v1.0 | Lager Pro Web</p>
      </div>
    </div>
  );
}