'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

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
  const [inStockOnly, setInStockOnly] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const router = useRouter();
  const { user, ready } = useAuth('lager');
  if (!ready) return null;

  useEffect(() => {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    loadAll(url, token);
  }, []);

  async function loadAll(url, token) {
    setLoading(true);
    try {
      const [stockRes, prodRes] = await Promise.all([
        fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token, sql: `
            SELECT p.ProductId, p.ProductCode, p.NameSE, p.NameAR, p.MinStock, p.CostPrice,
            IFNULL(SUM(CASE WHEN m.MovementType IN ('IN','OPENING') THEN m.Boxes ELSE 0 END), 0) AS Incoming,
            IFNULL(SUM(CASE WHEN m.MovementType = 'OUT' THEN m.Boxes ELSE 0 END), 0) AS Outgoing,
            IFNULL(SUM(CASE WHEN m.MovementType = 'RETURN' THEN m.Boxes ELSE 0 END), 0) AS Returned,
            IFNULL(SUM(CASE WHEN m.MovementType IN ('IN','OPENING','RETURN','ADJUST') THEN m.Boxes
                         WHEN m.MovementType = 'OUT' THEN -m.Boxes ELSE 0 END), 0) AS Balance
            FROM Products p LEFT JOIN StockMovements m ON m.ProductId = p.ProductId
            GROUP BY p.ProductId ORDER BY p.NameSE` }) }).then(r => r.json()),
        fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token, sql: 'SELECT ProductId, ProductCode, NameSE FROM Products ORDER BY NameSE' }) }).then(r => r.json())
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
      await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token,
          sql: 'INSERT INTO StockMovements (ProductId, MovementType, Boxes, MovementDate, Note) VALUES (?,?,?,?,?)',
          args: [Number(form.ProductId), form.type, Number(form.boxes), new Date().toISOString().slice(0, 10), form.note] }) });
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
    .filter(p => {
      const matchSearch = p.NameSE?.toLowerCase().includes(search.toLowerCase()) ||
        p.NameAR?.includes(search) || p.ProductCode?.includes(search);
      const matchInStock = !inStockOnly || Number(p.Balance) > 0;
      const matchLow = !lowStockOnly || Number(p.Balance) < Number(p.MinStock);
      return matchSearch && matchInStock && matchLow;
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const totalBoxes = filtered.reduce((s, p) => s + Number(p.Balance), 0);
  const totalValue = filtered.reduce((s, p) => s + (Number(p.Balance) > 0 ? Number(p.Balance) * Number(p.CostPrice) : 0), 0);
  const thClass = "px-4 py-3 cursor-pointer select-none hover:bg-[#3d5268] transition text-left whitespace-nowrap";

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white; } } .print-only { display: none; }`}</style>
      <div className="print-only" style={{ padding: '20px' }}>
        <div style={{ backgroundColor: '#2D3E50', color: 'white', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>LAGERRAPPORT</h1>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0 }}>إجمالي الكراتين: {totalBoxes}</p>
            <p style={{ margin: 0 }}>قيمة المستودع: {totalValue.toFixed(0)} kr</p>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead><tr style={{ backgroundColor: '#E8ECEF' }}>
            {['Kod','Produkt','وارد','صادر','Saldo','Min'].map(h => (
              <th key={h} style={{ border: '1px solid #ccc', padding: '5px 7px' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{filtered.map((p, i) => (
            <tr key={p.ProductId} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#F5F7FA' }}>
              <td style={{ border: '1px solid #ccc', padding: '4px 7px' }}>{p.ProductCode}</td>
              <td style={{ border: '1px solid #ccc', padding: '4px 7px' }}>{p.NameSE}</td>
              <td style={{ border: '1px solid #ccc', padding: '4px 7px', textAlign: 'center' }}>{p.Incoming}</td>
              <td style={{ border: '1px solid #ccc', padding: '4px 7px', textAlign: 'center' }}>{p.Outgoing}</td>
              <td style={{ border: '1px solid #ccc', padding: '4px 7px', textAlign: 'center', fontWeight: 'bold' }}>{p.Balance}</td>
              <td style={{ border: '1px solid #ccc', padding: '4px 7px', textAlign: 'center' }}>{p.MinStock}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="min-h-screen bg-gray-100 no-print">
        <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
            <h1 className="text-xl font-bold">Lager</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg transition font-bold">🖨️ Rapport</button>
            <button onClick={() => setShowModal(true)} className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition">+ rörelse</button>
          </div>
        </div>

        <div className="bg-[#1a2a3a] text-white px-6 py-2 text-xs flex gap-6">
          <span>📦 {filtered.length} produkter</span>
          <span>Totalt: {totalBoxes} krt</span>
          <span>Värde: {totalValue.toFixed(0)} kr</span>
          {filtered.filter(p => Number(p.Balance) < Number(p.MinStock) && Number(p.MinStock) > 0).length > 0 && (
            <span className="text-yellow-300">⚠ {filtered.filter(p => Number(p.Balance) < Number(p.MinStock) && Number(p.MinStock) > 0).length} under minimum</span>
          )}
        </div>

        <div className="max-w-6xl mx-auto p-4 space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
            <label className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg border border-gray-300 cursor-pointer">
              <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} /> I lager
            </label>
            <label className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg border border-gray-300 cursor-pointer">
              <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} /> Under min
            </label>
          </div>

          {loading ? <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div> : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-[#2D3E50] text-white">
                    <tr>
                      <th className={thClass} onClick={() => handleSort('ProductCode')}>Kod <SortIcon col="ProductCode"/></th>
                      <th className={thClass} onClick={() => handleSort('NameSE')}>Produkt <SortIcon col="NameSE"/></th>
                      <th className={`${thClass} text-right`} onClick={() => handleSort('NameAR')}>عربي <SortIcon col="NameAR"/></th>
                      <th className={`${thClass} text-center`} onClick={() => handleSort('Incoming')}>وارد <SortIcon col="Incoming"/></th>
                      <th className={`${thClass} text-center`} onClick={() => handleSort('Outgoing')}>صادر <SortIcon col="Outgoing"/></th>
                      <th className={`${thClass} text-center`} onClick={() => handleSort('Balance')}>Saldo <SortIcon col="Balance"/></th>
                      <th className={`${thClass} text-center`} onClick={() => handleSort('MinStock')}>Min <SortIcon col="MinStock"/></th>
                      <th className="px-4 py-3 text-center whitespace-nowrap">حالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => {
                      const low = Number(p.Balance) <= Number(p.MinStock) && Number(p.MinStock) > 0;
                      return (
                        <tr key={p.ProductId} className={low ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 font-mono text-gray-500 whitespace-nowrap">{p.ProductCode}</td>
                          <td className="px-4 py-3 font-medium">{p.NameSE}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{p.NameAR}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{p.Incoming}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{p.Outgoing}</td>
                          <td className={`px-4 py-3 text-center font-bold ${Number(p.Balance) < 0 ? 'text-red-500' : 'text-gray-800'}`}>{p.Balance}</td>
                          <td className="px-4 py-3 text-center text-gray-500">{p.MinStock}</td>
                          <td className="px-4 py-3 text-center">
                            {low ? <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-medium">⚠ lågt</span>
                                 : <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full font-medium">✓ ok</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t-2 font-bold">
                      <td colSpan={5} className="px-4 py-3 text-right text-gray-700">TOTALT:</td>
                      <td className="px-4 py-3 text-center text-[#2D3E50]">{totalBoxes}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="bg-[#2D3E50] text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="font-bold">حركة مخزون جديدة</h2>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">المنتج</label>
                <select value={form.ProductId} onChange={e => setForm({...form, ProductId: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]">
                  <option value="">-- اختر منتج --</option>
                  {products.map(p => <option key={p.ProductId} value={p.ProductId}>{p.ProductCode} — {p.NameSE}</option>)}
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
                <input type="number" value={form.boxes} onChange={e => setForm({...form, boxes: e.target.value})} min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
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
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-200 transition">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}