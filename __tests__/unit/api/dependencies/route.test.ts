import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}));
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }));

import { getDb } from '@/lib/db';
import { GET, POST } from '@/app/api/dependencies/route';

const mockExecute = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (getDb as jest.Mock).mockReturnValue({ execute: mockExecute });
});

function makePostReq(body: object) {
  return new NextRequest('http://localhost/api/dependencies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  sourceAssetId: 'asset-1',
  targetAssetId: 'asset-2',
  type: 'API',
  direction: 'outbound',
  userId: 'u1',
  userName: 'Admin',
};

const mockRow = {
  id: 'd1', type: 'API', direction: 'outbound', notes: null,
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
  source_asset_id: 'asset-1', source_asset_name: 'App A',
  source_asset_icon: 'Server', source_asset_domain: 'Infra',
  target_asset_id: 'asset-2', target_asset_name: 'App B',
  target_asset_icon: 'Database', target_asset_domain: 'Data',
};

describe('GET /api/dependencies', () => {
  it('returns mapped dependencies', async () => {
    mockExecute.mockResolvedValueOnce([[mockRow]]);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dependencies).toHaveLength(1);
    expect(data.dependencies[0]).toMatchObject({
      id: 'd1',
      sourceAssetId: 'asset-1',
      sourceAssetName: 'App A',
      targetAssetId: 'asset-2',
      targetAssetName: 'App B',
      type: 'API',
      direction: 'outbound',
    });
  });
});

describe('POST /api/dependencies', () => {
  it('returns 400 when sourceAssetId missing', async () => {
    const res = await POST(makePostReq({ ...validBody, sourceAssetId: undefined }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when targetAssetId missing', async () => {
    const res = await POST(makePostReq({ ...validBody, targetAssetId: undefined }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on self-reference', async () => {
    const res = await POST(makePostReq({ ...validBody, targetAssetId: 'asset-1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/itself/);
  });

  it('returns 400 on invalid type', async () => {
    const res = await POST(makePostReq({ ...validBody, type: 'Fax' }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when userId missing', async () => {
    const res = await POST(makePostReq({ ...validBody, userId: undefined }));
    expect(res.status).toBe(401);
  });

  it('returns 409 on reverse pair', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'existing-reverse' }]]);
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/reverse/);
  });

  it('returns 409 on duplicate pair (DB constraint)', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // no reverse pair
    const dbErr = Object.assign(new Error('Duplicate entry'), { errno: 1062 });
    mockExecute.mockRejectedValueOnce(dbErr);
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(409);
  });

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // no reverse pair
    mockExecute.mockResolvedValueOnce([{}]); // INSERT succeeds
    const res = await POST(makePostReq(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(typeof data.id).toBe('string');
  });
});
