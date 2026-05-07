'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);

  if (!ready) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-bold flex items-center gap-3
      ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      <span>{type === 'error' ? '✕' : '✓'}</span>{message}
    </div>
  );
}

export default function Inkop() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    Supplier: '', InvoiceDate: new Date().toISOString().slice(0, 10),
    InvoiceNo: '', Notes: '', Freight: '0', Customs: '0', OtherCosts: '0'
  });
  const [selProduct, setSelProduct] = useState('');
  const [itemBoxes, setItemBoxes] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(null); // InvoiceId الجاري ترحيله
  const [sortKey, setSortKey] = useState('InvoiceId');
  const [sortDir, setSortDir] = useState('desc');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();


  function showToast(msg, type = 'success') { setToast({ msg, type }); }

  useEffect(() => {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) { router.push('/'); return; }
    const u = sessionStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      const PERMISSIONS = {
        Admin: ['artiklar','order','orders','kunder','lager','inkop','redovisning'],
        Lager: ['artiklar','order','orders','lager','inkop'],
        Forsaljning: ['artiklar','order','orders','kunder'],
      };
      const allowed = PERMISSIONS[parsed.Role] || PERMISSIONS['Forsaljning'];
      if (!allowed.includes('inkop')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    loadAll(url, token);
  }, []);

  async function exe(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) { router.push('/'); return; }
    const u = sessionStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      const PERMISSIONS = {
        Admin: ['artiklar','order','orders','kunder','lager','inkop','redovisning'],
        Lager: ['artiklar','order','orders','lager','inkop'],
        Forsaljning: ['artiklar','order','orders','kunder'],
      };
      const allowed = PERMISSIONS[parsed.Role] || PERMISSIONS['Forsaljning'];
      if (!allowed.includes('inkop')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql, args }) });
  }

  async function q(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) { router.push('/'); return; }
    const u = sessionStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      const PERMISSIONS = {
        Admin: ['artiklar','order','orders','kunder','lager','inkop','redovisning'],
        Lager: ['artiklar','order','orders','lager','inkop'],
        Forsaljning: ['artiklar','order','orders','kunder'],
      };
      const allowed = PERMISSIONS[parsed.Role] || PERMISSIONS['Forsaljning'];
      if (!allowed.includes('inkop')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql, args }) });
    const data = await res.json();
    return data.rows || [];
  }

  async function loadAll(url, token) {
    setLoading(true);
    try {
      const [inv, prods] = await Promise.all([
        fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token, sql: 'SELECT * FROM PurchaseInvoices ORDER BY InvoiceId DESC' })
        }).then(r => r.json()).then(d => d.rows || []),
        fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token, sql: 'SELECT ProductId, ProductCode, NameSE FROM Products ORDER BY NameSE' })
        }).then(r => r.json()).then(d => d.rows || []),
      ]);
      setInvoices(inv);
      setProducts(prods);
    } catch { }
    setLoading(false);
  }

  function openNew() {
    setEditing(null); setItems([]);
    setForm({ Supplier: '', InvoiceDate: new Date().toISOString().slice(0, 10), InvoiceNo: '', Notes: '', Freight: '0', Customs: '0', OtherCosts: '0' });
    setShowModal(true);
  }

  async function openEdit(inv) {
    setEditing(inv);
    setForm({
      Supplier: inv.Supplier || '',
      InvoiceDate: inv.InvoiceDate?.slice(0, 10) || '',
      InvoiceNo: inv.InvoiceNo || '',
      Notes: inv.Notes || '',
      Freight: String(inv.Freight || 0),
      Customs: String(inv.Customs || 0),
      OtherCosts: String(inv.OtherCosts || 0),
    });
    const rows = await q('SELECT pi.*, p.NameSE, p.ProductCode FROM PurchaseItems pi LEFT JOIN Products p ON p.ProductId=pi.ProductId WHERE pi.InvoiceId=?', [inv.InvoiceId]);
    setItems(rows.map(i => ({
      ProductId: i.ProductId, ProductCode: i.ProductCode, NameSE: i.NameSE,
      Boxes: Number(i.Boxes), Price: Number(i.Price), RowTotal: Number(i.RowTotal)
    })));
    setShowModal(true);
  }

  function addItem() {
    if (!selProduct || !itemBoxes) { showToast('اختر منتج وأدخل الكمية', 'error'); return; }
    const p = products.find(p => String(p.ProductId) === String(selProduct));
    if (!p) return;
    const b = Number(itemBoxes); const pr = Number(itemPrice) || 0;
    setItems(prev => [...prev, { ProductId: p.ProductId, ProductCode: p.ProductCode, NameSE: p.NameSE, Boxes: b, Price: pr, RowTotal: b * pr }]);
    setSelProduct(''); setItemBoxes(''); setItemPrice('');
  }

  const itemsTotal = items.reduce((s, i) => s + i.RowTotal, 0);
  const freight = Number(form.Freight) || 0;
  const customs = Number(form.Customs) || 0;
  const otherCosts = Number(form.OtherCosts) || 0;
  const grandTotal = itemsTotal + freight + customs + otherCosts;

  async function handleSave() {
    if (!form.Supplier) { showToast('أدخل اسم المورد', 'error'); return; }
    setSaving(true);
    try {
      let invId = editing?.InvoiceId;
      if (!invId) {
        await exe('INSERT INTO PurchaseInvoices (InvoiceDate, Supplier, Total, Freight, Customs, OtherCosts, GrandTotal, InvoiceNo, Notes, IsStockPosted) VALUES (?,?,?,?,?,?,?,?,?,0)',
          [form.InvoiceDate, form.Supplier, itemsTotal, freight, customs, otherCosts, grandTotal, form.InvoiceNo, form.Notes]);
        const rows = await q('SELECT InvoiceId FROM PurchaseInvoices ORDER BY InvoiceId DESC LIMIT 1');
        invId = rows[0]?.InvoiceId;
      } else {
        await exe('UPDATE PurchaseInvoices SET InvoiceDate=?, Supplier=?, Total=?, Freight=?, Customs=?, OtherCosts=?, GrandTotal=?, InvoiceNo=?, Notes=? WHERE InvoiceId=?',
          [form.InvoiceDate, form.Supplier, itemsTotal, freight, customs, otherCosts, grandTotal, form.InvoiceNo, form.Notes, invId]);
        await exe('DELETE FROM PurchaseItems WHERE InvoiceId=?', [invId]);
      }
      for (const item of items) {
        await exe('INSERT INTO PurchaseItems (InvoiceId, ProductId, Boxes, Price, RowTotal) VALUES (?,?,?,?,?)',
          [invId, item.ProductId, item.Boxes, item.Price, item.RowTotal]);
      }
      setShowModal(false);
      const url = sessionStorage.getItem('turso_url');
      const token = sessionStorage.getItem('turso_token');
      await loadAll(url, token);
      showToast('تم حفظ الفاتورة ✔');
    } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
    setSaving(false);
  }

  async function handleDelete(inv) {
    if (!confirm(`حذف الفاتورة #${inv.InvoiceId}؟`)) return;
    await exe('DELETE FROM PurchaseItems WHERE InvoiceId=?', [inv.InvoiceId]);
    await exe('DELETE FROM PurchaseInvoices WHERE InvoiceId=?', [inv.InvoiceId]);
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) { router.push('/'); return; }
    const u = sessionStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      const PERMISSIONS = {
        Admin: ['artiklar','order','orders','kunder','lager','inkop','redovisning'],
        Lager: ['artiklar','order','orders','lager','inkop'],
        Forsaljning: ['artiklar','order','orders','kunder'],
      };
      const allowed = PERMISSIONS[parsed.Role] || PERMISSIONS['Forsaljning'];
      if (!allowed.includes('inkop')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    await loadAll(url, token);
    showToast('تم الحذف');
  }

  // ── ترحيل المخزون ─────────────────────────────────────────────────────
  async function handlePostStock(inv) {
    setPosting(inv.InvoiceId);
    try {
      // جيب عناصر الفاتورة
      const invItems = await q(
        'SELECT ProductId, Boxes, Price FROM PurchaseItems WHERE InvoiceId=?', [inv.InvoiceId]);

      for (const item of invItems) {
        // تحقق ما في حركة IN مسجّلة لهذه الفاتورة مسبقاً
        const exists = await q(
          "SELECT COUNT(*) as c FROM StockMovements WHERE InvoiceId=? AND ProductId=? AND MovementType='IN'",
          [inv.InvoiceId, item.ProductId]);
        if (Number(exists[0]?.c) > 0) continue;

        await exe(
          "INSERT INTO StockMovements (ProductId, MovementType, Boxes, MovementDate, Note, InvoiceId) VALUES (?,?,?,?,?,?)",
          [item.ProductId, 'IN', item.Boxes, inv.InvoiceDate || new Date().toISOString().slice(0, 10), 'Purchase', inv.InvoiceId]);

        if (Number(item.Price) > 0)
          await exe('UPDATE Products SET CostPrice=? WHERE ProductId=?', [item.Price, item.ProductId]);
      }

      await exe('UPDATE PurchaseInvoices SET IsStockPosted=1 WHERE InvoiceId=?', [inv.InvoiceId]);

      // تحديث القائمة
      setInvoices(prev => prev.map(i => i.InvoiceId === inv.InvoiceId ? { ...i, IsStockPosted: 1 } : i));
      showToast(`تم ترحيل الفاتورة #${inv.InvoiceId} للمخزون ✔`);
    } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
    setPosting(null);
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // Supplier chips
  const suppliers = [...new Set(invoices.map(i => i.Supplier).filter(Boolean))].sort();

  const filtered = invoices
    .filter(i => {
      const matchSearch = i.Supplier?.toLowerCase().includes(search.toLowerCase()) || String(i.InvoiceId).includes(search);
      const matchSupplier = !supplierFilter || i.Supplier === supplierFilter;
      return matchSearch && matchSupplier;
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const thClass = "px-4 py-3 cursor-pointer select-none hover:bg-[#3d5268] transition text-left whitespace-nowrap";

  return (
    <div className="min-h-screen bg-gray-100">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">Inköp</h1>
        </div>
        <button onClick={openNew} className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition font-bold">
          + ny faktura
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* بحث */}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالمورد أو رقم الفاتورة..."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />

        {/* Supplier chips */}
        {suppliers.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSupplierFilter('')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${!supplierFilter ? 'bg-[#2D3E50] text-white border-[#2D3E50]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#2D3E50]'}`}>
              الكل ({invoices.length})
            </button>
            {suppliers.map(s => (
              <button key={s} onClick={() => setSupplierFilter(s === supplierFilter ? '' : s)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${supplierFilter === s ? 'bg-[#2D3E50] text-white border-[#2D3E50]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#2D3E50]'}`}>
                {s} ({invoices.filter(i => i.Supplier === s).length})
              </button>
            ))}
          </div>
        )}

        {loading ? <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div> : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[650px]">
                <thead className="bg-[#2D3E50] text-white">
                  <tr>
                    <th className={thClass} onClick={() => handleSort('InvoiceId')}># <SortIcon col="InvoiceId"/></th>
                    <th className={thClass} onClick={() => handleSort('InvoiceDate')}>Datum <SortIcon col="InvoiceDate"/></th>
                    <th className={thClass} onClick={() => handleSort('Supplier')}>Leverantör <SortIcon col="Supplier"/></th>
                    <th className={thClass} onClick={() => handleSort('InvoiceNo')}>Faktura nr <SortIcon col="InvoiceNo"/></th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('GrandTotal')}>Totalt <SortIcon col="GrandTotal"/></th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">مخزون</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">لا توجد فواتير</td></tr>
                  ) : filtered.map((inv, i) => (
                    <tr key={inv.InvoiceId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-mono text-gray-500">#{inv.InvoiceId}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{inv.InvoiceDate?.slice(0, 10)}</td>
                      <td className="px-4 py-3 font-medium">{inv.Supplier}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.InvoiceNo}</td>
                      <td className="px-4 py-3 text-right font-bold">{Number(inv.GrandTotal).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        {Number(inv.IsStockPosted) === 1 ? (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">✓ مرحّل</span>
                        ) : (
                          <button onClick={() => handlePostStock(inv)} disabled={posting === inv.InvoiceId}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-2 py-1 rounded-full font-medium disabled:opacity-50 transition">
                            {posting === inv.InvoiceId ? '...' : 'ترحيل'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button onClick={() => openEdit(inv)} className="text-blue-500 hover:text-blue-700 mr-3 text-xs font-medium">فتح</button>
                        <button onClick={() => handleDelete(inv)} className="text-red-500 hover:text-red-700 text-xs font-medium">حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t flex justify-between">
              <span>{filtered.length} faktura</span>
              <span className="font-bold text-gray-700">
                Totalt: {filtered.reduce((s, i) => s + Number(i.GrandTotal), 0).toFixed(2)} kr
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modal فاتورة */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="bg-[#2D3E50] text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="font-bold">{editing ? `تعديل فاتورة #${editing.InvoiceId}` : 'فاتورة شراء جديدة'}</h2>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* معلومات الفاتورة */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Leverantör *', key: 'Supplier' },
                  { label: 'Datum', key: 'InvoiceDate', type: 'date' },
                  { label: 'Faktura nr', key: 'InvoiceNo' },
                  { label: 'ملاحظات', key: 'Notes' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                    <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                  </div>
                ))}
              </div>

              {/* تكاليف إضافية */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-600 text-xs mb-3">تكاليف إضافية</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Frakt (kr)', key: 'Freight' },
                    { label: 'Tull (kr)', key: 'Customs' },
                    { label: 'Övrigt (kr)', key: 'OtherCosts' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}</label>
                      <input type="number" value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                    </div>
                  ))}
                </div>
              </div>

              {/* إضافة منتج */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm">إضافة منتج</h3>
                <div className="space-y-2">
                  <select value={selProduct} onChange={e => setSelProduct(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]">
                    <option value="">-- اختر منتج --</option>
                    {products.map(p => <option key={p.ProductId} value={p.ProductId}>{p.ProductCode} — {p.NameSE}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={itemBoxes} onChange={e => setItemBoxes(e.target.value)} placeholder="كراتين"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                    <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="سعر/كرتون"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                  </div>
                  <button onClick={addItem}
                    className="w-full bg-[#2D3E50] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#3d5268] transition font-bold">
                    + إضافة
                  </button>
                </div>
              </div>

              {/* جدول المنتجات */}
              {items.length > 0 && (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-600">منتج</th>
                        <th className="px-3 py-2 text-center text-gray-600">كراتين</th>
                        <th className="px-3 py-2 text-right text-gray-600">سعر</th>
                        <th className="px-3 py-2 text-right text-gray-600">إجمالي</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2">{item.NameSE}</td>
                          <td className="px-3 py-2 text-center">{item.Boxes}</td>
                          <td className="px-3 py-2 text-right">{item.Price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-bold">{item.RowTotal.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                              className="text-red-400 hover:text-red-600 font-bold">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ملخص التكاليف */}
              <div className="bg-[#2D3E50]/5 rounded-xl p-4 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>المنتجات:</span>
                  <span>{itemsTotal.toFixed(2)} kr</span>
                </div>
                {freight > 0 && <div className="flex justify-between text-gray-600"><span>Frakt:</span><span>{freight.toFixed(2)} kr</span></div>}
                {customs > 0 && <div className="flex justify-between text-gray-600"><span>Tull:</span><span>{customs.toFixed(2)} kr</span></div>}
                {otherCosts > 0 && <div className="flex justify-between text-gray-600"><span>Övrigt:</span><span>{otherCosts.toFixed(2)} kr</span></div>}
                <div className="flex justify-between font-bold text-[#2D3E50] border-t pt-2 text-base">
                  <span>GrandTotal:</span>
                  <span>{grandTotal.toFixed(2)} kr</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3 pt-4 border-t">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-[#2D3E50] text-white py-2.5 rounded-lg font-bold text-sm hover:bg-[#3d5268] transition disabled:opacity-50">
                {saving ? 'جارٍ الحفظ...' : '💾 حفظ'}
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