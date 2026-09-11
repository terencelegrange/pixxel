import { getEffectiveDeadline, getContractUrgency } from '@/lib/contracts'

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('getEffectiveDeadline', () => {
  it('returns null when endDate is null', () => {
    expect(getEffectiveDeadline({ endDate: null, noticePeriodDays: 30, autoRenews: true })).toBeNull()
  })

  it('returns endDate directly when autoRenews is false', () => {
    const endDate = daysFromNow(60)
    const result = getEffectiveDeadline({ endDate, noticePeriodDays: 30, autoRenews: false })
    expect(result?.toISOString().slice(0, 10)).toBe(endDate)
  })

  it('returns endDate directly when autoRenews is true but noticePeriodDays is null', () => {
    const endDate = daysFromNow(60)
    const result = getEffectiveDeadline({ endDate, noticePeriodDays: null, autoRenews: true })
    expect(result?.toISOString().slice(0, 10)).toBe(endDate)
  })

  it('subtracts noticePeriodDays from endDate when autoRenews is true', () => {
    const endDate = daysFromNow(60)
    const result = getEffectiveDeadline({ endDate, noticePeriodDays: 30, autoRenews: true })
    expect(result?.toISOString().slice(0, 10)).toBe(daysFromNow(30))
  })
})

describe('getContractUrgency', () => {
  it('returns "terminated" when status is Terminated, regardless of dates', () => {
    const urgency = getContractUrgency({
      status: 'Terminated', endDate: daysFromNow(-100), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('terminated')
  })

  it('returns "active" when endDate is null', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: null, noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('active')
  })

  it('returns "overdue" when the effective deadline is in the past', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(-5), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('overdue')
  })

  it('returns "critical" when the effective deadline is within 30 days', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(15), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('critical')
  })

  it('returns "warning" when the effective deadline is within 90 days but beyond 30', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(60), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('warning')
  })

  it('returns "active" when the effective deadline is beyond 90 days', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(200), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('active')
  })

  it('uses the notice-adjusted deadline for an auto-renewing contract, not the raw end date', () => {
    // endDate is 200 days out (would be "active" on its own), but notice
    // period pulls the effective deadline to 20 days out ("critical").
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(200), noticePeriodDays: 180, autoRenews: true,
    })
    expect(urgency).toBe('critical')
  })
})
