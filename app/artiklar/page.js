'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

export default function Artiklar() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ProductCode: '', NameSE: '', NameAR: '', PiecesPerBox: '', Price: '', Moms: '12', MinStock: '0' });
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState('NameSE');
  const [sortDir, setSortDir] = useState('asc');
  const router = useRouter();
  const { user, ready } = useAuth('artiklar');


  useEffect(() => {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    loadProducts(url, token);
  }, []);

  async function execute(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql, args }) });
  }

  async function loadProducts(url, token) {
    setLoading(true);
    try {
      const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT ProductId, ProductCode, NameSE, NameAR, PiecesPerBox, Price, Moms, MinStock FROM Products ORDER BY NameSE' }) });
      const data = await res.json();
      setProducts(data.rows || []);
    } catch { }
    setLoading(false);
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function openNew() {
    setEditing(null);
    setForm({ ProductCode: '', NameSE: '', NameAR: '', PiecesPerBox: '', Price: '', Moms: '12', MinStock: '0' });
    setShowModal(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({ ProductCode: p.ProductCode || '', NameSE: p.NameSE || '', NameAR: p.NameAR || '', PiecesPerBox: p.PiecesPerBox || '', Price: p.Price || '', Moms: p.Moms || '12', MinStock: p.MinStock || '0' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.NameSE) return alert('أدخل الاسم السويدي');
    setSaving(true);
    try {
      if (editing) {
        await execute('UPDATE Products SET ProductCode=?, NameSE=?, NameAR=?, PiecesPerBox=?, Price=?, Moms=?, MinStock=? WHERE ProductId=?',
          [form.ProductCode, form.NameSE, form.NameAR, Number(form.PiecesPerBox), Number(form.Price), Number(form.Moms), Number(form.MinStock), editing.ProductId]);
      } else {
        await execute('INSERT INTO Products (ProductCode, NameSE, NameAR, PiecesPerBox, Price, Moms, MinStock) VALUES (?,?,?,?,?,?,?)',
          [form.ProductCode, form.NameSE, form.NameAR, Number(form.PiecesPerBox), Number(form.Price), Number(form.Moms), Number(form.MinStock)]);
      }
      setShowModal(false);
      const url = sessionStorage.getItem('turso_url');
      const token = sessionStorage.getItem('turso_token');
      await loadProducts(url, token);
    } catch (e) { alert('خطأ: ' + e.message); }
    setSaving(false);
  }

  async function handleDelete(p) {
    if (!confirm(`حذف "${p.NameSE}"؟`)) return;
    await execute('DELETE FROM Products WHERE ProductId=?', [p.ProductId]);
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    await loadProducts(url, token);
  }

  const filtered = products
    .filter(p => (p.NameSE?.toLowerCase().includes(search.toLowerCase())) || (p.NameAR?.includes(search)) || (p.ProductCode?.includes(search)))
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const thClass = "px-4 py-3 cursor-pointer select-none hover:bg-[#3d5268] transition text-left whitespace-nowrap";


  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">Artiklar</h1>
        </div>
        <button onClick={openNew} className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition">+ ny artikel</button>
      </div>
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
        {loading ? <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div> : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[650px]">
                <thead className="bg-[#2D3E50] text-white">
                  <tr>
                    <th className={thClass} onClick={() => handleSort('ProductCode')}>Kod <SortIcon col="ProductCode"/></th>
                    <th className={thClass} onClick={() => handleSort('NameSE')}>Namn SE <SortIcon col="NameSE"/></th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('NameAR')}>عربي <SortIcon col="NameAR"/></th>
                    <th className={`${thClass} text-center`} onClick={() => handleSort('PiecesPerBox')}>Per krt <SortIcon col="PiecesPerBox"/></th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('Price')}>Pris <SortIcon col="Price"/></th>
                    <th className={`${thClass} text-center`} onClick={() => handleSort('Moms')}>Moms <SortIcon col="Moms"/></th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.ProductId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-mono text-gray-500 whitespace-nowrap">{p.ProductCode}</td>
                      <td className="px-4 py-3 font-medium">{p.NameSE}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{p.NameAR}</td>
                      <td className="px-4 py-3 text-center">{p.PiecesPerBox}</td>
                      <td className="px-4 py-3 text-right font-medium">{Number(p.Price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{p.Moms}%</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-700 mr-3 text-xs font-medium">تعديل</button>
                        <button onClick={() => handleDelete(p)} className="text-red-500 hover:text-red-700 text-xs font-medium">حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t">{filtered.length} منتج</div>
          </div>
        )}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="bg-[#2D3E50] text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="font-bold">{editing ? 'تعديل منتج' : 'منتج جديد'}</h2>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {[{ label: 'Produktkod', key: 'ProductCode' }, { label: 'Namn SE *', key: 'NameSE' }, { label: 'الاسم العربي', key: 'NameAR' },
                { label: 'Per kartong', key: 'PiecesPerBox', type: 'number' }, { label: 'Pris (kr)', key: 'Price', type: 'number' },
                { label: 'Moms (%)', key: 'Moms', type: 'number' }, { label: 'Min lager', key: 'MinStock', type: 'number' }].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                </div>
              ))}
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
    </div>
  );
}