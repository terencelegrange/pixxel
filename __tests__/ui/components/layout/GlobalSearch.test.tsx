import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
jest.mock('@/context/FeatureTierContext', () => ({
  useFeatureTier: () => ({ hasFeature: () => true }),
}))

import { GlobalSearch } from '@/components/layout/GlobalSearch'

describe('GlobalSearch', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows no results initially', () => {
    render(<GlobalSearch />)
    expect(screen.queryByText(/no pages or settings match/i)).not.toBeInTheDocument()
  })

  it('filters results by label as the user types', async () => {
    const user = userEvent.setup()
    render(<GlobalSearch />)
    await user.type(screen.getByPlaceholderText(/search pages and settings/i), 'API Keys')
    expect(await screen.findByText('API Keys')).toBeInTheDocument()
  })

  it('also matches on description text', async () => {
    const user = userEvent.setup()
    render(<GlobalSearch />)
    await user.type(screen.getByPlaceholderText(/search pages and settings/i), '2FA')
    expect(await screen.findByText('Security')).toBeInTheDocument()
  })

  it('shows an empty state for a query that matches nothing', async () => {
    const user = userEvent.setup()
    render(<GlobalSearch />)
    await user.type(screen.getByPlaceholderText(/search pages and settings/i), 'zzz-no-such-page')
    expect(await screen.findByText(/no pages or settings match/i)).toBeInTheDocument()
  })

  it('navigates and clears the query on click', async () => {
    const user = userEvent.setup()
    render(<GlobalSearch />)
    const input = screen.getByPlaceholderText(/search pages and settings/i)
    await user.type(input, 'API Keys')
    await user.click(await screen.findByText('API Keys'))
    expect(push).toHaveBeenCalledWith('/settings/api-keys')
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('navigates to the top match via Enter alone (it starts highlighted)', async () => {
    const user = userEvent.setup()
    render(<GlobalSearch />)
    const input = screen.getByPlaceholderText(/search pages and settings/i)
    await user.type(input, 'Roles')
    await screen.findByText('Roles')
    await user.keyboard('{Enter}')
    expect(push).toHaveBeenCalledWith('/settings/roles')
  })

  it('moves the highlight with ArrowDown/ArrowUp before selecting', async () => {
    const user = userEvent.setup()
    render(<GlobalSearch />)
    const input = screen.getByPlaceholderText(/search pages and settings/i)
    await user.type(input, 'Roles')
    await screen.findByText('Roles')
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}')
    expect(push).toHaveBeenCalledWith('/settings/roles')
  })

  it('closes the dropdown on Escape', async () => {
    const user = userEvent.setup()
    render(<GlobalSearch />)
    const input = screen.getByPlaceholderText(/search pages and settings/i)
    await user.type(input, 'API Keys')
    await screen.findByText('API Keys')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('API Keys')).not.toBeInTheDocument())
  })
})
