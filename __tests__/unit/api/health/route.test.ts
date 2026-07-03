import { GET } from '@/app/api/health/route'

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}))

import { getDb } from '@/lib/db'

const mockQuery = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ query: mockQuery })
})

describe('GET /api/health', () => {
  it('returns 200 ok when the database responds', async () => {
    mockQuery.mockResolvedValueOnce([[{ '1': 1 }]])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('returns 503 when the database is unreachable', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('error')
  })

  it('returns 503 when getDb throws (credentials not configured)', async () => {
    ;(getDb as jest.Mock).mockImplementationOnce(() => { throw new Error('Database credentials not configured.') })
    const res = await GET()
    expect(res.status).toBe(503)
  })
})
