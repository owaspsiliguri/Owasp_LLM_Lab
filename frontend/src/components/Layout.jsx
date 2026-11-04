import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { useModules } from '../hooks/useModules.js'
import { isAuthEnabled } from '../services/supabase.js'
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

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}

function Logo({ compact = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
        <Icon name="shield" size={19} />
      </span>
      <span className="leading-tight">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">OWASP</span>
        <span className="block text-sm font-semibold text-white">LLM Lab</span>
      </span>
      {!compact && <span className="sr-only">OWASP LLM Lab home</span>}
    </span>
  )
}

function useCrumbs(modules) {
  const { pathname } = useLocation()
  return useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    if (!segments.length) return [{ label: 'Home' }]
    const crumbs = [{ label: 'Home', to: '/' }]
    if (segments[0] === 'labs' && segments[1]) {
      const lab = modules.find((module) => module.id === segments[1])
      crumbs.push({ label: 'Labs', to: '/labs' })
      crumbs.push({ label: lab ? lab.name : 'Lab' })
      return crumbs
    }
    crumbs.push({ label: CRUMB_LABELS[segments[0]] || 'Page' })
    return crumbs
  }, [pathname, modules])
}

function Breadcrumbs() {
  const { modules } = useModules()
  const crumbs = useCrumbs(modules)
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <Icon name="chevronRight" size={14} className="shrink-0 text-slate-300" />}
              {last || !crumb.to ? (
                <span aria-current={last ? 'page' : undefined} className="truncate font-medium text-ink">{crumb.label}</span>
              ) : (
                <Link to={crumb.to} className="shrink-0 text-slate-500 hover:text-ink">{crumb.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function SidebarContent({ nav, authed, admin, profile, session, onNavigate, signOut }) {
  const name = profile?.full_name || session?.user?.email || ''
  return (
    <div className="flex h-full flex-col bg-navy-900">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <Link to="/" onClick={onNavigate} className="rounded focus-visible:outline-white"><Logo /></Link>
        {onNavigate && (
          <button type="button" data-autofocus onClick={onNavigate} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Close navigation">
            <Icon name="close" size={20} />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-5">
        {nav.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                  >
                    <Icon name={item.icon} size={17} className="shrink-0 opacity-80" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        {authed ? (
          <>
            <Link to="/profile" onClick={onNavigate} className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/[0.06]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xs font-semibold text-white">
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{name}</span>
                <span className="block text-[11px] text-slate-400">{admin ? 'Administrator' : 'Learner'}</span>
              </span>
            </Link>
            <button type="button" onClick={signOut} className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.06] hover:text-white">
              <Icon name="logout" size={16} />
              Sign out
            </button>
          </>
        ) : isAuthEnabled() ? (
          <div className="space-y-2 px-1 pb-1">
            <Link to="/signup" onClick={onNavigate} className="btn btn-primary w-full">Create account</Link>
            <Link to="/login" onClick={onNavigate} className="btn w-full border-white/15 bg-white/5 text-white hover:bg-white/10">Sign in</Link>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-200"><Icon name="info" size={14} /> Local training mode</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">Progress stays in this browser. Connect Supabase to add accounts and cloud progress.</p>
          </div>
        )}
        <p className="mt-3 px-1 text-[10px] leading-4 text-slate-500">
          Deliberately vulnerable range. Use only on systems you own or are authorised to test.
        </p>
      </div>
    </div>
  )
}

export default function Layout() {
  const { session, profile, signOut } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const triggerRef = useRef(null)

  const authed = Boolean(isAuthEnabled() && session)
  const admin = Boolean(authed && profile?.role === 'admin')
  const name = profile?.full_name || session?.user?.email || ''

  const nav = useMemo(() => NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => (
      item.to === '/' ? { ...item, label: authed ? 'Dashboard' : 'Home' } : item
    )),
  })).concat(admin ? [{ label: 'Operations', items: [{ to: '/admin', label: 'Admin console', icon: 'admin' }] }] : []), [authed, admin])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

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
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
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
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-card">
        Skip to content
      </a>

      <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen lg:block">
          <SidebarContent
            nav={nav} authed={authed} admin={admin} profile={profile} session={session}
            signOut={signOut}
          />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
              <button
                ref={triggerRef}
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-ink lg:hidden"
                aria-label={open ? 'Close navigation' : 'Open navigation'}
                aria-expanded={open}
                aria-controls="mobile-navigation"
                onClick={() => setOpen((value) => !value)}
              >
                <Icon name={open ? 'close' : 'menu'} size={22} />
              </button>

              <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="OWASP LLM Lab home">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 text-white"><Icon name="shield" size={16} /></span>
              </Link>

              <Breadcrumbs />

              <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                {authed ? (
                  <>
                    <Link to="/profile" className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100" title={session.user.email}>
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white">{initials(name)}</span>
                      <span className="hidden max-w-[10rem] truncate text-sm text-slate-600 md:inline">{name}</span>
                    </Link>
                    <button type="button" onClick={signOut} className="btn btn-sm btn-ghost" aria-label="Sign out">
                      <Icon name="logout" size={16} />
                      <span className="hidden sm:inline">Sign out</span>
                    </button>
                  </>
                ) : isAuthEnabled() ? (
                  <>
                    <Link to="/login" className="btn btn-sm btn-ghost sm:hidden">Sign in</Link>
                    <Link to="/signup" className="btn btn-sm hidden sm:inline-flex">Create account</Link>
                    <Link to="/login" className="btn btn-sm btn-primary hidden sm:inline-flex">Sign in</Link>
                  </>
                ) : (
                  <span className="badge badge-neutral"><Icon name="lock" size={12} /> Local mode</span>
                )}
              </div>
            </div>
          </header>

          <main id="main" key={location.pathname} className="page-enter mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <Outlet />
          </main>

          <footer className="mx-auto w-full max-w-[1440px] border-t border-line px-4 py-6 text-xs leading-5 text-slate-500 sm:px-6 lg:px-8">
            <p>Deliberately vulnerable training application. Run it locally or on your own deployment, and never point these techniques at systems you do not own or have permission to test.</p>
            <p className="mt-1">Proposed by OWASP Siliguri and built by the community. Not an official OWASP project.</p>
          </footer>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close navigation"
            className="absolute inset-0 h-full w-full cursor-default bg-slate-950/55"
            onClick={close}
          />
          <div
            ref={panelRef}
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[min(19rem,86vw)] animate-slide-in shadow-drawer"
          >
            <SidebarContent
              nav={nav} authed={authed} admin={admin} profile={profile} session={session}
              onNavigate={close}
              signOut={() => { close(); signOut() }}
            />
          </div>
        </div>
      )}
    </>
  )
}
