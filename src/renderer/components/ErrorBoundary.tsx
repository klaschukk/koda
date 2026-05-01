import React from 'react'
import { AlertTriangle, RefreshCw, FolderOpen } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Catches uncaught render errors so the app doesn't show a blank screen.
 * Provides recovery actions: reload window, open data folder for manual repair.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo })
    // eslint-disable-next-line no-console
    console.error('Koda render crashed:', error, errorInfo)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleOpenFolder = (): void => {
    void window.api?.openDataFolder?.()
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    const message = this.state.error?.message ?? 'Unknown error'
    const stack = this.state.error?.stack ?? ''

    return (
      <div
        className="h-screen flex items-center justify-center p-8"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <div
          className="max-w-[520px] w-full rounded-2xl p-6 animate-fade-in"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--error-soft)', color: 'var(--error)' }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
                Something went wrong
              </div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                Koda hit an unexpected error and stopped rendering.
              </div>
            </div>
          </div>

          <div
            className="rounded-lg p-3 mb-4 font-mono text-[11px] overflow-auto max-h-[200px]"
            style={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <div className="font-bold mb-1" style={{ color: 'var(--error)' }}>{message}</div>
            {stack && <pre className="whitespace-pre-wrap text-[10px] opacity-70">{stack.split('\n').slice(0, 6).join('\n')}</pre>}
          </div>

          <div className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
            Your data is safe — it's stored as separate JSON files. You can try reloading first.
            If the issue persists, open the data folder and check for corrupted files.
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="kd-btn kd-btn-primary flex-1 py-2.5"
            >
              <RefreshCw size={14} /> Reload Koda
            </button>
            <button
              type="button"
              onClick={this.handleOpenFolder}
              className="kd-btn kd-btn-ghost px-4 py-2.5 text-[11px]"
            >
              <FolderOpen size={13} /> Open Data Folder
            </button>
          </div>
        </div>
      </div>
    )
  }
}
