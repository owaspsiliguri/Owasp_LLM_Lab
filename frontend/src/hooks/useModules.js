import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

export function useModules() {
  const [state, setState] = useState({ modules: [], loading: true, error: null })
  useEffect(() => {
    let live = true
    api.modules().then((modules) => live && setState({ modules, loading: false, error: null }))
      .catch((e) => live && setState({ modules: [], loading: false, error: e.message }))
    return () => { live = false }
  }, [])
  return state
}
