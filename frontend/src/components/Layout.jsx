import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { useModules } from '../hooks/useModules.js'
import { useTheme } from '../hooks/useTheme.jsx'
import { isAuthEnabled } from '../services/supabase.js'
import Button from './ui/Button.jsx'
import Icon from './Icons.jsx'

const NAV_GROUPS = [
  {
    label: 'Learn',
    items: [
      { to: '/', label: 'Home', end: true, icon: 'overview' },
      { to: '/labs', label: 'Labs', icon: 'labs' },
      { to: '/paths', label: 'Learning paths', icon: 'paths' },
      { to: '/progress', label: 'Progress', icon: 'progress' },
    ],
  },
  {
    label: 'Community',
    items: [{ to: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' }],
  },
  {
    label: 'Platform',
    items: [
      { to: '/about', label: 'About', icon: 'about' },
      { to: '/contribute', label: 'Contribute', icon: 'contribute' },
    ],
  },
]

const CRUMB_LABELS = {
  labs: 'Labs', paths: 'Learning paths', progress: 'Progress', leaderboard: 'Leaderboard',
  profile: 'Profile', admin: 'Admin console', about: 'About', contribute: 'Contribute',
}

const SIDEBAR_KEY = 'lll.sidebar'

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}

function Logo({ compact = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="logo grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent-line bg-accent-tint text-xs font-bold text-accent-text" aria-hidden>
        &gt;_
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">OWASP</span>
          <span className="block font-mono text-sm font-semibold text-fg">LLM Lab</span>
        </span>
      )}
      <span className="sr-only">OWASP LLM Lab home</span>
    </span>
  )
}

function useCrumbs(modules) {
  const { pathname } = useLocation()
  return useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    if (!segments.length) return [{ label: 'Home' }]
    if (segments[0] === 'labs' && segments[1]) {
      const lab = modules.find((module) => module.id === segments[1])
      return [{ label: 'Home', to: '/' }, { label: 'Labs', to: '/labs' }, { label: lab ? lab.name : 'Lab' }]
    }
    return [{ label: 'Home', to: '/' }, { label: CRUMB_LABELS[segments[0]] || 'Page' }]
  }, [pathname, modules])
}

function Breadcrumbs() {
  const { modules } = useModules()
  const crumbs = useCrumbs(modules)
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
      <ol className="flex min-w-0 items-center gap-1 text-xs">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <Icon name="chevronRight" size={13} className="shrink-0 text-fg-subtle" />}
              {last || !crumb.to ? (
                <span aria-current={last ? 'page' : undefined} className="truncate font-medium text-fg">{crumb.label}</span>
              ) : (
                <Link to={crumb.to} className="shrink-0 rounded text-fg-muted transition-colors hover:text-fg">{crumb.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      className={`grid h-8 w-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg ${className}`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
    </button>
  )
}

function AccountMenu({ name, admin, signOut }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full border border-accent-line bg-accent-tint text-xs font-semibold text-accent-text">
          {initials(name)}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm text-fg-muted md:inline">{name}</span>
        <Icon name="chevronDown" size={14} className="hidden text-fg-subtle md:block" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1.5 w-56 animate-pop-in rounded-lg border border-line-strong bg-surface p-1 shadow-drawer">
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-medium text-fg">{name || 'Signed in'}</p>
            <p className="text-xs text-fg-subtle">{admin ? 'Administrator' : 'Learner'}</p>
          </div>
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className="sidebar-link mt-1">
            <Icon name="user" size={16} /> Profile and settings
          </Link>
          {admin && (
            <Link role="menuitem" to="/admin" onClick={() => setOpen(false)} className="sidebar-link">
              <Icon name="admin" size={16} /> Admin console
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => { setOpen(false); signOut() }}
            className="sidebar-link w-full"
          >
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function SidebarContent({ nav, authed, admin, profile, session, onNavigate, signOut, collapsed, compact }) {
  const name = profile?.full_name || session?.user?.email || ''
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className={`flex h-14 shrink-0 items-center gap-2 border-b border-line ${collapsed && !compact ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <Link to="/" onClick={onNavigate} className="rounded"><Logo compact={collapsed && !compact} /></Link>
        {compact && (
          <button type="button" data-autofocus onClick={onNavigate} className="rounded-md p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Close navigation">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <nav aria-label="Main" className={`flex-1 overflow-y-auto py-3 ${collapsed && !compact ? 'px-1.5' : 'px-2.5'}`}>
        {nav.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {!(collapsed && !compact) && (
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed && !compact ? item.label : undefined}
                    aria-label={collapsed && !compact ? item.label : undefined}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''} ${collapsed && !compact ? 'justify-center px-0' : ''}`}
                  >
                    <Icon name={item.icon} size={17} className="shrink-0" />
                    {!(collapsed && !compact) && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-2.5">
        {authed ? (
          <>
            <Link
              to="/profile"
              onClick={onNavigate}
              title={collapsed && !compact ? name : undefined}
              className={`flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-surface-2 ${collapsed && !compact ? 'justify-center' : ''}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent-line bg-accent-tint text-xs font-semibold text-accent-text">
                {initials(name)}
              </span>
              {!(collapsed && !compact) && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{name}</span>
                  <span className="block text-xs text-fg-subtle">{admin ? 'Administrator' : 'Learner'}</span>
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={signOut}
              title={collapsed && !compact ? 'Sign out' : undefined}
              aria-label={collapsed && !compact ? 'Sign out' : undefined}
              className={`sidebar-link mt-0.5 w-full ${collapsed && !compact ? 'justify-center px-0' : ''}`}
            >
              <Icon name="logout" size={16} className="shrink-0" />
              {!(collapsed && !compact) && 'Sign out'}
            </button>
          </>
        ) : isAuthEnabled() ? (
          <div className={`space-y-2 ${collapsed && !compact ? 'px-0.5' : 'px-0.5'}`}>
            <Button as={Link} to="/signup" onClick={onNavigate} variant="primary" className="w-full">
              {collapsed && !compact ? '＋' : 'Create account'}
            </Button>
            {!(collapsed && !compact) && (
              <Button as={Link} to="/login" onClick={onNavigate} className="w-full">Sign in</Button>
            )}
          </div>
        ) : (
          !(collapsed && !compact) && (
            <div className="rounded-md border border-line bg-surface-2 p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-fg"><Icon name="info" size={13} /> Local training mode</p>
              <p className="mt-1 text-[11px] leading-4 text-fg-muted">Progress stays in this browser. Connect Supabase to add accounts.</p>
            </div>
          )
        )}
        {!(collapsed && !compact) && (
          <p className="mt-2 px-1 text-[10px] leading-4 text-fg-subtle">
            Deliberately vulnerable. Authorised use only.
          </p>
        )}
      </div>
    </div>
  )
}

export default function Layout() {
  const { session, profile, signOut } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'collapsed' } catch { return false }
  })
  const panelRef = useRef(null)
  const triggerRef = useRef(null)

  const authed = Boolean(isAuthEnabled() && session)
  const admin = Boolean(authed && profile?.role === 'admin')
  const name = profile?.full_name || session?.user?.email || ''

  const nav = useMemo(() => NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => (item.to === '/' ? { ...item, label: authed ? 'Dashboard' : 'Home' } : item)),
  })).concat(admin ? [{ label: 'Operations', items: [{ to: '/admin', label: 'Admin console', icon: 'admin' }] }] : []), [authed, admin])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded') } catch { /* private mode */ }
  }, [collapsed])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusable = () => Array.from(
      panelRef.current?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [],
    ).filter((element) => element.getClientRects().length > 0)

    const frame = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector('[data-autofocus]') || focusable()[0]
      target?.focus()
    })

    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) previous.focus()
      else triggerRef.current?.focus()
    }
  }, [open, close])

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-fg focus:shadow-card">
        Skip to content
      </a>

      <div className={`min-h-screen lg:grid ${collapsed ? 'lg:grid-cols-[64px_minmax(0,1fr)]' : 'lg:grid-cols-[248px_minmax(0,1fr)]'}`}>
        <aside className="sticky top-0 hidden h-screen border-r border-line lg:block">
          <SidebarContent
            nav={nav} authed={authed} admin={admin} profile={profile} session={session}
            signOut={signOut} collapsed={collapsed}
          />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
            <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6">
              <button
                ref={triggerRef}
                type="button"
                className="rounded-md p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden"
                aria-label={open ? 'Close navigation' : 'Open navigation'}
                aria-expanded={open}
                aria-controls="mobile-navigation"
                onClick={() => setOpen((value) => !value)}
              >
                <Icon name={open ? 'close' : 'menu'} size={20} />
              </button>

              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className="hidden rounded-md p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg lg:inline-flex"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-pressed={collapsed}
              >
                <Icon name="sidebar" size={18} />
              </button>

              <Link to="/" className="flex items-center gap-1.5 lg:hidden" aria-label="OWASP LLM Lab home">
                <span className="logo text-base font-bold text-accent-text">&gt;_</span>
                <span className="font-mono text-sm font-semibold text-fg">LLM Lab</span>
              </Link>

              <Breadcrumbs />

              <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
                <ThemeToggle />
                {authed ? (
                  <AccountMenu name={name} admin={admin} signOut={signOut} />
                ) : isAuthEnabled() ? (
                  <>
                    <Button as={Link} to="/login" size="sm" variant="ghost" className="sm:hidden">Sign in</Button>
                    <Button as={Link} to="/signup" size="sm" className="hidden sm:inline-flex">Create account</Button>
                    <Button as={Link} to="/login" size="sm" variant="primary" className="hidden sm:inline-flex">Sign in</Button>
                  </>
                ) : (
                  <span className="badge badge-neutral"><Icon name="lock" size={12} /> Local mode</span>
                )}
              </div>
            </div>
          </header>

          <main id="main" key={location.pathname} className="page-enter mx-auto w-full max-w-content flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </main>

          <footer className="mx-auto w-full max-w-content border-t border-line px-4 py-5 text-xs leading-5 text-fg-subtle sm:px-6">
            <p className="max-w-3xl">
              Deliberately vulnerable training application. Run it locally or on your own deployment, and never point
              these techniques at systems you do not own or have permission to test.
            </p>
            <p className="mt-1.5">Proposed by OWASP Siliguri and built by the community. Not an official OWASP project.</p>
          </footer>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close navigation"
            className="absolute inset-0 h-full w-full cursor-default bg-black/60"
            onClick={close}
          />
          <div
            ref={panelRef}
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[min(17rem,86vw)] animate-slide-in border-r border-line shadow-drawer"
          >
            <SidebarContent
              nav={nav} authed={authed} admin={admin} profile={profile} session={session}
              onNavigate={close} signOut={() => { close(); signOut() }} compact
            />
          </div>
        </div>
      )}
    </>
  )
}
