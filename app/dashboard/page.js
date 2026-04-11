'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [warehouseName, setWarehouseName] = useState('Lager Pro');
  const [stats, setStats] = useState({ orders: 0, customers: 0, products: 0 });
  const router = useRouter();

  useEffect(() => {
    const u = sessionStorage.getItem('user');
    const url = sessionStorage.getItem('turso_url');
    const token = sessionStorage.getItem('turso_token');
    const wname = sessionStorage.getItem('warehouse_name');

    if (!u || !url || !token) { router.push('/'); return; }

    setUser(JSON.parse(u));
    if (wname) setWarehouseName(wname);
    loadStats(url, token);
  }, []);

  async function query(url, token, sql) {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql })
    });
    const data = await res.json();
    return data.rows || [];
  }

  async function loadStats(url, token) {
    try {
      const [orders, customers, products] = await Promise.all([
        query(url, token, "SELECT COUNT(*) as c FROM Orders WHERE Status='Pending'"),
        query(url, token, 'SELECT COUNT(*) as c FROM Customers'),
        query(url, token, 'SELECT COUNT(*) as c FROM Products'),
      ]);
      setStats({
        orders: orders[0]?.c || 0,
        customers: customers[0]?.c || 0,
        products: products[0]?.c || 0,
      });
    } catch { }
  }

  function logout() {
    sessionStorage.clear();
    router.push('/');
  }

  const navItems = [
    { label: 'Artiklar', icon: '📦', href: '/artiklar' },
    { label: 'Skapa order', icon: '➕', href: '/order' },
    { label: 'Sparade order', icon: '📋', href: '/orders' },
    { label: 'Kunder', icon: '👥', href: '/kunder' },
    { label: 'Lager', icon: '🏭', href: '/lager' },
    { label: 'Inköp', icon: '🛒', href: '/inkop' },
    { label: 'Redovisning', icon: '📊', href: '/redovisning' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Navbar */}
      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{warehouseName}</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-300 text-sm">{user?.Name}</span>
          <button onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition">
            خروج
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Stats — قابلة للنقر */}
        <div className="grid grid-cols-3 gap-4">
          <button onClick={() => router.push('/orders')}
            className="bg-white rounded-xl p-5 shadow-sm text-center hover:shadow-md hover:bg-[#2D3E50] hover:text-white transition group">
            <p className="text-3xl font-bold text-[#2D3E50] group-hover:text-white">{stats.orders}</p>
            <p className="text-gray-500 text-sm mt-1 group-hover:text-gray-200">طلبات Pending</p>
          </button>
          <button onClick={() => router.push('/kunder')}
            className="bg-white rounded-xl p-5 shadow-sm text-center hover:shadow-md hover:bg-[#2D3E50] hover:text-white transition group">
            <p className="text-3xl font-bold text-[#2D3E50] group-hover:text-white">{stats.customers}</p>
            <p className="text-gray-500 text-sm mt-1 group-hover:text-gray-200">عملاء</p>
          </button>
          <button onClick={() => router.push('/artiklar')}
            className="bg-white rounded-xl p-5 shadow-sm text-center hover:shadow-md hover:bg-[#2D3E50] hover:text-white transition group">
            <p className="text-3xl font-bold text-[#2D3E50] group-hover:text-white">{stats.products}</p>
            <p className="text-gray-500 text-sm mt-1 group-hover:text-gray-200">منتجات</p>
          </button>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {navItems.map(item => (
            <button key={item.href} onClick={() => router.push(item.href)}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:bg-[#2D3E50] hover:text-white transition group text-center">
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="text-sm font-semibold">{item.label}</div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}