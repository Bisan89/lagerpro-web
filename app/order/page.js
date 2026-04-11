'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function OrderForm() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('Pending');
  const [orderId, setOrderId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);
  const [selProduct, setSelProduct] = useState(null);
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

  useEffect(() => {
    if (productSearch.length > 0) {
      const f = products.filter(p =>
        p.NameSE?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.NameAR?.includes(productSearch) ||
        p.ProductCode?.includes(productSearch)
      ).slice(0, 10);
      setFilteredProducts(f);
      setShowProductList(true);
    } else {
      setShowProductList(false);
    }
  }, [productSearch, products]);

  async function loadInit(url, token) {
    const [custs, prods] = await Promise.all([
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT CustomerId, Name FROM Customers ORDER BY Name' }) }).then(r => r.json()).then(d => d.rows || []),
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT ProductId, ProductCode, NameSE, NameAR, PiecesPerBox, Price FROM Products ORDER BY NameSE' }) }).then(r => r.json()).then(d => d.rows || []),
    ]);
    setCustomers(custs);
    setProducts(prods);
  }

  async function loadOrder(url, token, id) {
    setLoading(true);
    setOrderId(Number(id));
    const [order, orderItems] = await Promise.all([
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT * FROM Orders WHERE OrderId=?', args: [id] }) }).then(r => r.json()).then(d => d.rows || []),
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT * FROM OrderItems WHERE OrderId=?', args: [id] }) }).then(r => r.json()).then(d => d.rows || []),
    ]);
    if (order[0]) {
      setCustomerId(String(order[0].CustomerId || ''));
      setOrderDate(order[0].OrderDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setStatus(order[0].Status || 'Pending');
    }
    setItems(orderItems.map(i => ({
      ProductCode: i.ProductCode, NameSE: i.NameSE, NameAR: i.NameAR,
      Boxes: Number(i.Boxes), PiecesPerBox: Number(i.PiecesPerBox),
      Price: Number(i.Price), RowTotal: Number(i.RowTotal)
    })));
    setLoading(false);
  }

  function selectProduct(p) {
    setSelProduct(p);
    setProductSearch(`${p.ProductCode} — ${p.NameAR || p.NameSE}`);
    setPrice(String(p.Price));
    setShowProductList(false);
  }

  function selectCustomer(c) {
    setCustomerId(String(c.CustomerId));
    setCustomerSearch(c.Name);
    setShowCustomerList(false);
  }

  function addItem() {
    if (!selProduct || !boxes) return alert('اختر منتج وأدخل الكراتين');
    const b = Number(boxes);
    const pr = Number(price);
    setItems(prev => [...prev, {
      ProductCode: selProduct.ProductCode, NameSE: selProduct.NameSE, NameAR: selProduct.NameAR,
      Boxes: b, PiecesPerBox: Number(selProduct.PiecesPerBox),
      Price: pr, RowTotal: b * Number(selProduct.PiecesPerBox) * pr
    }]);
    setSelProduct(null); setProductSearch(''); setBoxes(''); setPrice('');
  }

  async function execute(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql, args }) });
  }

  async function q(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql, args }) });
    const data = await res.json();
    return data.rows || [];
  }

  const total = items.reduce((s, i) => s + i.RowTotal, 0);

  async function handleSave() {
    if (!customerId) return alert('اختر عميل');
    if (items.length === 0) return alert('أضف منتج واحد على الأقل');
    setSaving(true);
    try {
      let oid = orderId;
      if (!oid) {
        await execute('INSERT INTO Orders (CustomerId, OrderDate, Status, OrderType) VALUES (?,?,?,?)',
          [Number(customerId), orderDate, status, 'Normal']);
        const rows = await q('SELECT OrderId FROM Orders ORDER BY OrderId DESC LIMIT 1');
        oid = rows[0]?.OrderId;
        setOrderId(oid);
      } else {
        await execute('UPDATE Orders SET CustomerId=?, OrderDate=?, Status=? WHERE OrderId=?',
          [Number(customerId), orderDate, status, oid]);
        await execute('DELETE FROM OrderItems WHERE OrderId=?', [oid]);
      }
      for (const item of items) {
        await execute('INSERT INTO OrderItems (OrderId, ProductCode, NameSE, NameAR, Boxes, PiecesPerBox, Price, RowTotal) VALUES (?,?,?,?,?,?,?,?)',
          [oid, item.ProductCode, item.NameSE, item.NameAR, item.Boxes, item.PiecesPerBox, item.Price, item.RowTotal]);
      }
      alert('تم الحفظ بنجاح!');
      router.push('/orders');
    } catch (e) { alert('خطأ: ' + e.message); }
    setSaving(false);
  }

  function generatePDF(type) {
  const doc = new jsPDF();
  const isFollowup = type === 'foljesedel';
  const customerName = customers.find(c => String(c.CustomerId) === String(customerId))?.Name || customerSearch;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(isFollowup ? 'FÖLJESEDEL' : 'ORDER', 105, 20, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ordernr: ${orderId || 'NY'}`, 14, 35);
  doc.text(`Datum: ${orderDate}`, 14, 42);
  doc.text(`Kund: ${customerName}`, 14, 49);

  const headers = [['Kod', 'Produkt (SE)', 'Produkt (AR)', 'Krt', 'Per krt', 'Pris/st', 'Totalt']];
  const rows = items.map(i => [
    i.ProductCode || '',
    i.NameSE || '',
    i.NameAR || '',
    i.Boxes,
    i.PiecesPerBox,
    Number(i.Price).toFixed(2),
    Number(i.RowTotal).toFixed(2)
  ]);

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 58,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [45, 62, 80], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 249] },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 45 },
      2: { cellWidth: 45 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
    }
  });

  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Ordertotal: ${total.toFixed(2)} kr`, 14, finalY);

  doc.save(isFollowup ? `FOLJESEDEL_${orderId || 'NY'}.pdf` : `Order_${orderId || 'NY'}.pdf`);
}

  const filteredCustomers = customers.filter(c => c.Name?.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 8);
  const statuses = ['Pending', 'Done', 'Levererad', 'Skickad', 'Edited'];
  const customerName = customers.find(c => String(c.CustomerId) === String(customerId))?.Name || customerSearch;

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">جارٍ التحميل...</div>;

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Print View */}
      <div className="print-only p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Lager Pro</h1>
          <p className="text-gray-600">Order #{orderId}</p>
        </div>
        <div className="mb-4 flex justify-between">
          <div><strong>Kund:</strong> {customerName}</div>
          <div><strong>Datum:</strong> {orderDate}</div>
          <div><strong>Status:</strong> {status}</div>
        </div>
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left">Kod</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Produkt</th>
              <th className="border border-gray-300 px-3 py-2 text-right">اسم عربي</th>
              <th className="border border-gray-300 px-3 py-2 text-center">Krt</th>
              <th className="border border-gray-300 px-3 py-2 text-center">Per</th>
              <th className="border border-gray-300 px-3 py-2 text-right">Pris</th>
              <th className="border border-gray-300 px-3 py-2 text-right">Totalt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-3 py-2">{item.ProductCode}</td>
                <td className="border border-gray-300 px-3 py-2">{item.NameSE}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{item.NameAR}</td>
                <td className="border border-gray-300 px-3 py-2 text-center">{item.Boxes}</td>
                <td className="border border-gray-300 px-3 py-2 text-center">{item.PiecesPerBox}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{Number(item.Price).toFixed(2)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-bold">{Number(item.RowTotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={6} className="border border-gray-300 px-3 py-2 text-right">Totalt:</td>
              <td className="border border-gray-300 px-3 py-2 text-right">{total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Normal View */}
      <div className="min-h-screen bg-gray-100 no-print">
        <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/orders')} className="text-gray-300 hover:text-white">← رجوع</button>
            <h1 className="text-xl font-bold">{orderId ? `Order #${orderId}` : 'Ny order'}</h1>
          </div>
         <div className="flex gap-2">
  <button onClick={() => generatePDF('order')}
    className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg transition font-bold">
    📄 Order
  </button>
  <button onClick={() => generatePDF('foljesedel')}
    className="bg-purple-500 hover:bg-purple-600 text-white text-xs px-3 py-2 rounded-lg transition font-bold">
    📋 Följesedel
  </button>
  <button onClick={handleSave} disabled={saving}
    className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition font-bold">
    {saving ? '...' : '💾 Spara'}
  </button>
</div>
        </div>

        <div className="max-w-4xl mx-auto p-4 space-y-4">

          {/* معلومات الطلب */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-gray-700 mb-4 text-sm">معلومات الطلب</h2>
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kund</label>
                <input type="text" value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerList(true); setCustomerId(''); }}
                  onFocus={() => setShowCustomerList(true)}
                  placeholder="ابحث عن عميل..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                {showCustomerList && customerSearch.length > 0 && filteredCustomers.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button key={c.CustomerId} onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100">
                        {c.Name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Datum</label>
                  <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]">
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* إضافة منتج */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-gray-700 mb-4 text-sm">إضافة منتج</h2>
            <div className="space-y-3">
              <div className="relative">
                <input type="text" value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setSelProduct(null); }}
                  placeholder="ابحث بالاسم العربي أو السويدي أو الكود..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                {showProductList && filteredProducts.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <button key={p.ProductId} onClick={() => selectProduct(p)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-100">
                        <div className="font-medium">{p.NameAR || p.NameSE}</div>
                        <div className="text-xs text-gray-400">{p.NameSE} — {p.ProductCode}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">كراتين</label>
                  <input type="number" value={boxes} onChange={e => setBoxes(e.target.value)} min="1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">سعر</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                </div>
              </div>
              <button onClick={addItem}
                className="w-full bg-[#2D3E50] hover:bg-[#3d5268] text-white text-sm py-2.5 rounded-lg transition font-bold">
                + Lägg till
              </button>
            </div>
          </div>

          {/* بنود الطلب */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-[#2D3E50] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Kod</th>
                    <th className="px-4 py-3 text-left">Produkt SE</th>
                    <th className="px-4 py-3 text-right">عربي</th>
                    <th className="px-4 py-3 text-center">Krt</th>
                    <th className="px-4 py-3 text-center">Per</th>
                    <th className="px-4 py-3 text-right">Pris</th>
                    <th className="px-4 py-3 text-right">Totalt</th>
                    <th className="px-4 py-3 text-center">✕</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">لا توجد منتجات</td></tr>
                  ) : items.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-mono text-gray-500 whitespace-nowrap">{item.ProductCode}</td>
                      <td className="px-4 py-3 text-xs">{item.NameSE}</td>
                      <td className="px-4 py-3 text-right text-xs">{item.NameAR}</td>
                      <td className="px-4 py-3 text-center">{item.Boxes}</td>
                      <td className="px-4 py-3 text-center">{item.PiecesPerBox}</td>
                      <td className="px-4 py-3 text-right">{Number(item.Price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold">{Number(item.RowTotal).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-red-500 font-bold">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={6} className="px-4 py-3 text-right font-bold text-gray-700">Totalt:</td>
                    <td className="px-4 py-3 text-right font-bold text-lg text-[#2D3E50]">{total.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">جارٍ التحميل...</div>}>
      <OrderForm />
    </Suspense>
  );
}