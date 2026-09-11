// __tests__/ui/context/AuthContext.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/auth', () => ({
  getStoredUser: jest.fn(),
  storeUser: jest.fn(),
  clearStoredUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn(),
  logoutUser: jest.fn(),
  fetchCurrentUser: jest.fn(),
}))

import { AuthProvider, useAuth } from '@/context/AuthContext'
import { getStoredUser, storeUser, clearStoredUser, fetchCurrentUser } from '@/lib/auth'

const mockUser = {
  id: 'u1', name: 'Jane', email: 'jane@example.com',
  avatarInitials: 'JA', role: 'Member', createdAt: '2025-01-01T00:00:00.000Z',
}

function TestConsumer() {
  const { user, isAuthenticated, logout } = useAuth()
  return (
    <div>
      <span data-testid="name">{user?.name ?? 'none'}</span>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(fetchCurrentUser as jest.Mock).mockResolvedValue(null)
})

describe('AuthContext', () => {
  it('rehydrates user from localStorage on mount, then confirms it against fetchCurrentUser', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(mockUser)
    ;(fetchCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Jane'))
    expect(screen.getByTestId('auth').textContent).toBe('yes')
    expect(fetchCurrentUser).toHaveBeenCalled()
  })

  it('user is null when localStorage is empty and there is no server session', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(null)
    ;(fetchCurrentUser as jest.Mock).mockResolvedValue(null)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('none'))
    expect(screen.getByTestId('auth').textContent).toBe('no')
  })

  it('clears a stale stored user when the server session is gone (revoked/expired)', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(mockUser)
    ;(fetchCurrentUser as jest.Mock).mockResolvedValue(null)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    // Optimistically shows the stored user first...
    expect(screen.getByTestId('name').textContent).toBe('Jane')
    // ...then clears it once fetchCurrentUser confirms the session is gone.
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('none'))
    expect(clearStoredUser).toHaveBeenCalled()
  })

  it('re-syncs localStorage with the fresh user if it changed server-side (e.g. a role change)', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(mockUser)
    const freshUser = { ...mockUser, role: 'Admin' }
    ;(fetchCurrentUser as jest.Mock).mockResolvedValue(freshUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(storeUser).toHaveBeenCalledWith(freshUser))
  })

  it('keeps the stored user on a network error rather than logging out over a transient blip', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(mockUser)
    ;(fetchCurrentUser as jest.Mock).mockResolvedValue('unknown')
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(fetchCurrentUser).toHaveBeenCalled())
    expect(screen.getByTestId('name').textContent).toBe('Jane')
    expect(screen.getByTestId('auth').textContent).toBe('yes')
    expect(clearStoredUser).not.toHaveBeenCalled()
  })

  it('logout calls clearStoredUser and sets user to null', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(mockUser)
    ;(fetchCurrentUser as jest.Mock).mockResolvedValue(mockUser)
    const user = userEvent.setup()
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => screen.getByText('Logout'))
    await user.click(screen.getByRole('button', { name: 'Logout' }))
    expect(clearStoredUser).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('none'))
  })
})
