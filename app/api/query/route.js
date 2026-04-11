import { createClient } from '@libsql/client';

export async function POST(request) {
  try {
    const { url, token, sql, args } = await request.json();
    const client = createClient({ url, authToken: token });
    const result = await client.execute({ sql, args: args || [] });

    const rows = result.rows.map(row => {
      const obj = {};
      result.columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });

    return Response.json({ rows });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}