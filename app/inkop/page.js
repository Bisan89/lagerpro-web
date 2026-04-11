'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Inkop() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ Supplier: '', InvoiceDate: new Date().toISOString().slice(0, 10), InvoiceNo: '', Notes: '' });
  const [selProduct, setSelProduct] = useState('');
  const [itemBoxes, setItemBoxes] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState('InvoiceId');
  const [sortDir, setSortDir] = useState('desc');
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
      const [inv, prods] = await Promise.all([
        fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token, sql: 'SELECT * FROM PurchaseInvoices ORDER BY InvoiceId DESC' }) })
          .then(r => r.json()).then(d => d.rows || []),
        fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token, sql: 'SELECT ProductId, ProductCode, NameSE FROM Products ORDER BY NameSE' }) })
          .then(r => r.json()).then(d => d.rows || []),
      ]);
      setInvoices(inv);
      setProducts(prods);
    } catch { }
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setItems([]);
    setForm({ Supplier: '', InvoiceDate: new Date().toISOString().slice(0, 10), InvoiceNo: '', Notes: '' });
    setShowModal(true);
  }

  async function openEdit(inv) {
    setEditing(inv);
    setForm({ Supplier: inv.Supplier || '', InvoiceDate: inv.InvoiceDate?.slice(0, 10) || '', InvoiceNo: inv.InvoiceNo || '', Notes: inv.Notes || '' });
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql: 'SELECT pi.*, p.NameSE, p.ProductCode FROM PurchaseItems pi LEFT JOIN Products p ON p.ProductId=pi.ProductId WHERE pi.InvoiceId=?', args: [inv.InvoiceId] }) });
    const data = await res.json();
    setItems((data.rows || []).map(i => ({
      ProductId: i.ProductId,
      ProductCode: i.ProductCode,
      NameSE: i.NameSE,
      Boxes: Number(i.Boxes),
      Price: Number(i.Price),
      RowTotal: Number(i.RowTotal)
    })));
    setShowModal(true);
  }

  function addItem() {
    if (!selProduct || !itemBoxes) return alert('اختر منتج وأدخل الكمية');
    const p = products.find(p => String(p.ProductId) === String(selProduct));
    if (!p) return;
    const b = Number(itemBoxes);
    const pr = Number(itemPrice) || 0;
    setItems(prev => [...prev, { ProductId: p.ProductId, ProductCode: p.ProductCode, NameSE: p.NameSE, Boxes: b, Price: pr, RowTotal: b * pr }]);
    setSelProduct(''); setItemBoxes(''); setItemPrice('');
  }

  const total = items.reduce((s, i) => s + i.RowTotal, 0);

  async function handleSave() {
    if (!form.Supplier) return alert('أدخل اسم المورد');
    setSaving(true);
    try {
      const url = sessionStorage.getItem('turso_url');
      const token = sessionStorage.getItem('turso_token');
      const exe = async (sql, args) => fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql, args }) });

      let invId = editing?.InvoiceId;
      if (!invId) {
        await exe('INSERT INTO PurchaseInvoices (InvoiceDate, Supplier, Total, GrandTotal, InvoiceNo, Notes) VALUES (?,?,?,?,?,?)',
          [form.InvoiceDate, form.Supplier, total, total, form.InvoiceNo, form.Notes]);
        const rows = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token, sql: 'SELECT InvoiceId FROM PurchaseInvoices ORDER BY InvoiceId DESC LIMIT 1' }) })
          .then(r => r.json()).then(d => d.rows || []);
        invId = rows[0]?.InvoiceId;
      } else {
        await exe('UPDATE PurchaseInvoices SET InvoiceDate=?, Supplier=?, Total=?, GrandTotal=?, InvoiceNo=?, Notes=? WHERE InvoiceId=?',
          [form.InvoiceDate, form.Supplier, total, total, form.InvoiceNo, form.Notes, invId]);
        await exe('DELETE FROM PurchaseItems WHERE InvoiceId=?', [invId]);
      }

      for (const item of items) {
        await exe('INSERT INTO PurchaseItems (InvoiceId, ProductId, Boxes, Price, RowTotal) VALUES (?,?,?,?,?)',
          [invId, item.ProductId, item.Boxes, item.Price, item.RowTotal]);
      }

      setShowModal(false);
      await loadAll(url, token);
    } catch (e) { alert('خطأ: ' + e.message); }
    setSaving(false);
  }

  async function handleDelete(inv) {
    if (!confirm(`حذف الفاتورة #${inv.InvoiceId}؟`)) return;
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql: 'DELETE FROM PurchaseItems WHERE InvoiceId=?', args: [inv.InvoiceId] }) });
    await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql: 'DELETE FROM PurchaseInvoices WHERE InvoiceId=?', args: [inv.InvoiceId] }) });
    await loadAll(url, token);
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const filtered = invoices
    .filter(i => i.Supplier?.toLowerCase().includes(search.toLowerCase()) || String(i.InvoiceId).includes(search))
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const thClass = "px-4 py-3 cursor-pointer select-none hover:bg-[#3d5268] transition text-left";

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">Inköp</h1>
        </div>
        <button onClick={openNew} className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition">
          + ny faktura
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالمورد أو رقم الفاتورة..."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />

        {loading ? (
          <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#2D3E50] text-white">
                <tr>
                  <th className={thClass} onClick={() => handleSort('InvoiceId')}># <SortIcon col="InvoiceId"/></th>
                  <th className={thClass} onClick={() => handleSort('InvoiceDate')}>Datum <SortIcon col="InvoiceDate"/></th>
                  <th className={thClass} onClick={() => handleSort('Supplier')}>Leverantör <SortIcon col="Supplier"/></th>
                  <th className={thClass} onClick={() => handleSort('InvoiceNo')}>Faktura nr <SortIcon col="InvoiceNo"/></th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('GrandTotal')}>Totalt <SortIcon col="GrandTotal"/></th>
                  <th className="px-4 py-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, i) => (
                  <tr key={inv.InvoiceId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-mono text-gray-500">#{inv.InvoiceId}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.InvoiceDate?.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-medium">{inv.Supplier}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.InvoiceNo}</td>
                    <td className="px-4 py-3 text-right font-bold">{Number(inv.GrandTotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openEdit(inv)} className="text-blue-500 hover:text-blue-700 mr-3 text-xs font-medium">فتح</button>
                      <button onClick={() => handleDelete(inv)} className="text-red-500 hover:text-red-700 text-xs font-medium">حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t">{filtered.length} faktura</div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="bg-[#2D3E50] text-white px-6 py-4 rounded-t-2xl">
              <h2 className="font-bold">{editing ? `تعديل فاتورة #${editing.InvoiceId}` : 'فاتورة شراء جديدة'}</h2>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Leverantör', key: 'Supplier' },
                  { label: 'Datum', key: 'InvoiceDate', type: 'date' },
                  { label: 'Faktura nr', key: 'InvoiceNo' },
                  { label: 'ملاحظات', key: 'Notes' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                    <input type={f.type || 'text'} value={form[f.key]}
                      onChange={e => setForm({...form, [f.key]: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                  </div>
                ))}
              </div>

              {/* إضافة منتج */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm">إضافة منتج</h3>
                <div className="grid grid-cols-3 gap-2">
                  <select value={selProduct} onChange={e => setSelProduct(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">-- منتج --</option>
                    {products.map(p => <option key={p.ProductId} value={p.ProductId}>{p.ProductCode} — {p.NameSE}</option>)}
                  </select>
                  <input type="number" value={itemBoxes} onChange={e => setItemBoxes(e.target.value)}
                    placeholder="كراتين" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)}
                    placeholder="سعر" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <button onClick={addItem} className="mt-2 bg-[#2D3E50] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#3d5268]">+ إضافة</button>
              </div>

              {/* بنود الفاتورة */}
              {items.length > 0 && (
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">منتج</th>
                      <th className="px-3 py-2 text-center">كراتين</th>
                      <th className="px-3 py-2 text-right">سعر</th>
                      <th className="px-3 py-2 text-right">إجمالي</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                        <td className="px-3 py-2">{item.NameSE}</td>
                        <td className="px-3 py-2 text-center">{item.Boxes}</td>
                        <td className="px-3 py-2 text-right">{item.Price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-bold">{item.RowTotal.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-red-500 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-gray-50 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-right">Totalt:</td>
                      <td className="px-3 py-2 text-right text-[#2D3E50]">{total.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3 pt-4 border-t">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-[#2D3E50] text-white py-2.5 rounded-lg font-bold text-sm hover:bg-[#3d5268] disabled:opacity-50">
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-200">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}