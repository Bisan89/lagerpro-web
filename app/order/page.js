'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-bold flex items-center gap-3
      ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      <span>{type === 'error' ? '✕' : '✓'}</span>{message}
    </div>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="bg-[#2D3E50] text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">{children}</div>
        <div className="px-6 pb-6 pt-4 border-t flex gap-3">{footer}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
    </div>
  );
}

function OrderForm() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerData, setCustomerData] = useState(null);
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
  const [toast, setToast] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ Name: '', Company: '', Phone: '', Email: '', Address: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ ProductCode: '', NameSE: '', NameAR: '', PiecesPerBox: '', Price: '', Moms: '12' });
  const [savingProduct, setSavingProduct] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  function showToast(msg, type = 'success') { setToast({ msg, type }); }

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
    } else { setShowProductList(false); }
  }, [productSearch, products]);

  async function q(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql, args }) });
    const data = await res.json();
    return data.rows || [];
  }

  async function execute(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql, args }) });
  }

  async function loadInit(url, token) {
    const [custs, prods] = await Promise.all([
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql: 'SELECT CustomerId, Name, Company, Address, Phone FROM Customers ORDER BY Name' }) }).then(r => r.json()).then(d => d.rows || []),
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql: 'SELECT ProductId, ProductCode, NameSE, NameAR, PiecesPerBox, Price FROM Products ORDER BY NameSE' }) }).then(r => r.json()).then(d => d.rows || []),
    ]);
    setCustomers(custs);
    setProducts(prods);
  }

  async function loadOrder(url, token, id) {
    setLoading(true);
    setOrderId(Number(id));
    const [order, orderItems] = await Promise.all([
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql: 'SELECT * FROM Orders WHERE OrderId=?', args: [id] }) }).then(r => r.json()).then(d => d.rows || []),
      fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql: 'SELECT * FROM OrderItems WHERE OrderId=?', args: [id] }) }).then(r => r.json()).then(d => d.rows || []),
    ]);
    if (order[0]) {
      setCustomerId(String(order[0].CustomerId || ''));
      setOrderDate(order[0].OrderDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setStatus(order[0].Status || 'Pending');
      if (order[0].CustomerId) {
        const custRows = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql: 'SELECT * FROM Customers WHERE CustomerId=?', args: [order[0].CustomerId] }) }).then(r => r.json()).then(d => d.rows || []);
        if (custRows[0]) { setCustomerData(custRows[0]); setCustomerSearch(custRows[0].Name); }
      }
    }
    setItems(orderItems.map(i => ({
      ProductCode: i.ProductCode, NameSE: i.NameSE, NameAR: i.NameAR,
      Boxes: Number(i.Boxes), PiecesPerBox: Number(i.PiecesPerBox),
      Price: Number(i.Price), RowTotal: Number(i.RowTotal)
    })));
    setLoading(false);
  }

  function selectProduct(p) {
    setSelProduct(p); setProductSearch(`${p.ProductCode} — ${p.NameAR || p.NameSE}`);
    setPrice(String(p.Price)); setShowProductList(false);
  }

  function selectCustomer(c) {
    setCustomerId(String(c.CustomerId)); setCustomerSearch(c.Name);
    setCustomerData(c); setShowCustomerList(false);
  }

  function addItem() {
    if (!selProduct || !boxes) { showToast('اختر منتج وأدخل الكراتين', 'error'); return; }
    const b = Number(boxes); const pr = Number(price);
    setItems(prev => [...prev, {
      ProductCode: selProduct.ProductCode, NameSE: selProduct.NameSE, NameAR: selProduct.NameAR,
      Boxes: b, PiecesPerBox: Number(selProduct.PiecesPerBox), Price: pr,
      RowTotal: b * Number(selProduct.PiecesPerBox) * pr
    }]);
    setSelProduct(null); setProductSearch(''); setBoxes(''); setPrice('');
  }

  const total = items.reduce((s, i) => s + i.RowTotal, 0);
  const customerName = customerData?.Name || customerSearch;

  async function handleSaveCustomer() {
    if (!newCustomer.Name) { showToast('أدخل اسم العميل', 'error'); return; }
    setSavingCustomer(true);
    try {
      await execute('INSERT INTO Customers (Name, Company, Phone, Email, Address) VALUES (?,?,?,?,?)',
        [newCustomer.Name, newCustomer.Company, newCustomer.Phone, newCustomer.Email, newCustomer.Address]);
      const rows = await q('SELECT * FROM Customers ORDER BY CustomerId DESC LIMIT 1');
      if (rows[0]) { setCustomerId(String(rows[0].CustomerId)); setCustomerSearch(rows[0].Name); setCustomerData(rows[0]); setCustomers(prev => [...prev, rows[0]]); }
      setShowAddCustomer(false);
      setNewCustomer({ Name: '', Company: '', Phone: '', Email: '', Address: '' });
      showToast('تم إضافة العميل');
    } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
    setSavingCustomer(false);
  }

  async function handleSaveProduct() {
    if (!newProduct.NameSE) { showToast('أدخل الاسم السويدي', 'error'); return; }
    setSavingProduct(true);
    try {
      await execute('INSERT INTO Products (ProductCode, NameSE, NameAR, PiecesPerBox, Price, Moms) VALUES (?,?,?,?,?,?)',
        [newProduct.ProductCode, newProduct.NameSE, newProduct.NameAR, Number(newProduct.PiecesPerBox), Number(newProduct.Price), Number(newProduct.Moms)]);
      const rows = await q('SELECT * FROM Products ORDER BY ProductId DESC LIMIT 1');
      if (rows[0]) { setProducts(prev => [...prev, rows[0]]); setSelProduct(rows[0]); setProductSearch(`${rows[0].ProductCode} — ${rows[0].NameAR || rows[0].NameSE}`); setPrice(String(rows[0].Price)); }
      setShowAddProduct(false);
      setNewProduct({ ProductCode: '', NameSE: '', NameAR: '', PiecesPerBox: '', Price: '', Moms: '12' });
      showToast('تم إضافة المنتج');
    } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
    setSavingProduct(false);
  }

  async function handleSave() {
    if (!customerId) { showToast('اختر عميل', 'error'); return; }
    if (items.length === 0) { showToast('أضف منتج واحد على الأقل', 'error'); return; }
    setSaving(true);
    try {
      let oid = orderId;
      if (!oid) {
        await execute('INSERT INTO Orders (CustomerId, OrderDate, Status, OrderType) VALUES (?,?,?,?)', [Number(customerId), orderDate, status, 'Normal']);
        const rows = await q('SELECT OrderId FROM Orders ORDER BY OrderId DESC LIMIT 1');
        oid = rows[0]?.OrderId; setOrderId(oid);
      } else {
        await execute('UPDATE Orders SET CustomerId=?, OrderDate=?, Status=? WHERE OrderId=?', [Number(customerId), orderDate, status, oid]);
        await execute('DELETE FROM OrderItems WHERE OrderId=?', [oid]);
      }
      for (const item of items)
        await execute('INSERT INTO OrderItems (OrderId, ProductCode, NameSE, NameAR, Boxes, PiecesPerBox, Price, RowTotal) VALUES (?,?,?,?,?,?,?,?)',
          [oid, item.ProductCode, item.NameSE, item.NameAR, item.Boxes, item.PiecesPerBox, item.Price, item.RowTotal]);
      showToast('تم الحفظ بنجاح!');
      setTimeout(() => router.push('/orders'), 1200);
    } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
    setSaving(false);
  }

  async function generatePdf(type) {
    const html2pdf = (await import('html2pdf.js')).default;
    const title = type === 'foljesedel' ? 'FÖLJESEDEL' : 'ORDER';
    const filename = `${type === 'foljesedel' ? 'Foljesedel' : 'Order'}_${orderId||'NY'}_${customerName||''}.pdf`;

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; font-size: 11px; direction: ltr;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="font-size: 22px; font-weight: bold; letter-spacing: 3px; margin: 0;">${title}</h1>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
          <div>
            <p style="margin: 3px 0;"><strong>Ordernr:</strong> ${orderId || 'NY'}</p>
            <p style="margin: 3px 0;"><strong>Datum:</strong> ${orderDate}</p>
          </div>
          <div style="text-align: right; direction: rtl;">
            <p style="margin: 3px 0; font-size: 13px;">السيد ${customerName} المحترم</p>
            ${customerData?.Company ? `<p style="margin: 3px 0;">${customerData.Company}</p>` : ''}
            ${customerData?.Address ? `<p style="margin: 3px 0;">${customerData.Address}</p>` : ''}
          </div>
        </div>

        <hr style="border: 2px solid #2D3E50; margin-bottom: 12px;" />

        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background-color: #2D3E50; color: white;">
              <th style="padding: 6px 8px; text-align: left; border: 1px solid #1a2a3a;">Kod</th>
              <th style="padding: 6px 8px; text-align: left; border: 1px solid #1a2a3a;">Produkt (SE)</th>
              <th style="padding: 6px 8px; text-align: right; border: 1px solid #1a2a3a; direction: rtl;">المنتج (AR)</th>
              <th style="padding: 6px 8px; text-align: center; border: 1px solid #1a2a3a;">Krt</th>
              <th style="padding: 6px 8px; text-align: center; border: 1px solid #1a2a3a;">Per krt</th>
              <th style="padding: 6px 8px; text-align: right; border: 1px solid #1a2a3a;">Pris/st</th>
              <th style="padding: 6px 8px; text-align: right; border: 1px solid #1a2a3a;">Totalt</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
              <tr style="background-color: ${i % 2 === 0 ? 'white' : '#f9f9f9'}; page-break-inside: avoid;">
                <td style="padding: 5px 8px; border: 1px solid #ddd;">${item.ProductCode||''}</td>
                <td style="padding: 5px 8px; border: 1px solid #ddd;">${item.NameSE||''}</td>
                <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: right; direction: rtl;">${item.NameAR||''}</td>
                <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: center;">${item.Boxes}</td>
                <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: center;">${item.PiecesPerBox}</td>
                <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: right;">${Number(item.Price).toFixed(2)}</td>
                <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${Number(item.RowTotal).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background-color: #f0f0f0;">
              <td colspan="6" style="padding: 6px 8px; border: 1px solid #ddd; text-align: right;">Ordertotal:</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; text-align: right;">${total.toFixed(2)} kr</td>
            </tr>
          </tfoot>
        </table>


      </div>
    `;

    const opt = {
      margin: 10,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(html).save();
  }
  const filteredCustomers = customers.filter(c => c.Name?.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 8);
  const statuses = ['Pending', 'Done', 'Levererad', 'Skickad', 'Edited'];

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">جارٍ التحميل...</div>;

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="min-h-screen bg-gray-100">
        <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/orders')} className="text-gray-300 hover:text-white">← رجوع</button>
            <h1 className="text-xl font-bold">{orderId ? `Order #${orderId}` : 'Ny order'}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => generatePdf('order')}
              className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg transition font-bold">
              📥 Order PDF
            </button>
            <button onClick={() => generatePdf('foljesedel')}
              className="bg-purple-500 hover:bg-purple-600 text-white text-xs px-3 py-2 rounded-lg transition font-bold">
              📥 Följesedel PDF
            </button>
            <button onClick={handleSave} disabled={saving}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition font-bold">
              {saving ? '...' : '💾 Spara'}
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-gray-700 mb-4 text-sm">معلومات الطلب</h2>
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kund</label>
                <div className="flex gap-2">
                  <input type="text" value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerList(true); setCustomerId(''); setCustomerData(null); }}
                    onFocus={() => setShowCustomerList(true)} placeholder="ابحث عن عميل..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                  <button onClick={() => setShowAddCustomer(true)}
                    className="bg-[#2D3E50] hover:bg-[#3d5268] text-white px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap">+ عميل</button>
                </div>
                {showCustomerList && customerSearch.length > 0 && filteredCustomers.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button key={c.CustomerId} onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100">
                        <div>{c.Name}</div>
                        {c.Company && <div className="text-xs text-gray-400">{c.Company}</div>}
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

          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-gray-700 mb-4 text-sm">إضافة منتج</h2>
            <div className="space-y-3">
              <div className="relative">
                <div className="flex gap-2">
                  <input type="text" value={productSearch}
                    onChange={e => { setProductSearch(e.target.value); setSelProduct(null); }}
                    placeholder="ابحث بالاسم العربي أو السويدي أو الكود..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                  <button onClick={() => setShowAddProduct(true)}
                    className="bg-[#2D3E50] hover:bg-[#3d5268] text-white px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap">+ منتج</button>
                </div>
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

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[550px]">
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
                        <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600 font-bold">✕</button>
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

      {showAddCustomer && (
        <Modal title="عميل جديد" onClose={() => setShowAddCustomer(false)}
          footer={<>
            <button onClick={handleSaveCustomer} disabled={savingCustomer}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
              {savingCustomer ? '...' : 'حفظ واختيار'}
            </button>
            <button onClick={() => setShowAddCustomer(false)}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-200">إلغاء</button>
          </>}>
          {[{label:'Namn *',key:'Name'},{label:'Företag',key:'Company'},{label:'Telefon',key:'Phone'},{label:'Email',key:'Email'},{label:'Adress',key:'Address'}].map(f => (
            <Field key={f.key} label={f.label} value={newCustomer[f.key]} onChange={v => setNewCustomer({...newCustomer, [f.key]: v})} />
          ))}
        </Modal>
      )}

      {showAddProduct && (
        <Modal title="منتج جديد" onClose={() => setShowAddProduct(false)}
          footer={<>
            <button onClick={handleSaveProduct} disabled={savingProduct}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
              {savingProduct ? '...' : 'حفظ واختيار'}
            </button>
            <button onClick={() => setShowAddProduct(false)}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-200">إلغاء</button>
          </>}>
          {[{label:'Produktkod',key:'ProductCode'},{label:'Namn SE *',key:'NameSE'},{label:'الاسم العربي',key:'NameAR'},{label:'Per kartong',key:'PiecesPerBox',type:'number'},{label:'Pris (kr)',key:'Price',type:'number'},{label:'Moms (%)',key:'Moms',type:'number'}].map(f => (
            <Field key={f.key} label={f.label} type={f.type} value={newProduct[f.key]} onChange={v => setNewProduct({...newProduct, [f.key]: v})} />
          ))}
        </Modal>
      )}
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