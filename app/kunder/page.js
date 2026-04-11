'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  useEffect(() => {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) { router.push('/'); return; }
    loadCustomers(url, token);
  }, []);

  async function execute(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token, sql, args }) });
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
    if (!form.Name) return alert('أدخل اسم العميل');
    setSaving(true);
    try {
      if (editing) {
        await execute('UPDATE Customers SET Name=?, Company=?, Phone=?, Email=?, Address=? WHERE CustomerId=?',
          [form.Name, form.Company, form.Phone, form.Email, form.Address, editing.CustomerId]);
      } else {
        await execute('INSERT INTO Customers (Name, Company, Phone, Email, Address) VALUES (?,?,?,?,?)',
          [form.Name, form.Company, form.Phone, form.Email, form.Address]);
      }
      setShowModal(false);
      const url = sessionStorage.getItem('turso_url');
      const token = sessionStorage.getItem('turso_token');
      await loadCustomers(url, token);
    } catch (e) { alert('خطأ: ' + e.message); }
    setSaving(false);
  }

  async function handleDelete(c) {
    if (!confirm(`حذف "${c.Name}"؟`)) return;
    await execute('DELETE FROM Customers WHERE CustomerId=?', [c.CustomerId]);
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    await loadCustomers(url, token);
  }

  const filtered = customers
    .filter(c => c.Name?.toLowerCase().includes(search.toLowerCase()) || c.Company?.toLowerCase().includes(search.toLowerCase()) || c.Phone?.includes(search))
    .sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const thClass = "px-4 py-3 cursor-pointer select-none hover:bg-[#3d5268] transition text-left whitespace-nowrap";

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">Kunder</h1>
        </div>
        <button onClick={openNew} className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition">+ ny kund</button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />

        {loading ? <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div> : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[550px]">
                <thead className="bg-[#2D3E50] text-white">
                  <tr>
                    <th className={thClass} onClick={() => handleSort('Name')}>Namn <SortIcon col="Name"/></th>
                    <th className={thClass} onClick={() => handleSort('Company')}>Företag <SortIcon col="Company"/></th>
                    <th className={thClass} onClick={() => handleSort('Phone')}>Telefon <SortIcon col="Phone"/></th>
                    <th className={thClass} onClick={() => handleSort('Email')}>Email <SortIcon col="Email"/></th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.CustomerId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{c.Name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.Company}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.Phone}</td>
                      <td className="px-4 py-3 text-gray-600">{c.Email}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="bg-[#2D3E50] text-white px-6 py-4 rounded-t-2xl">
              <h2 className="font-bold">{editing ? 'تعديل عميل' : 'عميل جديد'}</h2>
            </div>
            <div className="p-6 space-y-4">
              {[{ label: 'Namn', key: 'Name' }, { label: 'Företag', key: 'Company' }, { label: 'Telefon', key: 'Phone' }, { label: 'Email', key: 'Email' }, { label: 'Adress', key: 'Address' }].map(f => (
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