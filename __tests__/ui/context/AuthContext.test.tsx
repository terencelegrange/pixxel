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
}))

import { AuthProvider, useAuth } from '@/context/AuthContext'
import { getStoredUser, clearStoredUser } from '@/lib/auth'

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

describe('AuthContext', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rehydrates user from localStorage on mount', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Jane'))
    expect(screen.getByTestId('auth').textContent).toBe('yes')
  })

  it('user is null when localStorage is empty', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(null)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('none'))
    expect(screen.getByTestId('auth').textContent).toBe('no')
  })

  it('logout calls clearStoredUser and sets user to null', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(mockUser)
    const user = userEvent.setup()
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => screen.getByText('Logout'))
    await user.click(screen.getByRole('button', { name: 'Logout' }))
    expect(clearStoredUser).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('none'))
  })
})
