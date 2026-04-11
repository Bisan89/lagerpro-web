'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Lager() {
  const [stock, setStock] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ProductId: '', type: 'IN', boxes: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [sortKey, setSortKey] = useState('NameSE');
  const [sortDir, setSortDir] = useState('asc');
  const router = useRouter();

  useEffect(() => {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) { router.push('/'); return; }
    loadAll(url, token);
  }, []);

  async function loadAll(url, token) {
    setLoading(true);
    try {
      const [stockRes, prodRes] = await Promise.all([
        fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url, token,
            sql: `SELECT p.ProductId, p.ProductCode, p.NameSE, p.NameAR, p.MinStock,
                  IFNULL(SUM(CASE WHEN m.MovementType IN ('IN','OPENING','RETURN','ADJUST') THEN m.Boxes
                               WHEN m.MovementType = 'OUT' THEN -m.Boxes ELSE 0 END), 0) AS Balance
                  FROM Products p
                  LEFT JOIN StockMovements m ON m.ProductId = p.ProductId
                  GROUP BY p.ProductId ORDER BY p.NameSE`
          })
        }).then(r => r.json()),
        fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token, sql: 'SELECT ProductId, ProductCode, NameSE FROM Products ORDER BY NameSE' })
        }).then(r => r.json())
      ]);
      setStock(stockRes.rows || []);
      setProducts(prodRes.rows || []);
    } catch { }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.ProductId || !form.boxes) return alert('اختر منتج وأدخل الكمية');
    setSaving(true);
    try {
      const url = sessionStorage.getItem('turso_url');
      const token = sessionStorage.getItem('turso_token');
      await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url, token,
          sql: 'INSERT INTO StockMovements (ProductId, MovementType, Boxes, MovementDate, Note) VALUES (?,?,?,?,?)',
          args: [Number(form.ProductId), form.type, Number(form.boxes), new Date().toISOString().slice(0, 10), form.note]
        })
      });
      setShowModal(false);
      setForm({ ProductId: '', type: 'IN', boxes: '', note: '' });
      await loadAll(url, token);
    } catch (e) { alert('خطأ: ' + e.message); }
    setSaving(false);
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const filtered = stock
    .filter(p =>
      p.NameSE?.toLowerCase().includes(search.toLowerCase()) ||
      p.NameAR?.includes(search) ||
      p.ProductCode?.includes(search)
    )
    .sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const thClass = "px-4 py-3 cursor-pointer select-none hover:bg-[#3d5268] transition text-left";

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">Lager</h1>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition">
          + lagerrörelse
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث..."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]"
        />

        {loading ? (
          <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#2D3E50] text-white">
                <tr>
                  <th className={thClass} onClick={() => handleSort('ProductCode')}>Kod <SortIcon col="ProductCode"/></th>
                  <th className={thClass} onClick={() => handleSort('NameSE')}>Produkt <SortIcon col="NameSE"/></th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('NameAR')}>عربي <SortIcon col="NameAR"/></th>
                  <th className={`${thClass} text-center`} onClick={() => handleSort('Balance')}>Saldo <SortIcon col="Balance"/></th>
                  <th className={`${thClass} text-center`} onClick={() => handleSort('MinStock')}>Min <SortIcon col="MinStock"/></th>
                  <th className="px-4 py-3 text-center">حالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const low = Number(p.Balance) <= Number(p.MinStock) && Number(p.MinStock) > 0;
                  return (
                    <tr key={p.ProductId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-mono text-gray-500">{p.ProductCode}</td>
                      <td className="px-4 py-3 font-medium">{p.NameSE}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{p.NameAR}</td>
                      <td className={`px-4 py-3 text-center font-bold ${Number(p.Balance) < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                        {p.Balance}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">{p.MinStock}</td>
                      <td className="px-4 py-3 text-center">
                        {low ? (
                          <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-medium">⚠ lågt</span>
                        ) : (
                          <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full font-medium">✓ ok</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t">{filtered.length} produkt</div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="bg-[#2D3E50] text-white px-6 py-4 rounded-t-2xl">
              <h2 className="font-bold">حركة مخزون جديدة</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">المنتج</label>
                <select value={form.ProductId} onChange={e => setForm({...form, ProductId: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]">
                  <option value="">-- اختر منتج --</option>
                  {products.map(p => (
                    <option key={p.ProductId} value={p.ProductId}>{p.ProductCode} — {p.NameSE}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">نوع الحركة</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]">
                  <option value="IN">IN — وارد</option>
                  <option value="OUT">OUT — صادر</option>
                  <option value="ADJUST">ADJUST — تعديل</option>
                  <option value="RETURN">RETURN — مرتجع</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">الكمية (كراتين)</label>
                <input type="number" value={form.boxes} onChange={e => setForm({...form, boxes: e.target.value})}
                  min="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ملاحظة</label>
                <input type="text" value={form.note} onChange={e => setForm({...form, note: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 pt-4 border-t">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-[#2D3E50] text-white py-2.5 rounded-lg font-bold text-sm hover:bg-[#3d5268] transition disabled:opacity-50">
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-200 transition">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}