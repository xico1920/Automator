'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PokyResultData {
  shopifyProductId?: string
  shopifyProductUrl?: string
  screenshotPath?: string
}

interface Props {
  productId: string
  stepStatus: string
  logs: string[]
  data: PokyResultData | null
  error: string | null
  onStarted: () => void
  onApproved: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Step2Review({
  productId,
  stepStatus,
  logs,
  data,
  error,
  onStarted,
  onApproved,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  async function handleStart() {
    setLoading(true)
    setActionError('')
    try {
      const res = await fetch('/api/poky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const result = await res.json() as { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Erro ao iniciar automação')
      onStarted()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    setLoading(true)
    setActionError('')
    try {
      const res = await fetch('/api/pipeline/' + productId + '/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2 }),
      })
      const result = await res.json() as { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Erro ao aprovar')
      onApproved()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  // ── Idle ──
  if (stepStatus === 'pending') {
    return (
      <div className="mt-4">
        <div
          style={{
            background: 'rgba(8,102,255,0.08)',
            border: '1px solid rgba(8,102,255,0.18)',
            color: '#93c5fd',
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}
        >
          <p className="font-medium mb-1">Automação via Poky</p>
          <p>Vai abrir um browser {process.env.NODE_ENV !== 'production' ? 'visível' : 'headless'} e importar o produto automaticamente para o Shopify.</p>
        </div>
        {actionError && (
          <p style={{ color: 'var(--red)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{actionError}</p>
        )}
        <button
          onClick={handleStart}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'A iniciar...' : 'Iniciar Import via Poky'}
        </button>
      </div>
    )
  }

  // ── Running ──
  if (stepStatus === 'running') {
    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-4 h-4 rounded-full animate-spin"
            style={{
              border: '2px solid var(--meta-blue)',
              borderTopColor: 'transparent',
            }}
          />
          <p style={{ fontSize: '0.875rem', color: 'var(--meta-blue)', fontWeight: 500 }}>
            Browser automation em progresso...
          </p>
        </div>
        {logs.length > 0 && (
          <div className="log-terminal max-h-48 overflow-y-auto space-y-1">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}
      </div>
    )
  }

  // ── Failed ──
  if (stepStatus === 'failed') {
    return (
      <div className="mt-4 space-y-3">
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.18)',
            color: '#f87171',
            borderRadius: 8,
            padding: '1rem',
          }}
        >
          <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Automação falhou</p>
          {error && <p style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>{error}</p>}
        </div>

        {logs.length > 0 && (
          <div className="log-terminal max-h-40 overflow-y-auto space-y-1">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}

        {data?.screenshotPath && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Screenshot:{' '}
            <code style={{ background: 'var(--bg-elevated)', padding: '0 4px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}>
              {data.screenshotPath}
            </code>
          </p>
        )}

        {actionError && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{actionError}</p>}

        <button
          onClick={handleStart}
          disabled={loading}
          className="btn btn-danger"
        >
          {loading ? 'A reiniciar...' : 'Tentar Novamente'}
        </button>
      </div>
    )
  }

  // ── Awaiting approval ──
  if (stepStatus === 'awaiting_approval') {
    const shopifyAdminUrl = data?.shopifyProductId
      ? `https://${process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN ?? 'loja.myshopify.com'}/admin/products/${data.shopifyProductId}`
      : null

    return (
      <div className="mt-4 space-y-4">
        <div
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.18)',
            color: '#4ade80',
            borderRadius: 8,
            padding: '1rem',
          }}
        >
          <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Produto importado com sucesso</p>

          {data?.shopifyProductId && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              ID Shopify:{' '}
              <code style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '0 4px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                {data.shopifyProductId}
              </code>
            </p>
          )}

          {shopifyAdminUrl && (
            <a
              href={shopifyAdminUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.75rem', color: 'var(--meta-blue)', textDecoration: 'underline' }}
            >
              Ver no Shopify Admin →
            </a>
          )}
        </div>

        {logs.length > 0 && (
          <div className="log-terminal max-h-32 overflow-y-auto space-y-1">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}

        {actionError && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{actionError}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="btn btn-success flex-1"
          >
            {loading ? 'A confirmar...' : 'Confirmar e Continuar →'}
          </button>
          <button
            onClick={handleStart}
            disabled={loading}
            className="btn btn-ghost"
          >
            Correr de Novo
          </button>
        </div>
      </div>
    )
  }

  // ── Approved ──
  if (stepStatus === 'approved') {
    return (
      <div className="mt-3">
        <p style={{ fontSize: '0.875rem', color: 'var(--green)' }}>
          ✓ Import concluído
          {data?.shopifyProductId && (
            <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
              ID: {data.shopifyProductId}
            </span>
          )}
        </p>
      </div>
    )
  }

  return null
}
