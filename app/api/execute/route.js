import { createClient } from '@libsql/client';

export async function POST(request) {
  try {
    const { url, token, sql, args } = await request.json();
    const client = createClient({ url, authToken: token });
    await client.execute({ sql, args: args || [] });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}