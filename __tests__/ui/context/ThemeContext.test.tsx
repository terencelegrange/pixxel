// __tests__/ui/context/ThemeContext.test.tsx
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'

function TestConsumer() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('defaults to light theme', () => {
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('reads persisted dark theme from localStorage on mount', async () => {
    localStorage.setItem('theme', 'dark')
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    await act(async () => {})
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('toggleTheme switches light to dark and adds dark class to <html>', async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('toggleTheme switches dark to light and removes dark class', async () => {
    localStorage.setItem('theme', 'dark')
    const user = userEvent.setup()
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    await act(async () => {})
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')
  })
})
