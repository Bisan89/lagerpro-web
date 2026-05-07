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
    case 'Pending': return 'bg-yellow-100 text-yellow-700';
    case 'Done': case 'Levererad': return 'bg-green-100 text-green-700';
    case 'Skickad': return 'bg-blue-100 text-blue-700';
    case 'Edited': return 'bg-gray-100 text-gray-700';
    case 'Credit': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export default function Kunder() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ Name: '', Company: '', Phone: '', Email: '', Address: '' });
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState('Name');
  const [sortDir, setSortDir] = useState('asc');
  const [toast, setToast] = useState(null);

  // كشف حساب
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

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
      if (!allowed.includes('kunder')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    loadCustomers(url, token);
  }, []);

  async function execute(sql, args = []) {
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
      if (!allowed.includes('kunder')) { router.push('/dashboard'); return; }
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
      if (!allowed.includes('kunder')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql, args }) });
    const data = await res.json();
    return data.rows || [];
  }

  async function loadCustomers(url, token) {
    setLoading(true);
    try {
      const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, sql: 'SELECT CustomerId, Name, Company, Phone, Email, Address FROM Customers ORDER BY Name' }) });
      const data = await res.json();
      setCustomers(data.rows || []);
    } catch { }
    setLoading(false);
  }

  async function selectCustomer(c) {
    setSelectedCustomer(c);
    setLoadingOrders(true);
    try {
      const rows = await q(`
        SELECT o.OrderId, o.OrderDate, o.Status,
               IFNULL(SUM(oi.RowTotal), 0) AS Total
        FROM Orders o
        LEFT JOIN OrderItems oi ON oi.OrderId = o.OrderId
        WHERE o.CustomerId = ? AND o.OrderType = 'Normal'
        GROUP BY o.OrderId
        ORDER BY o.OrderId DESC`, [c.CustomerId]);
      setCustomerOrders(rows);
    } catch { }
    setLoadingOrders(false);
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
    setForm({ Name: '', Company: '', Phone: '', Email: '', Address: '' });
    setShowModal(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({ Name: c.Name || '', Company: c.Company || '', Phone: c.Phone || '', Email: c.Email || '', Address: c.Address || '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.Name) { showToast('أدخل اسم العميل', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        await execute('UPDATE Customers SET Name=?, Company=?, Phone=?, Email=?, Address=? WHERE CustomerId=?',
          [form.Name, form.Company, form.Phone, form.Email, form.Address, editing.CustomerId]);
        if (selectedCustomer?.CustomerId === editing.CustomerId)
          setSelectedCustomer({ ...editing, ...form });
      } else {
        await execute('INSERT INTO Customers (Name, Company, Phone, Email, Address) VALUES (?,?,?,?,?)',
          [form.Name, form.Company, form.Phone, form.Email, form.Address]);
      }
      setShowModal(false);
      const url = sessionStorage.getItem('turso_url');
      const token = sessionStorage.getItem('turso_token');
      await loadCustomers(url, token);
      showToast(editing ? 'تم التحديث' : 'تم الإضافة');
    } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
    setSaving(false);
  }

  async function handleDelete(c) {
    if (!confirm(`حذف "${c.Name}"؟`)) return;
    await execute('DELETE FROM Customers WHERE CustomerId=?', [c.CustomerId]);
    if (selectedCustomer?.CustomerId === c.CustomerId) setSelectedCustomer(null);
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
      if (!allowed.includes('kunder')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    await loadCustomers(url, token);
    showToast('تم الحذف');
  }

  const filtered = customers
    .filter(c =>
      c.Name?.toLowerCase().includes(search.toLowerCase()) ||
      c.Company?.toLowerCase().includes(search.toLowerCase()) ||
      c.Phone?.includes(search))
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const thClass = "px-4 py-3 cursor-pointer select-none hover:bg-[#3d5268] transition text-left whitespace-nowrap";
  const orderTotal = customerOrders.reduce((s, o) => s + Number(o.Total), 0);

  // عرض طلبيات العميل كصفحة كاملة
  if (selectedCustomer) {
    return (
      <div className="min-h-screen bg-gray-100">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedCustomer(null)} className="text-gray-300 hover:text-white font-bold text-lg">← رجوع</button>
            <div>
              <h1 className="text-xl font-bold">{selectedCustomer.Name}</h1>
              {selectedCustomer.Company && <p className="text-gray-300 text-xs">{selectedCustomer.Company}</p>}
            </div>
          </div>
          {selectedCustomer.Address && <span className="text-gray-300 text-sm hidden sm:block">{selectedCustomer.Address}</span>}
        </div>
        <div className="max-w-3xl mx-auto p-4 space-y-3">
          {selectedCustomer.Phone && <p className="text-sm text-gray-500">📞 {selectedCustomer.Phone}</p>}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#2D3E50] text-white px-4 py-3 flex justify-between items-center">
              <h3 className="font-bold text-sm">الطلبيات</h3>
              <span className="text-xs text-gray-300">{customerOrders.length} order</span>
            </div>
            {loadingOrders ? (
              <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
            ) : customerOrders.length === 0 ? (
              <div className="text-center py-10 text-gray-400">لا توجد طلبيات</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-600 font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-gray-600 font-semibold">Datum</th>
                        <th className="px-4 py-3 text-left text-gray-600 font-semibold">Status</th>
                        <th className="px-4 py-3 text-right text-gray-600 font-semibold">Totalt (kr)</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerOrders.map((o, i) => (
                        <tr key={o.OrderId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 font-mono text-gray-500">#{o.OrderId}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{o.OrderDate?.slice(0, 10)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(o.Status)}`}>{o.Status}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">{Number(o.Total).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => router.push(`/order?id=${o.OrderId}`)}
                              className="text-blue-500 hover:text-blue-700 text-xs font-medium">فتح</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 bg-gray-50 border-t flex justify-between items-center">
                  <span className="text-xs text-gray-500">{customerOrders.length} طلبية</span>
                  <span className="font-bold text-[#2D3E50]">{orderTotal.toFixed(2)} kr</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">Kunder</h1>
        </div>
        <button onClick={openNew} className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition font-bold">
          + ny kund
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الشركة أو الهاتف..."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />

        {loading ? <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div> : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead className="bg-[#2D3E50] text-white">
                  <tr>
                    <th className={thClass} onClick={() => handleSort('Name')}>Namn <SortIcon col="Name"/></th>
                    <th className={thClass} onClick={() => handleSort('Company')}>Företag <SortIcon col="Company"/></th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.CustomerId}
                      onClick={() => selectCustomer(c)}
                      className={`cursor-pointer transition ${i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}`}>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        <div>{c.Name}</div>
                        {c.Address && <div className="text-xs text-gray-400">{c.Address}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{c.Company}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(c)} className="text-blue-500 hover:text-blue-700 mr-3 text-xs font-medium">تعديل</button>
                        <button onClick={() => handleDelete(c)} className="text-red-500 hover:text-red-700 text-xs font-medium">حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t">{filtered.length} kund</div>
          </div>
        )}
      </div>



      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="bg-[#2D3E50] text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="font-bold">{editing ? 'تعديل عميل' : 'عميل جديد'}</h2>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Namn *', key: 'Name' },
                { label: 'Företag', key: 'Company' },
                { label: 'Telefon', key: 'Phone' },
                { label: 'Email', key: 'Email' },
                { label: 'Adress / Stad', key: 'Address' }
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                  <input type="text" value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 flex gap-3 pt-4 border-t">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-[#2D3E50] text-white py-2.5 rounded-lg font-bold text-sm hover:bg-[#3d5268] transition disabled:opacity-50">
                {saving ? '...' : 'حفظ'}
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