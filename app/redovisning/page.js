'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Redovisning() {
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview | expenses
  const [ready, setReady] = useState(false);
  const router = useRouter();


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
      if (!allowed.includes('redovisning')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    loadData();
  }, []);

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
      if (!allowed.includes('redovisning')) { router.push('/dashboard'); return; }
    }
    setReady(true);
    const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, sql, args }) });
    const data = await res.json();
    return data.rows || [];
  }

  async function loadData() {
    setLoading(true);
    try {
      const [revenue, purchaseExp, extraExp, topP, topC, mon, exp] = await Promise.all([
        // إيرادات المبيعات
        q(`SELECT IFNULL(SUM(oi.RowTotal),0) as total
           FROM OrderItems oi JOIN Orders o ON o.OrderId=oi.OrderId
           WHERE o.Status IN ('Done','Edited','Levererad','Skickad')
           AND o.OrderType='Normal'
           AND date(o.OrderDate) BETWEEN date(?) AND date(?)`, [fromDate, toDate]),

        // مصاريف الشراء
        q(`SELECT IFNULL(SUM(GrandTotal),0) as total FROM PurchaseInvoices
           WHERE date(InvoiceDate) BETWEEN date(?) AND date(?)`, [fromDate, toDate]),

        // مصاريف إضافية (Expenses)
        q(`SELECT IFNULL(SUM(Amount),0) as total FROM Expenses
           WHERE date(ExpenseDate) BETWEEN date(?) AND date(?)`, [fromDate, toDate]),

        // أفضل المنتجات
        q(`SELECT oi.NameSE, SUM(oi.Boxes) as TotalBoxes, SUM(oi.RowTotal) as TotalRevenue
           FROM OrderItems oi JOIN Orders o ON o.OrderId=oi.OrderId
           WHERE o.Status IN ('Done','Edited','Levererad','Skickad')
           AND date(o.OrderDate) BETWEEN date(?) AND date(?)
           GROUP BY oi.ProductCode ORDER BY TotalRevenue DESC LIMIT 10`, [fromDate, toDate]),

        // أفضل العملاء
        q(`SELECT c.Name, COUNT(DISTINCT o.OrderId) as Orders, SUM(oi.RowTotal) as TotalRevenue
           FROM Orders o JOIN OrderItems oi ON oi.OrderId=o.OrderId
           JOIN Customers c ON c.CustomerId=o.CustomerId
           WHERE o.Status IN ('Done','Edited','Levererad','Skickad')
           AND date(o.OrderDate) BETWEEN date(?) AND date(?)
           GROUP BY o.CustomerId ORDER BY TotalRevenue DESC LIMIT 5`, [fromDate, toDate]),

        // مبيعات شهرية
        q(`SELECT strftime('%Y-%m', o.OrderDate) as Month, SUM(oi.RowTotal) as Revenue
           FROM Orders o JOIN OrderItems oi ON oi.OrderId=o.OrderId
           WHERE o.Status IN ('Done','Edited','Levererad','Skickad') AND o.OrderType='Normal'
           GROUP BY Month ORDER BY Month DESC LIMIT 12`),

        // قائمة المصاريف
        q(`SELECT ExpenseDate, Amount, Note, CreatedBy FROM Expenses
           WHERE date(ExpenseDate) BETWEEN date(?) AND date(?)
           ORDER BY ExpenseDate DESC`, [fromDate, toDate]),
      ]);

      const inc = Number(revenue[0]?.total || 0);
      const purchExp = Number(purchaseExp[0]?.total || 0);
      const extExp = Number(extraExp[0]?.total || 0);
      const totalExp = purchExp + extExp;

      setStats({
        income: inc,
        purchaseExpense: purchExp,
        extraExpense: extExp,
        totalExpense: totalExp,
        profit: inc - totalExp,
        margin: inc > 0 ? ((inc - totalExp) / inc * 100) : 0
      });
      setTopProducts(topP);
      setTopCustomers(topC);
      setMonthly([...mon].reverse());
      setExpenses(exp);
    } catch { }
    setLoading(false);
  }

  const maxRevenue = Math.max(...monthly.map(m => Number(m.Revenue)), 1);


  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#2D3E50] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-white">← رجوع</button>
          <h1 className="text-xl font-bold">Redovisning</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* فلتر التاريخ */}
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">من</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">إلى</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E50]" />
          </div>
          <button onClick={loadData} disabled={loading}
            className="bg-[#2D3E50] text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-[#3d5268] transition disabled:opacity-50">
            {loading ? 'جارٍ...' : 'تطبيق'}
          </button>
          {/* أزرار سريعة */}
          <div className="flex gap-2 mr-auto">
            {[
              { label: 'هذا الشهر', from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) },
              { label: 'الشهر الماضي', from: new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toISOString().slice(0,10), to: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0,10) },
              { label: 'هذه السنة', from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) },
            ].map(btn => (
              <button key={btn.label} onClick={() => { setFromDate(btn.from); setToDate(btn.to); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600 transition">
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* إحصائيات */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5 text-center border-t-4 border-green-400">
              <p className="text-2xl font-bold text-green-600">{stats.income.toFixed(0)}</p>
              <p className="text-gray-500 text-sm mt-1">إيرادات (kr)</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 text-center border-t-4 border-red-400">
              <p className="text-2xl font-bold text-red-500">{stats.totalExpense.toFixed(0)}</p>
              <p className="text-gray-500 text-xs mt-1">مصاريف كاملة (kr)</p>
              <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                <div>شراء: {stats.purchaseExpense.toFixed(0)}</div>
                <div>إضافية: {stats.extraExpense.toFixed(0)}</div>
              </div>
            </div>
            <div className={`bg-white rounded-xl shadow-sm p-5 text-center border-t-4 ${stats.profit >= 0 ? 'border-blue-400' : 'border-orange-400'} col-span-2 md:col-span-1`}>
              <p className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                {stats.profit.toFixed(0)}
              </p>
              <p className="text-gray-500 text-sm mt-1">ربح (kr)</p>
              <p className={`text-xs mt-1 font-bold ${stats.profit >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                هامش {stats.margin.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1.5">
          {[
            { key: 'overview', label: 'نظرة عامة' },
            { key: 'expenses', label: `المصاريف الإضافية (${expenses.length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition
                ${activeTab === tab.key ? 'bg-[#2D3E50] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && <>
          {/* رسم بياني */}
          {monthly.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-bold text-gray-700 mb-4">مبيعات شهرية</h2>
              <div className="flex items-end gap-2 h-40">
                {monthly.map((m, i) => {
                  const h = Math.round((Number(m.Revenue) / maxRevenue) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{Number(m.Revenue).toFixed(0)}</span>
                      <div className="w-full bg-[#2D3E50] rounded-t transition-all" style={{ height: `${h}%`, minHeight: '4px' }}></div>
                      <span className="text-xs text-gray-400">{m.Month?.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* أفضل المنتجات */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-[#2D3E50] text-white px-4 py-3">
                <h2 className="font-bold text-sm">أفضل المنتجات مبيعاً</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600">منتج</th>
                    <th className="px-4 py-2 text-center text-gray-600">كراتين</th>
                    <th className="px-4 py-2 text-right text-gray-600">إيراد</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-xs">لا توجد بيانات</td></tr>
                  ) : topProducts.map((p, i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-xs">{p.NameSE}</td>
                      <td className="px-4 py-2 text-center">{p.TotalBoxes}</td>
                      <td className="px-4 py-2 text-right font-medium">{Number(p.TotalRevenue).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* أفضل العملاء */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-[#2D3E50] text-white px-4 py-3">
                <h2 className="font-bold text-sm">أفضل العملاء</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600">عميل</th>
                    <th className="px-4 py-2 text-center text-gray-600">طلبات</th>
                    <th className="px-4 py-2 text-right text-gray-600">إيراد</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-xs">لا توجد بيانات</td></tr>
                  ) : topCustomers.map((c, i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="px-4 py-2 font-medium">{c.Name}</td>
                      <td className="px-4 py-2 text-center">{c.Orders}</td>
                      <td className="px-4 py-2 text-right font-medium">{Number(c.TotalRevenue).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>}

        {activeTab === 'expenses' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#2D3E50] text-white px-4 py-3 flex justify-between items-center">
              <h2 className="font-bold text-sm">المصاريف الإضافية</h2>
              <span className="text-xs text-gray-300">
                إجمالي: {expenses.reduce((s, e) => s + Number(e.Amount), 0).toFixed(0)} kr
              </span>
            </div>
            {expenses.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">لا توجد مصاريف في هذه الفترة</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600">التاريخ</th>
                    <th className="px-4 py-2 text-left text-gray-600">ملاحظة</th>
                    <th className="px-4 py-2 text-left text-gray-600">بواسطة</th>
                    <th className="px-4 py-2 text-right text-gray-600">المبلغ (kr)</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{e.ExpenseDate?.slice(0,10)}</td>
                      <td className="px-4 py-2.5 text-gray-700">{e.Note || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{e.CreatedBy}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-red-500">{Number(e.Amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2">
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-700">الإجمالي:</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      {expenses.reduce((s, e) => s + Number(e.Amount), 0).toFixed(2)} kr
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}