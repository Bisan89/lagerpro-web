'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('OrderId');
  const [sortDir, setSortDir] = useState('desc');
  const router = useRouter();

  useEffect(() => {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) { router.push('/'); return; }
    loadOrders(url, token);
  }, []);

  async function loadOrders(url, token) {
    setLoading(true);
    try {
      const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: `SELECT o.OrderId, o.OrderDate, o.Status, o.OrderType, c.Name as CustomerName,
          IFNULL((SELECT SUM(RowTotal) FROM OrderItems WHERE OrderId=o.OrderId),0) as Total
          FROM Orders o LEFT JOIN Customers c ON c.CustomerId=o.CustomerId ORDER BY o.OrderId DESC` }) });
      const data = await res.json();
      setOrders(data.rows || []);
    } catch { }
    setLoading(false);
  }

  async function handleDelete(o) {
    if (!confirm(`حذف الطلب #${o.OrderId}؟`)) return;
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql: 'DELETE FROM OrderItems WHERE OrderId=?', args: [o.OrderId] }) });
    await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql: 'DELETE FROM Orders WHERE OrderId=?', args: [o.OrderId] }) });
    await loadOrders(url, token);
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function statusColor(s) {
    switch (s) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Done': case 'Levererad': return 'bg-green-100 text-green-700';
      case 'Skickad': return 'bg-blue-100 text-blue-700';
      case 'Credit': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  const statuses = ['', 'Pending', 'Done', 'Levererad', 'Skickad'];

  const filtered = orders
    .filter(o => (o.CustomerName?.toLowerCase().includes(search.toLowerCase()) || String(o.OrderId).includes(search)) && (statusFilter === '' || o.Status === statusFilter))
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const thClass = "px-4 py-3 cursor-pointer select-none hover:bg-[#3d5268] transition text-left whitespace-nowrap";

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">Sparade order</h1>
        </div>
        <button onClick={() => router.push('/order')} className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition">+ ny order</button>
      </div>

<div className="mx-auto p-4 space-y-4">
        <div className="flex gap-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالعميل أو رقم الطلب..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]">
            {statuses.map(s => <option key={s} value={s}>{s || 'كل الحالات'}</option>)}
          </select>
        </div>

        {loading ? <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div> : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
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
                  {filtered.map((o, i) => (
                    <tr key={o.OrderId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-mono text-gray-500">#{o.OrderId}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{o.CustomerName}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{o.OrderDate?.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(o.Status)}`}>{o.Status}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{Number(o.Total).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button onClick={() => router.push(`/order?id=${o.OrderId}`)} className="text-blue-500 hover:text-blue-700 mr-3 text-xs font-medium">فتح</button>
                        <button onClick={() => handleDelete(o)} className="text-red-500 hover:text-red-700 text-xs font-medium">حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t">{filtered.length} order</div>
          </div>
        )}
      </div>
    </div>
  );
}