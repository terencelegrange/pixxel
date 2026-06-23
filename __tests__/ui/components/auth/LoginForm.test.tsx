// __tests__/ui/components/auth/LoginForm.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: any) => <a href={href}>{children}</a> }))
jest.mock('@/lib/auth', () => ({
  getStoredUser: jest.fn().mockReturnValue(null),
  storeUser: jest.fn(),
  clearStoredUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn(),
}))

import { AuthProvider } from '@/context/AuthContext'
import LoginForm from '@/components/auth/LoginForm'
import { loginUser } from '@/lib/auth'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('LoginForm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows email error when submitted empty', async () => {
    const user = userEvent.setup()
    render(<LoginForm />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
  })

  it('shows password error when password is empty', async () => {
    const user = userEvent.setup()
    render(<LoginForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Password is required.')).toBeInTheDocument()
  })

  it('shows email format error for invalid email', async () => {
    const user = userEvent.setup()
    render(<LoginForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
  })

  it('calls loginUser with email and password on valid submit', async () => {
    const user = userEvent.setup()
    ;(loginUser as jest.Mock).mockResolvedValueOnce({
      id: 'u1', name: 'Jane', email: 'jane@example.com',
      avatarInitials: 'JA', role: 'Member', createdAt: '',
    })
    render(<LoginForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(loginUser).toHaveBeenCalledWith('jane@example.com', 'password1'))
  })

  it('shows general error when loginUser throws', async () => {
    const user = userEvent.setup()
    ;(loginUser as jest.Mock).mockRejectedValueOnce(new Error('Invalid email or password.'))
    render(<LoginForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
  })
})
