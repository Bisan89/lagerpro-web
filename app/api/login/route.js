import { createClient } from '@libsql/client';
import crypto from 'crypto';

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

export async function POST(request) {
  try {
    const { url, token, userId, pin } = await request.json();
    const client = createClient({ url, authToken: token });

    const result = await client.execute({
      sql: 'SELECT UserId, Name, Role, Pin FROM Users WHERE UserId=? AND IsActive=1',
      args: [userId]
    });

    if (result.rows.length === 0)
      return Response.json({ ok: false, error: 'User not found' });

    const row = result.rows[0];
    const storedPin = row[3]; // Pin column
    const inputHash = hashPin(pin);

    if (inputHash !== storedPin)
      return Response.json({ ok: false, error: 'Wrong PIN' });

    return Response.json({
      ok: true,
      user: {
        UserId: row[0],
        Name: row[1],
        Role: row[2]
      }
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message });
  }
}