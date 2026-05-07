'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import crypto from 'crypto';

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-bold flex items-center gap-3
      ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      <span>{type === 'error' ? '✕' : '✓'}</span>{message}
    </div>
  );
}

function hashPin(pin) {
  // SHA-256 مثل البرنامج
  const msgBuffer = new TextEncoder().encode(pin);
  return crypto.subtle.digest('SHA-256', msgBuffer).then(hashBuffer => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  });
}

const ROLES = ['Admin', 'Lager', 'Forsaljning'];
const ROLE_LABELS = {
  Admin: 'Admin — كامل الصلاحيات',
  Lager: 'Lager — مخزون + مشتريات',
  Forsaljning: 'Försäljning — طلبيات + عملاء',
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ Name: '', Pin: '', Role: 'Lager', IsActive: true });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const router = useRouter();

  function showToast(msg, type = 'success') { setToast({ msg, type }); }

  useEffect(() => {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    if (!url || !token) { router.push('/'); return; }

    const u = sessionStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      // Admin فقط
      if (parsed.Role !== 'Admin') { router.push('/dashboard'); return; }
      setCurrentUserId(parsed.UserId);
    }
    setReady(true);
    loadUsers(url, token);
  }, []);

  async function q(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    const res = await fetch('/api/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql, args })
    });
    const data = await res.json();
    return data.rows || [];
  }

  async function exe(sql, args = []) {
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    await fetch('/api/execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql, args })
    });
  }

  async function loadUsers(url, token) {
    setLoading(true);
    try {
      const rows = await q('SELECT UserId, Name, Role, IsActive FROM Users ORDER BY Name');
      setUsers(rows);
    } catch { }
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ Name: '', Pin: '', Role: 'Lager', IsActive: true });
    setShowModal(true);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({ Name: u.Name || '', Pin: '', Role: u.Role || 'Lager', IsActive: Number(u.IsActive) === 1 });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.Name.trim()) { showToast('أدخل الاسم', 'error'); return; }
    if (!editing && !form.Pin) { showToast('PIN مطلوب للمستخدم الجديد', 'error'); return; }
    if (form.Pin && (form.Pin.length < 4 || form.Pin.length > 6 || !/^\d+$/.test(form.Pin))) {
      showToast('PIN يجب أن يكون 4-6 أرقام', 'error'); return;
    }

    setSaving(true);
    try {
      const active = form.IsActive ? 1 : 0;

      if (!editing) {
        // تحقق من تكرار الاسم
        const exists = await q('SELECT COUNT(*) as c FROM Users WHERE Name=?', [form.Name.trim()]);
        if (Number(exists[0]?.c) > 0) { showToast('الاسم موجود مسبقاً', 'error'); setSaving(false); return; }

        const pinHash = await hashPin(form.Pin);
        await exe('INSERT INTO Users (Name, Pin, Role, IsActive) VALUES (?,?,?,?)',
          [form.Name.trim(), pinHash, form.Role, active]);
        showToast('تم إضافة المستخدم ✔');
      } else {
        if (form.Pin) {
          const pinHash = await hashPin(form.Pin);
          await exe('UPDATE Users SET Name=?, Pin=?, Role=?, IsActive=? WHERE UserId=?',
            [form.Name.trim(), pinHash, form.Role, active, editing.UserId]);
        } else {
          await exe('UPDATE Users SET Name=?, Role=?, IsActive=? WHERE UserId=?',
            [form.Name.trim(), form.Role, active, editing.UserId]);
        }
        showToast('تم التحديث ✔');
      }

      setShowModal(false);
      const url = sessionStorage.getItem('turso_url');
      const token = sessionStorage.getItem('turso_token');
      await loadUsers(url, token);
    } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
    setSaving(false);
  }

  async function handleDelete(u) {
    if (Number(u.UserId) === currentUserId) { showToast('لا تقدر تحذف حسابك الحالي', 'error'); return; }
    if (!confirm(`حذف "${u.Name}"؟`)) return;
    await exe('DELETE FROM Users WHERE UserId=?', [u.UserId]);
    setUsers(prev => prev.filter(x => x.UserId !== u.UserId));
    showToast('تم الحذف');
  }

  async function toggleActive(u) {
    if (Number(u.UserId) === currentUserId) { showToast('لا تقدر تعطل حسابك الحالي', 'error'); return; }
    const newVal = Number(u.IsActive) === 1 ? 0 : 1;
    await exe('UPDATE Users SET IsActive=? WHERE UserId=?', [newVal, u.UserId]);
    setUsers(prev => prev.map(x => x.UserId === u.UserId ? { ...x, IsActive: newVal } : x));
    showToast(newVal === 1 ? 'تم تفعيل المستخدم' : 'تم تعطيل المستخدم');
  }

  const roleColor = {
    Admin: 'bg-purple-100 text-purple-700',
    Lager: 'bg-blue-100 text-blue-700',
    Forsaljning: 'bg-green-100 text-green-700',
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">Användare & Behörighet</h1>
        </div>
        <button onClick={openNew}
          className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition font-bold">
          + ny användare
        </button>
      </div>

      {/* تنبيه */}
      <div className="bg-[#1a2a3a] text-gray-300 px-6 py-2 text-xs flex items-center gap-2">
        <span>🔒</span>
        <span>PINs مشفّرة بـ SHA-256 — لا تُخزَّن كنص عادي</span>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-10 text-gray-400">جارٍ التحميل...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#2D3E50] text-white">
                <tr>
                  <th className="px-5 py-3 text-left">الاسم</th>
                  <th className="px-5 py-3 text-left">الدور</th>
                  <th className="px-5 py-3 text-center">الحالة</th>
                  <th className="px-5 py-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">لا يوجد مستخدمون</td></tr>
                ) : users.map((u, i) => (
                  <tr key={u.UserId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-5 py-3 font-medium">
                      {u.Name}
                      {Number(u.UserId) === currentUserId && (
                        <span className="mr-2 text-xs text-gray-400">(أنت)</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${roleColor[u.Role] || 'bg-gray-100 text-gray-600'}`}>
                        {u.Role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => toggleActive(u)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                          Number(u.IsActive) === 1
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}>
                        {Number(u.IsActive) === 1 ? '✓ Aktiv' : '✗ Inaktiv'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      <button onClick={() => openEdit(u)}
                        className="text-blue-500 hover:text-blue-700 text-xs font-medium mr-3">
                        تعديل
                      </button>
                      {Number(u.UserId) !== currentUserId && (
                        <button onClick={() => handleDelete(u)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium">
                          حذف
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-gray-50 text-sm text-gray-500 border-t">
              {users.length} användare — {users.filter(u => Number(u.IsActive) === 1).length} aktiva
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="bg-[#2D3E50] text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="font-bold">{editing ? `تعديل: ${editing.Name}` : 'مستخدم جديد'}</h2>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">

              {/* الاسم */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Namn *</label>
                <input type="text" value={form.Name} onChange={e => setForm({...form, Name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
              </div>

              {/* PIN */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  PIN {editing ? '(اتركه فارغاً للإبقاء على القديم)' : '*'}
                </label>
                <input type="password" value={form.Pin} onChange={e => setForm({...form, Pin: e.target.value})}
                  maxLength={6} placeholder={editing ? '••••' : '4-6 أرقام'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
              </div>

              {/* الدور */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Roll</label>
                <div className="space-y-2">
                  {ROLES.map(role => (
                    <label key={role} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      form.Role === role ? 'border-[#2D3E50] bg-[#2D3E50]/5' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input type="radio" name="role" value={role} checked={form.Role === role}
                        onChange={() => setForm({...form, Role: role})} className="accent-[#2D3E50]" />
                      <div>
                        <div className="text-sm font-semibold">{role}</div>
                        <div className="text-xs text-gray-500">{ROLE_LABELS[role]}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* الحالة */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.IsActive} onChange={e => setForm({...form, IsActive: e.target.checked})}
                  className="w-4 h-4 accent-[#2D3E50]" />
                <span className="text-sm font-medium text-gray-700">Aktiv</span>
              </label>

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