// __tests__/ui/components/auth/RegisterForm.test.tsx
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
import RegisterForm from '@/components/auth/RegisterForm'
import { registerUser } from '@/lib/auth'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('RegisterForm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows name error when name is empty', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Full name is required.')).toBeInTheDocument()
  })

  it('shows password length error when password is too short', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/full name/i), 'Jane')
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.type(screen.getByLabelText(/confirm password/i), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('shows confirm error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith')
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different1')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('calls registerUser with name, email, password on valid submit', async () => {
    const user = userEvent.setup()
    ;(registerUser as jest.Mock).mockResolvedValueOnce({
      id: 'u1', name: 'Jane Smith', email: 'jane@example.com',
      avatarInitials: 'JS', role: 'Member', createdAt: '',
    })
    render(<RegisterForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith')
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(registerUser).toHaveBeenCalledWith('Jane Smith', 'jane@example.com', 'password123'))
  })
})
