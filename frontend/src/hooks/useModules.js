import { useEffect, useSyncExternalStore } from 'react'
import { api } from '../services/api.js'

const listeners = new Set()
let state = { modules: [], loading: false, loaded: false, error: null }
let inflight = null

function publish(next) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const snapshot = () => state

export function loadModules({ force = false } = {}) {
  if (inflight && !force) return inflight
  publish({ loading: true, error: null })
  inflight = api.modules()
    .then((modules) => {
      publish({ modules, loading: false, loaded: true, error: null })
      return modules
    })
    .catch((error) => {
      publish({ modules: [], loading: false, loaded: true, error: error.message })
      throw error
    })
    .finally(() => { inflight = null })
  return inflight
}

export function useModules() {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot)

  useEffect(() => {
    if (!current.loaded && !current.loading) loadModules().catch(() => {})
  }, [current.loaded, current.loading])

  return {
    ...current,
    reload: () => loadModules({ force: true }),
  }
}
