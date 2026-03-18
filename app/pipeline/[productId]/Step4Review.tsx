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

const TYPE_COLORS: Record<CreativeType, string> = {
  single_image: 'bg-blue-100 text-blue-700',
  collage: 'bg-purple-100 text-purple-700',
  carousel: 'bg-orange-100 text-orange-700',
  video: 'bg-pink-100 text-pink-700',
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Download de criativos</p>
          <p>Vai descarregar todas as imagens do produto Shopify, remover metadata EXIF e classificar automaticamente.</p>
        </div>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-blue-700">A descarregar e processar imagens...</p>
      </div>
    )
  }

  // ── Failed ──
  if (stepStatus === 'failed') {
    return (
      <div className="mt-4 space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Falhou ao carregar criativos.
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
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
              className={`relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
                isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 opacity-50'
              } ${isApproved ? 'cursor-default' : ''}`}
            >
              {/* Image */}
              <div className="aspect-square bg-gray-100 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(c)}
                  alt={`creative-${c.id}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </div>
                )}
                {isTooSmall && (
                  <div className="absolute top-1 left-1 bg-amber-500 text-white text-xs px-1 rounded">
                    ⚠ Pequena
                  </div>
                )}
                {c.exifRemoved && (
                  <div className="absolute bottom-1 right-1 bg-green-600 text-white text-xs px-1 rounded">
                    EXIF ✓
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-1.5 bg-white space-y-1">
                <p className="text-xs text-gray-500">{c.width}×{c.height}</p>
                {!isApproved ? (
                  <select
                    value={currentType}
                    onChange={(e) => {
                      e.stopPropagation()
                      setType(c.id, e.target.value as CreativeType)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {(Object.keys(TYPE_LABELS) as CreativeType[]).map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full ${TYPE_COLORS[currentType] ?? ''}`}>
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
        <div className="sticky bottom-4 bg-white border border-gray-200 rounded-xl shadow-lg p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="font-medium">Selecionados: {validation.total}</span>
              {(Object.keys(validation.counts) as CreativeType[]).map((t) => (
                <span key={t} className={`px-2 py-0.5 rounded-full text-xs ${TYPE_COLORS[t]}`}>
                  {TYPE_LABELS[t]}: {validation.counts[t]}
                </span>
              ))}
            </div>
            <button
              onClick={handleSaveSelection}
              disabled={saving}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {saving ? 'A guardar...' : 'Guardar seleção'}
            </button>
          </div>

          {validation.missing.length > 0 ? (
            <div className="space-y-1">
              {validation.missing.map((m, i) => (
                <p key={i} className="text-xs text-amber-700 flex items-center gap-1">
                  <span>⚠</span> {m}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-green-700 flex items-center gap-1">
              <span>✅</span> Mínimos atingidos — pronto para continuar
            </p>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleApprove}
              disabled={approving || !validation.valid}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {approving ? 'A aprovar...' : 'Aprovar e Continuar →'}
            </button>
            <button
              onClick={handleStart}
              disabled={loading}
              className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50"
            >
              Recarregar
            </button>
          </div>
        </div>
      )}

      {/* Approved summary */}
      {isApproved && validation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
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
