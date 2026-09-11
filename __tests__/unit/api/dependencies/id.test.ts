import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}));
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db';
import { PUT, DELETE } from '@/app/api/dependencies/[id]/route';

const mockExecute = jest.fn();
const params = { params: Promise.resolve({ id: 'dep-1' }) };

beforeEach(() => {
  jest.clearAllMocks();
  (getDb as jest.Mock).mockReturnValue({ execute: mockExecute });
});

const makeReq = (method: string, body: object) =>
  new NextRequest('http://localhost/api/dependencies/dep-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const existingRow = {
  id: 'dep-1', type: 'API', direction: 'outbound', notes: null,
  source_asset_id: 'a1', target_asset_id: 'a2',
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date(), updated_at: new Date(),
};

describe('PUT /api/dependencies/[id]', () => {
  it('returns 404 when dependency not found', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // SELECT returns nothing
    const res = await PUT(
      makeReq('PUT', { type: 'API', direction: 'outbound', userId: 'u1', userName: 'Admin' }),
      params
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[existingRow]]); // SELECT found
    mockExecute.mockResolvedValueOnce([{}]);            // UPDATE
    const res = await PUT(
      makeReq('PUT', { type: 'Database', direction: 'bidirectional', notes: 'sync', userId: 'u1', userName: 'Admin' }),
      params
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

describe('DELETE /api/dependencies/[id]', () => {
  it('returns 404 when dependency not found', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // SELECT returns nothing
    const res = await DELETE(
      makeReq('DELETE', { userId: 'u1', userName: 'Admin' }),
      params
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[existingRow]]); // SELECT found
    mockExecute.mockResolvedValueOnce([{}]);            // DELETE
    const res = await DELETE(
      makeReq('DELETE', { userId: 'u1', userName: 'Admin' }),
      params
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
