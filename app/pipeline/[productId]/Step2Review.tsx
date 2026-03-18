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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Automação via Poky</p>
          <p>Vai abrir um browser {process.env.NODE_ENV !== 'production' ? 'visível' : 'headless'} e importar o produto automaticamente para o Shopify.</p>
        </div>
        {actionError && (
          <p className="text-red-600 text-sm mb-3">{actionError}</p>
        )}
        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-blue-700 font-medium">Browser automation em progresso...</p>
        </div>
        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1 max-h-48 overflow-y-auto">
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-red-700 mb-1">Automação falhou</p>
          {error && <p className="text-xs text-red-600 font-mono">{error}</p>}
        </div>

        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-red-400 space-y-1 max-h-40 overflow-y-auto">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}

        {data?.screenshotPath && (
          <p className="text-xs text-gray-500">
            Screenshot: <code className="bg-gray-100 px-1 rounded">{data.screenshotPath}</code>
          </p>
        )}

        {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
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
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-green-700 mb-2">Produto importado com sucesso</p>

          {data?.shopifyProductId && (
            <p className="text-xs text-gray-600 mb-1">
              ID Shopify: <code className="bg-white px-1 rounded border">{data.shopifyProductId}</code>
            </p>
          )}

          {shopifyAdminUrl && (
            <a
              href={shopifyAdminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Ver no Shopify Admin →
            </a>
          )}
        </div>

        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1 max-h-32 overflow-y-auto">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}

        {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'A confirmar...' : 'Confirmar e Continuar →'}
          </button>
          <button
            onClick={handleStart}
            disabled={loading}
            className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium text-sm hover:bg-gray-300 disabled:opacity-50"
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
        <p className="text-sm text-green-700">
          ✓ Import concluído
          {data?.shopifyProductId && (
            <span className="text-gray-500 ml-2 font-mono text-xs">ID: {data.shopifyProductId}</span>
          )}
        </p>
      </div>
    )
  }

  return null
}
