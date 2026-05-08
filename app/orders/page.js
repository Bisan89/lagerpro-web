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

function statusColor(s) {
  switch (s) {
    case 'Pending':  return 'bg-yellow-100 text-yellow-700';
    case 'Done': case 'Levererad': return 'bg-green-100 text-green-700';
    case 'Skickad':  return 'bg-blue-100 text-blue-700';
    case 'Edited':   return 'bg-gray-200 text-gray-700';
    case 'Credit':   return 'bg-red-100 text-red-700';
    default:         return 'bg-gray-100 text-gray-600';
  }
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [chipFilter, setChipFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('OrderId');
  const [sortDir, setSortDir] = useState('desc');
  const [toast, setToast] = useState(null);
  const [delivering, setDelivering] = useState(null);
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
      if (!allowed.includes('orders')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    loadOrders(url, token);
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
      if (!allowed.includes('orders')) { router.push('/dashboard'); return; }
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
      if (!allowed.includes('orders')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql, args }) });
    const data = await res.json();
    return data.rows || [];
  }

  async function loadOrders(url, token) {
    setLoading(true);
    try {
      const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: `
          SELECT o.OrderId, o.OrderDate, o.Status, o.OrderType,
                 c.Name as CustomerName,
                 IFNULL((SELECT SUM(RowTotal) FROM OrderItems WHERE OrderId=o.OrderId),0) as Total
          FROM Orders o
          LEFT JOIN Customers c ON c.CustomerId=o.CustomerId
          ORDER BY o.OrderId DESC` }) });
      const data = await res.json();
      setOrders(data.rows || []);
    } catch { }
    setLoading(false);
  }

  async function fixStockMovements() {
    if (!confirm('رح يتم فحص كل الطلبيات المسلّمة وإضافة حركات المخزون الناقصة. متابعة؟')) return;
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    let fixed = 0;

    try {
      // جيب كل الطلبيات المسلّمة
      const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token,
          sql: "SELECT OrderId, OrderDate FROM Orders WHERE Status IN ('Levererad','Done') AND OrderType='Normal'" }) });
      const data = await res.json();
      const delivered = data.rows || [];

      for (const order of delivered) {
        // جيب عناصر الطلبية
        const itemsRes = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token,
            sql: 'SELECT ProductId, Boxes FROM OrderItems WHERE OrderId=? AND ProductId IS NOT NULL',
            args: [order.OrderId] }) });
        const itemsData = await itemsRes.json();
        const items = itemsData.rows || [];

        for (const item of items) {
          if (!item.ProductId || Number(item.Boxes) <= 0) continue;

          // تحقق ما في OUT movement لهذه الطلبية
          const checkRes = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, token,
              sql: "SELECT COUNT(*) as c FROM StockMovements WHERE OrderId=? AND ProductId=? AND MovementType='OUT'",
              args: [order.OrderId, item.ProductId] }) });
          const checkData = await checkRes.json();
          if (Number(checkData.rows?.[0]?.c) > 0) continue;

          // أضف OUT movement
          await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, token,
              sql: "INSERT INTO StockMovements (ProductId, MovementType, Boxes, MovementDate, Note, OrderId) VALUES (?,?,?,?,?,?)",
              args: [item.ProductId, 'OUT', item.Boxes,
                order.OrderDate?.slice(0,10) || new Date().toISOString().slice(0,10),
                `Order #${order.OrderId}`, order.OrderId] }) });
          fixed++;
        }
      }
      showToast(`تم تصحيح ${fixed} حركة مخزون ✔`);
    } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
  }

  async function handleDeliver(o) {
    if (!confirm(`تأكيد تسليم الطلب #${o.OrderId} للعميل ${o.CustomerName}؟`)) return;
    setDelivering(o.OrderId);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // 1. غيّر حالة الطلبية
      await exe('UPDATE Orders SET Status=?, DeliveryDate=? WHERE OrderId=?',
        ['Levererad', today, o.OrderId]);

      // 2. جيب عناصر الطلبية
      const url = sessionStorage.getItem('turso_url');
      const token = sessionStorage.getItem('turso_token');
      const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token,
          sql: 'SELECT ProductId, Boxes FROM OrderItems WHERE OrderId=? AND ProductId IS NOT NULL',
          args: [o.OrderId] }) });
      const data = await res.json();
      const items = data.rows || [];

      // 3. عمل OUT movement لكل منتج
      for (const item of items) {
        if (!item.ProductId || Number(item.Boxes) <= 0) continue;
        const checkRes = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token,
            sql: "SELECT COUNT(*) as c FROM StockMovements WHERE OrderId=? AND ProductId=? AND MovementType='OUT'",
            args: [o.OrderId, item.ProductId] }) });
        const checkData = await checkRes.json();
        if (Number(checkData.rows?.[0]?.c) > 0) continue;

        await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token,
            sql: "INSERT INTO StockMovements (ProductId, MovementType, Boxes, MovementDate, Note, OrderId) VALUES (?,?,?,?,?,?)",
            args: [item.ProductId, 'OUT', item.Boxes, today, `Order #${o.OrderId}`, o.OrderId] }) });
      }

      setOrders(prev => prev.map(ord =>
        ord.OrderId === o.OrderId ? { ...ord, Status: 'Levererad' } : ord));
      showToast(`تم تسليم الطلب #${o.OrderId} ✔`);
    } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
    setDelivering(null);
  }

  async function handleDelete(o) {
    if (!confirm(`حذف الطلب #${o.OrderId}؟`)) return;
    await exe('DELETE FROM OrderItems WHERE OrderId=?', [o.OrderId]);
    await exe('DELETE FROM Orders WHERE OrderId=?', [o.OrderId]);
    setOrders(prev => prev.filter(ord => ord.OrderId !== o.OrderId));
    showToast('تم الحذف');
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // حساب عدد كل حالة
  const normalOrders = orders.filter(o => o.OrderType !== 'Credit');
  const counts = {
    '': normalOrders.length,
    'Pending':   normalOrders.filter(o => o.Status === 'Pending').length,
    'Skickad':   normalOrders.filter(o => ['Skickad','Edited'].includes(o.Status)).length,
    'Levererad': normalOrders.filter(o => ['Done','Levererad'].includes(o.Status)).length,
    'Credit':    orders.filter(o => o.OrderType === 'Credit').length,
  };

  const chips = [
    { key: '',          label: 'الكل' },
    { key: 'Pending',   label: 'Pending' },
    { key: 'Skickad',   label: 'Skickad' },
    { key: 'Levererad', label: 'Levererad' },
    { key: 'Credit',    label: 'Kreditorder' },
  ];

  const chipColors = {
    '':          { active: 'bg-[#2D3E50] text-white border-[#2D3E50]',   idle: 'bg-white text-gray-600 border-gray-300' },
    'Pending':   { active: 'bg-yellow-500 text-white border-yellow-500',  idle: 'bg-white text-yellow-600 border-yellow-300' },
    'Skickad':   { active: 'bg-blue-500 text-white border-blue-500',      idle: 'bg-white text-blue-600 border-blue-300' },
    'Levererad': { active: 'bg-green-500 text-white border-green-500',    idle: 'bg-white text-green-600 border-green-300' },
    'Credit':    { active: 'bg-red-500 text-white border-red-500',        idle: 'bg-white text-red-600 border-red-300' },
  };

  const filtered = orders
    .filter(o => {
      const matchSearch = o.CustomerName?.toLowerCase().includes(search.toLowerCase()) ||
        String(o.OrderId).includes(search);
      const matchChip = chipFilter === ''
        ? o.OrderType !== 'Credit'
        : chipFilter === 'Credit'
          ? o.OrderType === 'Credit'
          : chipFilter === 'Skickad'
            ? ['Skickad','Edited'].includes(o.Status)
            : chipFilter === 'Levererad'
              ? ['Done','Levererad'].includes(o.Status)
              : o.Status === chipFilter;
      return matchSearch && matchChip;
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
          <h1 className="text-xl font-bold">Sparade order</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={fixStockMovements}
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-2 rounded-lg transition font-bold">
            🔧 تصحيح المخزون
          </button>
          <button onClick={() => router.push('/order')}
            className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition font-bold">
            + ny order
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* بحث */}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالعميل أو رقم الطلب..."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />

        {/* Chips */}
        <div className="flex gap-2 flex-wrap">
          {chips.map(chip => (
            <button key={chip.key} onClick={() => setChipFilter(chip.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition
                ${chipFilter === chip.key ? chipColors[chip.key].active : chipColors[chip.key].idle}`}>
              {chip.label} ({counts[chip.key]})
            </button>
          ))}
        </div>

        {loading ? <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div> : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-[#2D3E50] text-white">
                  <tr>
                    <th className={thClass} onClick={() => handleSort('OrderId')}># <SortIcon col="OrderId"/></th>
                    <th className={thClass} onClick={() => handleSort('CustomerName')}>Kund <SortIcon col="CustomerName"/></th>
                    <th className={thClass} onClick={() => handleSort('OrderDate')}>Datum <SortIcon col="OrderDate"/></th>
                    <th className={thClass} onClick={() => handleSort('Status')}>Status <SortIcon col="Status"/></th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('Total')}>Totalt <SortIcon col="Total"/></th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">لا توجد طلبات</td></tr>
                  ) : filtered.map((o, i) => (
                    <tr key={o.OrderId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-mono text-gray-500">#{o.OrderId}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{o.CustomerName}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{o.OrderDate?.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(o.Status)}`}>
                          {o.Status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{Number(o.Total).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap space-x-2">
                        <button onClick={() => router.push(`/order?id=${o.OrderId}`)}
                          className="text-blue-500 hover:text-blue-700 text-xs font-medium">
                          فتح
                        </button>
                        {o.Status === 'Pending' && (
                          <button onClick={() => handleDeliver(o)}
                            disabled={delivering === o.OrderId}
                            className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-50 mx-2">
                            {delivering === o.OrderId ? '...' : 'تسليم'}
                          </button>
                        )}
                        {(o.Status === 'Pending' || o.Status === 'Skickad') && (
                          <button onClick={() => handleDelete(o)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium">
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t flex justify-between">
              <span>{filtered.length} order</span>
              <span className="font-bold text-gray-700">
                {filtered.reduce((s, o) => s + Number(o.Total), 0).toFixed(2)} kr
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}