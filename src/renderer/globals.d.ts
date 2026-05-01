import type { KodaAPI } from '../shared/types'

declare global {
  interface Window {
    api: KodaAPI
  }
}
