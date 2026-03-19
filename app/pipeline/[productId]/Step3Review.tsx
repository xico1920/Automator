'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DescriptionQuality {
  isGood: boolean
  score: number
  reason: string
}

interface BackgroundCheck {
  hasWhiteBackground: boolean
  nonWhiteRatio: number
}

interface Changes {
  descriptionRewritten: boolean
  backgroundRemoved: boolean
}

interface ValidationData {
  productId: string
  shopifyProductId: string
  title: string
  descriptionQuality: DescriptionQuality
  backgroundCheck: BackgroundCheck
  imageCount: number
  imageCountInDescription: number
  changes: Changes
  originalDescription?: string
  newDescription?: string
}

interface Props {
  productId: string
  data: Record<string, unknown>
  onApproved: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Step3Review({ productId, data, onApproved }: Props) {
  const vd = data as unknown as ValidationData

  const [applyDescription, setApplyDescription] = useState(vd.changes.descriptionRewritten)
  const [editedDescription, setEditedDescription] = useState(vd.newDescription ?? '')
  const [showDiff, setShowDiff] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleApprove() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          shopifyProductId: vd.shopifyProductId,
          applyDescription,
          newDescription: applyDescription ? editedDescription : undefined,
        }),
      })
      const result = await res.json() as { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Erro ao aplicar alterações')
      onApproved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    // Just approve the step without applying any changes
    setLoading(true)
    try {
      await fetch('/api/shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          shopifyProductId: vd.shopifyProductId,
          applyDescription: false,
        }),
      })
      onApproved()
    } finally {
      setLoading(false)
    }
  }

  // ── Score card helpers ──
  function descCardStyle() {
    if (vd.descriptionQuality.isGood) {
      return { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }
    }
    return { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }
  }

  function descScoreColor() {
    return vd.descriptionQuality.isGood ? '#4ade80' : 'var(--amber)'
  }

  function descBadgeStyle() {
    if (vd.descriptionQuality.isGood) {
      return { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
    }
    return { background: 'rgba(245,158,11,0.15)', color: 'var(--amber)' }
  }

  function bgCardStyle() {
    if (vd.backgroundCheck.hasWhiteBackground) {
      return { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }
    }
    if (vd.changes.backgroundRemoved) {
      return { background: 'rgba(8,102,255,0.08)', border: '1px solid rgba(8,102,255,0.18)' }
    }
    return { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }
  }

  function bgTextColor() {
    if (vd.backgroundCheck.hasWhiteBackground) return '#4ade80'
    if (vd.changes.backgroundRemoved) return '#93c5fd'
    return '#f87171'
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Description quality */}
        <div style={{ ...descCardStyle(), borderRadius: 8, padding: '1rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Descrição</p>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: descScoreColor() }}>
              {vd.descriptionQuality.score}/10
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 9999, ...descBadgeStyle() }}>
              {vd.descriptionQuality.isGood ? 'Boa' : 'Fraca'}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{vd.descriptionQuality.reason}</p>
        </div>

        {/* Background */}
        <div style={{ ...bgCardStyle(), borderRadius: 8, padding: '1rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Fundo da Imagem</p>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: bgTextColor() }}>
            {vd.backgroundCheck.hasWhiteBackground
              ? 'Branco ✓'
              : vd.changes.backgroundRemoved
              ? 'Removido via Remove.bg ✓'
              : 'Não branco — sem chave Remove.bg'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {Math.round(vd.backgroundCheck.nonWhiteRatio * 100)}% pixels não-brancos na borda
          </p>
        </div>

        {/* Image count */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Imagens</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            <strong>{vd.imageCount}</strong> no produto ·{' '}
            <strong style={{ color: vd.imageCountInDescription < 2 ? 'var(--red)' : 'var(--text-primary)' }}>
              {vd.imageCountInDescription}
            </strong>{' '}
            na descrição
            {vd.imageCountInDescription < 2 && (
              <span style={{ color: 'var(--red)' }}> ⚠ mínimo 2</span>
            )}
          </p>
        </div>

        {/* Changes summary */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Alterações</p>
          <ul style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }} className="space-y-1">
            <li>{vd.changes.backgroundRemoved ? '✅' : '—'} Fundo removido</li>
            <li>{vd.changes.descriptionRewritten ? '✅' : '—'} Descrição reescrita</li>
          </ul>
        </div>
      </div>

      {/* Description diff */}
      {vd.changes.descriptionRewritten && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
          >
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Descrição reescrita</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={applyDescription}
                  onChange={(e) => setApplyDescription(e.target.checked)}
                  className="rounded"
                />
                Aplicar
              </label>
              <button
                onClick={() => setShowDiff(!showDiff)}
                style={{ fontSize: '0.75rem', color: 'var(--meta-blue)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showDiff ? 'Ocultar original' : 'Ver original'}
              </button>
            </div>
          </div>

          {showDiff && vd.originalDescription && (
            <div
              className="p-4"
              style={{ background: 'rgba(239,68,68,0.07)', borderBottom: '1px solid var(--border)' }}
            >
              <p style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, marginBottom: '0.5rem' }}>ORIGINAL</p>
              <div
                style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: vd.originalDescription }}
              />
            </div>
          )}

          {applyDescription && (
            <div className="p-4">
              <p style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600, marginBottom: '0.5rem' }}>NOVA DESCRIÇÃO (editável)</p>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={10}
                className="input-dark w-full font-mono"
                style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.18)',
            color: '#f87171',
            borderRadius: 8,
            padding: '0.75rem',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="btn btn-success flex-1"
        >
          {loading ? 'A aplicar...' : 'Aprovar e Continuar →'}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="btn btn-ghost"
        >
          Manter original
        </button>
      </div>
    </div>
  )
}
