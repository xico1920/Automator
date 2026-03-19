'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type CreativeType = 'single_image' | 'collage' | 'carousel' | 'video'

interface Creative {
  id: string
  url: string
  localPath: string | null
  type: string
  selected: boolean
  width: number
  height: number
  sizeBytes: number
  exifRemoved: boolean
}

interface ValidationResult {
  valid: boolean
  counts: Record<CreativeType, number>
  total: number
  missing: string[]
}

interface Props {
  productId: string
  productType: string
  stepStatus: string
  onStarted: () => void
  onApproved: () => void
}

const TYPE_LABELS: Record<CreativeType, string> = {
  single_image: 'Imagem',
  collage: 'Collage',
  carousel: 'Carousel',
  video: 'Vídeo',
}

// Dark-theme badge styles per type
const TYPE_BADGE_STYLES: Record<CreativeType, React.CSSProperties> = {
  single_image: { background: 'rgba(8,102,255,0.15)', color: '#93c5fd' },
  collage: { background: 'rgba(168,85,247,0.15)', color: '#d8b4fe' },
  carousel: { background: 'rgba(245,158,11,0.15)', color: 'var(--amber)' },
  video: { background: 'rgba(239,68,68,0.15)', color: '#f87171' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Step4Review({
  productId,
  productType,
  stepStatus,
  onStarted,
  onApproved,
}: Props) {
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [typeOverrides, setTypeOverrides] = useState<Record<string, CreativeType>>({})
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')

  const fetchCreatives = useCallback(async () => {
    const res = await fetch(`/api/images?productId=${productId}`)
    if (!res.ok) return
    const data = await res.json() as { creatives: Creative[] }
    setCreatives(data.creatives)
    setSelectedIds(new Set(data.creatives.filter((c) => c.selected).map((c) => c.id)))
  }, [productId])

  useEffect(() => {
    if (stepStatus === 'awaiting_approval' || stepStatus === 'approved') {
      void fetchCreatives()
    }
  }, [stepStatus, fetchCreatives])

  // Auto-validate when selection changes
  useEffect(() => {
    if (creatives.length === 0) return
    const selected = creatives
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({ type: typeOverrides[c.id] ?? c.type }))
    const counts: Record<CreativeType, number> = { single_image: 0, collage: 0, carousel: 0, video: 0 }
    for (const c of selected) counts[c.type as CreativeType] = (counts[c.type as CreativeType] ?? 0) + 1
    const total = selected.length
    const uniqueTypes = (Object.keys(counts) as CreativeType[]).filter((k) => counts[k] > 0).length
    const missing: string[] = []
    if (productType === 'collection') {
      if (total < 9) missing.push(`${9 - total} criativos em falta (mínimo 9)`)
      if (uniqueTypes < 3) missing.push(`Mínimo 3 tipos diferentes (tens ${uniqueTypes})`)
    } else {
      if (total < 4) missing.push(`${4 - total} criativos em falta (mínimo 4)`)
      if (uniqueTypes < 2) missing.push(`Mínimo 2 tipos diferentes (tens ${uniqueTypes})`)
    }
    setValidation({ valid: missing.length === 0, counts, total, missing })
  }, [selectedIds, typeOverrides, creatives, productType])

  async function handleStart() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const result = await res.json() as { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Erro ao carregar imagens')
      await fetchCreatives()
      onStarted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setType(id: string, type: CreativeType) {
    setTypeOverrides((prev) => ({ ...prev, [id]: type }))
  }

  async function handleSaveSelection() {
    setSaving(true)
    try {
      const res = await fetch('/api/images', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          selectedIds: Array.from(selectedIds),
          typeOverrides,
        }),
      })
      const result = await res.json() as ValidationResult & { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Erro ao guardar seleção')
      setValidation(result)
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove() {
    setApproving(true)
    setError('')
    try {
      // Save selection first
      await fetch('/api/images', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          selectedIds: Array.from(selectedIds),
          typeOverrides,
        }),
      })
      // Approve step
      const res = await fetch(`/api/pipeline/${productId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 4 }),
      })
      const result = await res.json() as { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Erro ao aprovar')
      onApproved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setApproving(false)
    }
  }

  function imageUrl(creative: Creative) {
    if (creative.localPath) {
      return `/api/images/file?path=${encodeURIComponent(creative.localPath)}`
    }
    return creative.url
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
          <p className="font-medium mb-1">Download de criativos</p>
          <p>Vai descarregar todas as imagens do produto Shopify, remover metadata EXIF e classificar automaticamente.</p>
        </div>
        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'A processar...' : 'Carregar Criativos do Shopify'}
        </button>
      </div>
    )
  }

  // ── Running ──
  if (stepStatus === 'running') {
    return (
      <div className="mt-4 flex items-center gap-3">
        <div
          className="w-4 h-4 rounded-full animate-spin"
          style={{ border: '2px solid var(--meta-blue)', borderTopColor: 'transparent' }}
        />
        <p style={{ fontSize: '0.875rem', color: 'var(--meta-blue)' }}>A descarregar e processar imagens...</p>
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
            fontSize: '0.875rem',
          }}
        >
          Falhou ao carregar criativos.
        </div>
        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading}
          className="btn btn-danger"
        >
          {loading ? 'A tentar...' : 'Tentar Novamente'}
        </button>
      </div>
    )
  }

  // ── Awaiting approval ──
  if (stepStatus !== 'awaiting_approval' && stepStatus !== 'approved') return null

  const isApproved = stepStatus === 'approved'

  return (
    <div className="mt-4 space-y-4">
      {/* Grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {creatives.map((c) => {
          const isSelected = selectedIds.has(c.id)
          const currentType = (typeOverrides[c.id] ?? c.type) as CreativeType
          const isTooSmall = c.width < 600 || c.height < 600

          return (
            <div
              key={c.id}
              onClick={() => !isApproved && toggleSelect(c.id)}
              style={{
                border: isSelected ? '2px solid var(--meta-blue)' : '2px solid var(--border)',
                opacity: isSelected ? 1 : 0.5,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: isApproved ? 'default' : 'pointer',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {/* Image */}
              <div className="aspect-square relative" style={{ background: 'var(--bg-elevated)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(c)}
                  alt={`creative-${c.id}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: 'var(--meta-blue)' }}>
                    ✓
                  </div>
                )}
                {isTooSmall && (
                  <div
                    className="absolute top-1 left-1 text-xs px-1 rounded"
                    style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--amber)' }}
                  >
                    ⚠ Pequena
                  </div>
                )}
                {c.exifRemoved && (
                  <div
                    className="absolute bottom-1 right-1 text-xs px-1 rounded"
                    style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}
                  >
                    EXIF ✓
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-1.5 space-y-1" style={{ background: 'var(--bg-surface)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.width}×{c.height}</p>
                {!isApproved ? (
                  <select
                    value={currentType}
                    onChange={(e) => {
                      e.stopPropagation()
                      setType(c.id, e.target.value as CreativeType)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      borderRadius: 4,
                      fontSize: 11,
                      padding: '2px 4px',
                      outline: 'none',
                    }}
                  >
                    {(Object.keys(TYPE_LABELS) as CreativeType[]).map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                ) : (
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.75rem',
                      padding: '2px 6px',
                      borderRadius: 9999,
                      ...(TYPE_BADGE_STYLES[currentType] ?? {}),
                    }}
                  >
                    {TYPE_LABELS[currentType]}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky validation bar */}
      {validation && !isApproved && (
        <div
          className="sticky bottom-4 p-4 space-y-2"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-bright)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Selecionados: {validation.total}</span>
              {(Object.keys(validation.counts) as CreativeType[]).map((t) => (
                <span
                  key={t}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 9999,
                    fontSize: '0.75rem',
                    ...(TYPE_BADGE_STYLES[t] ?? {}),
                  }}
                >
                  {TYPE_LABELS[t]}: {validation.counts[t]}
                </span>
              ))}
            </div>
            <button
              onClick={handleSaveSelection}
              disabled={saving}
              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {saving ? 'A guardar...' : 'Guardar seleção'}
            </button>
          </div>

          {validation.missing.length > 0 ? (
            <div className="space-y-1">
              {validation.missing.map((m, i) => (
                <p key={i} className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: 'var(--amber)' }}>
                  <span>⚠</span> {m}
                </p>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: 'var(--green)' }}>
              <span>✅</span> Mínimos atingidos — pronto para continuar
            </p>
          )}

          {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleApprove}
              disabled={approving || !validation.valid}
              className="btn btn-success flex-1"
            >
              {approving ? 'A aprovar...' : 'Aprovar e Continuar →'}
            </button>
            <button
              onClick={handleStart}
              disabled={loading}
              className="btn btn-ghost"
            >
              Recarregar
            </button>
          </div>
        </div>
      )}

      {/* Approved summary */}
      {isApproved && validation && (
        <div
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.18)',
            color: '#4ade80',
            borderRadius: 8,
            padding: '0.75rem',
            fontSize: '0.875rem',
          }}
        >
          ✓ {validation.total} criativos aprovados —{' '}
          {(Object.keys(validation.counts) as CreativeType[])
            .filter((t) => validation.counts[t] > 0)
            .map((t) => `${validation.counts[t]} ${TYPE_LABELS[t].toLowerCase()}`)
            .join(', ')}
        </div>
      )}
    </div>
  )
}
