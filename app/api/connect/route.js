export async function POST(request) {
  try {
    const { url, token } = await request.json();

    if (!url || !token) {
      return Response.json({ ok: false, error: 'Missing url or token' });
    }

    // اختبار الاتصال مباشرة بـ HTTP
    const body = JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql: "SELECT 1" } },
        { type: "close" }
      ]
    });

    const res = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body
    });

    if (res.ok) {
      return Response.json({ ok: true });
    } else {
      return Response.json({ ok: false, error: 'Connection failed' });
    }
  } catch (err) {
    return Response.json({ ok: false, error: err.message });
  }
}