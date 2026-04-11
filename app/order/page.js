'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function OrderForm() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('Pending');
  const [orderId, setOrderId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // إضافة منتج
  const [selProduct, setSelProduct] = useState('');
  const [boxes, setBoxes] = useState('');
  const [price, setPrice] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) { router.push('/'); return; }

    loadInit(url, token);

    const id = searchParams.get('id');
    if (id) loadOrder(url, token, id);
  }, []);

  async function q(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql, args })
    });
    const data = await res.json();
    return data.rows || [];
  }

  async function execute(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql, args })
    });
    return res.json();
  }

  async function loadInit(url, token) {
    const [custs, prods] = await Promise.all([
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT CustomerId, Name FROM Customers ORDER BY Name' }) })
        .then(r => r.json()).then(d => d.rows || []),
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT ProductId, ProductCode, NameSE, NameAR, PiecesPerBox, Price FROM Products ORDER BY NameSE' }) })
        .then(r => r.json()).then(d => d.rows || []),
    ]);
    setCustomers(custs);
    setProducts(prods);
  }

  async function loadOrder(url, token, id) {
    setLoading(true);
    setOrderId(Number(id));
    const [order, orderItems] = await Promise.all([
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT * FROM Orders WHERE OrderId=?', args: [id] }) })
        .then(r => r.json()).then(d => d.rows || []),
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT * FROM OrderItems WHERE OrderId=?', args: [id] }) })
        .then(r => r.json()).then(d => d.rows || []),
    ]);
    if (order[0]) {
      setCustomerId(String(order[0].CustomerId || ''));
      setOrderDate(order[0].OrderDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setStatus(order[0].Status || 'Pending');
    }
    setItems(orderItems.map(i => ({
      ItemId: i.ItemId,
      ProductCode: i.ProductCode,
      NameSE: i.NameSE,
      NameAR: i.NameAR,
      Boxes: Number(i.Boxes),
      PiecesPerBox: Number(i.PiecesPerBox),
      Price: Number(i.Price),
      RowTotal: Number(i.RowTotal)
    })));
    setLoading(false);
  }

  function handleSelectProduct(productId) {
    setSelProduct(productId);
    const p = products.find(p => String(p.ProductId) === String(productId));
    if (p) setPrice(String(p.Price));
  }

  function addItem() {
    if (!selProduct || !boxes) return alert('اختر منتج وأدخل الكراتين');
    const p = products.find(p => String(p.ProductId) === String(selProduct));
    if (!p) return;
    const b = Number(boxes);
    const pr = Number(price);
    const total = b * p.PiecesPerBox * pr;
    setItems(prev => [...prev, {
      ItemId: null,
      ProductCode: p.ProductCode,
      NameSE: p.NameSE,
      NameAR: p.NameAR,
      Boxes: b,
      PiecesPerBox: Number(p.PiecesPerBox),
      Price: pr,
      RowTotal: total
    }]);
    setSelProduct('');
    setBoxes('');
    setPrice('');
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce((s, i) => s + i.RowTotal, 0);

  async function handleSave() {
    if (!customerId) return alert('اختر عميل');
    if (items.length === 0) return alert('أضف منتج واحد على الأقل');
    setSaving(true);
    try {
      let oid = orderId;
      if (!oid) {
        // إنشاء طلب جديد
        await execute(
          'INSERT INTO Orders (CustomerId, OrderDate, Status, OrderType) VALUES (?,?,?,?)',
          [Number(customerId), orderDate, status, 'Normal']
        );
        const rows = await q('SELECT OrderId FROM Orders ORDER BY OrderId DESC LIMIT 1');
        oid = rows[0]?.OrderId;
        setOrderId(oid);
      } else {
        await execute(
          'UPDATE Orders SET CustomerId=?, OrderDate=?, Status=? WHERE OrderId=?',
          [Number(customerId), orderDate, status, oid]
        );
        await execute('DELETE FROM OrderItems WHERE OrderId=?', [oid]);
      }

      // إضافة البنود
      for (const item of items) {
        await execute(
          'INSERT INTO OrderItems (OrderId, ProductCode, NameSE, NameAR, Boxes, PiecesPerBox, Price, RowTotal) VALUES (?,?,?,?,?,?,?,?)',
          [oid, item.ProductCode, item.NameSE, item.NameAR, item.Boxes, item.PiecesPerBox, item.Price, item.RowTotal]
        );
      }

      alert('تم الحفظ بنجاح!');
      router.push('/orders');
    } catch (e) { alert('خطأ: ' + e.message); }
    setSaving(false);
  }

  const statuses = ['Pending', 'Done', 'Levererad', 'Skickad', 'Edited'];

  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-400">جارٍ التحميل...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/orders')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">{orderId ? `Order #${orderId}` : 'Ny order'}</h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition font-bold">
          {saving ? 'جارٍ الحفظ...' : '💾 Spara'}
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* معلومات الطلب */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-gray-700 mb-4">معلومات الطلب</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Kund</label>
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]"
              >
                <option value="">-- اختر عميل --</option>
                {customers.map(c => (
                  <option key={c.CustomerId} value={c.CustomerId}>{c.Name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Datum</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]">
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* إضافة منتج */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-gray-700 mb-4">إضافة منتج</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <select value={selProduct} onChange={e => handleSelectProduct(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]">
                <option value="">-- اختر منتج --</option>
                {products.map(p => (
                  <option key={p.ProductId} value={p.ProductId}>{p.ProductCode} — {p.NameSE}</option>
                ))}
              </select>
            </div>
            <div>
              <input type="number" value={boxes} onChange={e => setBoxes(e.target.value)}
                placeholder="كراتين" min="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
            </div>
            <div>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="سعر"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
            </div>
          </div>
          <button onClick={addItem}
            className="mt-3 bg-[#2D3E50] hover:bg-[#3d5268] text-white text-sm px-4 py-2 rounded-lg transition">
            + Lägg till
          </button>
        </div>

        {/* بنود الطلب */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#2D3E50] text-white">
              <tr>
                <th className="px-4 py-3 text-left">Kod</th>
                <th className="px-4 py-3 text-left">Produkt</th>
                <th className="px-4 py-3 text-center">Kartonger</th>
                <th className="px-4 py-3 text-center">Per krt</th>
                <th className="px-4 py-3 text-right">Pris</th>
                <th className="px-4 py-3 text-right">Totalt</th>
                <th className="px-4 py-3 text-center">حذف</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">لا توجد منتجات</td></tr>
              ) : items.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-mono text-gray-500">{item.ProductCode}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.NameSE}</div>
                    <div className="text-xs text-gray-400">{item.NameAR}</div>
                  </td>
                  <td className="px-4 py-3 text-center">{item.Boxes}</td>
                  <td className="px-4 py-3 text-center">{item.PiecesPerBox}</td>
                  <td className="px-4 py-3 text-right">{Number(item.Price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold">{Number(item.RowTotal).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td colSpan={5} className="px-4 py-3 text-right font-bold text-gray-700">Totalt:</td>
                <td className="px-4 py-3 text-right font-bold text-lg text-[#2D3E50]">{total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">جارٍ التحميل...</div>}>
      <OrderForm />
    </Suspense>
  );
}