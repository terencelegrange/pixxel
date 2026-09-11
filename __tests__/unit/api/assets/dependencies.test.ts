import { NextRequest } from 'next/server';

jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))


jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}));

import { getDb } from '@/lib/db';
import { GET } from '@/app/api/assets/[id]/dependencies/route';

const mockExecute = jest.fn();
const params = { params: Promise.resolve({ id: 'asset-1' }) };

beforeEach(() => {
  jest.clearAllMocks();
  (getDb as jest.Mock).mockReturnValue({ execute: mockExecute });
});

const req = new NextRequest('http://localhost/api/assets/asset-1/dependencies');

const downstreamRow = {
  id: 'd1', type: 'API', direction: 'outbound', notes: null,
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
  source_asset_id: 'asset-1', source_asset_name: 'App A',
  source_asset_icon: 'Server', source_asset_domain: 'Infra',
  target_asset_id: 'asset-2', target_asset_name: 'App B',
  target_asset_icon: 'Database', target_asset_domain: 'Data',
};

const upstreamRow = {
  ...downstreamRow, id: 'd2', direction: 'outbound',
  source_asset_id: 'asset-3', source_asset_name: 'App C',
  source_asset_icon: null, source_asset_domain: null,
  target_asset_id: 'asset-1', target_asset_name: 'App A',
  target_asset_icon: 'Server', target_asset_domain: 'Infra',
};

describe('GET /api/assets/[id]/dependencies', () => {
  it('returns downstream array (source_asset_id = id)', async () => {
    mockExecute.mockResolvedValueOnce([[downstreamRow]]); // downstream
    mockExecute.mockResolvedValueOnce([[]]);              // upstream (none)
    const res = await GET(req, params);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.downstream).toHaveLength(1);
    expect(data.downstream[0].sourceAssetId).toBe('asset-1');
  });

  it('returns upstream array (target_asset_id = id)', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // downstream (none)
    mockExecute.mockResolvedValueOnce([[upstreamRow]]); // upstream
    const res = await GET(req, params);
    const data = await res.json();
    expect(data.upstream).toHaveLength(1);
    expect(data.upstream[0].targetAssetId).toBe('asset-1');
  });

  it('returns bidirectional in both arrays', async () => {
    const bidiDown = { ...downstreamRow, direction: 'bidirectional' };
    mockExecute.mockResolvedValueOnce([[bidiDown]]); // downstream (bidi)
    mockExecute.mockResolvedValueOnce([[]]);          // upstream (none)
    const res = await GET(req, params);
    const data = await res.json();
    expect(data.downstream).toHaveLength(1);
    // Bidirectional also appears in upstream (client-side dedup handled by consumer)
    expect(data.upstream).toHaveLength(1);
    expect(data.upstream[0].direction).toBe('bidirectional');
  });

  it('returns empty arrays when no dependencies', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // downstream
    mockExecute.mockResolvedValueOnce([[]]); // upstream
    const res = await GET(req, params);
    const data = await res.json();
    expect(data.downstream).toHaveLength(0);
    expect(data.upstream).toHaveLength(0);
  });
});
