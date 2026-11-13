import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom implements neither layout scrolling nor matchMedia. The app guards
// both calls, but stubbing them keeps the console clean and makes behaviour
// deterministic across test files.
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true })
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Cookies are part of the auth contract, so each test starts with a clean jar.
function clearCookies() {
  for (const cookie of String(document.cookie || '').split('; ')) {
    const name = cookie.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  clearCookies()
})
