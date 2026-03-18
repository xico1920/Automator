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

  return (
    <div className="mt-4 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Description quality */}
        <div className={`rounded-lg p-4 border ${vd.descriptionQuality.isGood ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Descrição</p>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${vd.descriptionQuality.isGood ? 'text-green-600' : 'text-yellow-600'}`}>
              {vd.descriptionQuality.score}/10
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${vd.descriptionQuality.isGood ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {vd.descriptionQuality.isGood ? 'Boa' : 'Fraca'}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">{vd.descriptionQuality.reason}</p>
        </div>

        {/* Background */}
        <div className={`rounded-lg p-4 border ${vd.backgroundCheck.hasWhiteBackground ? 'bg-green-50 border-green-200' : vd.changes.backgroundRemoved ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Fundo da Imagem</p>
          <p className={`text-sm font-semibold ${vd.backgroundCheck.hasWhiteBackground ? 'text-green-700' : vd.changes.backgroundRemoved ? 'text-blue-700' : 'text-red-700'}`}>
            {vd.backgroundCheck.hasWhiteBackground
              ? 'Branco ✓'
              : vd.changes.backgroundRemoved
              ? 'Removido via Remove.bg ✓'
              : 'Não branco — sem chave Remove.bg'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {Math.round(vd.backgroundCheck.nonWhiteRatio * 100)}% pixels não-brancos na borda
          </p>
        </div>

        {/* Image count */}
        <div className="rounded-lg p-4 border border-gray-200 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Imagens</p>
          <p className="text-sm text-gray-700">
            <strong>{vd.imageCount}</strong> no produto ·{' '}
            <strong className={vd.imageCountInDescription < 2 ? 'text-red-600' : 'text-gray-700'}>
              {vd.imageCountInDescription}
            </strong>{' '}
            na descrição
            {vd.imageCountInDescription < 2 && (
              <span className="text-red-600"> ⚠ mínimo 2</span>
            )}
          </p>
        </div>

        {/* Changes summary */}
        <div className="rounded-lg p-4 border border-gray-200 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Alterações</p>
          <ul className="text-xs text-gray-700 space-y-1">
            <li>{vd.changes.backgroundRemoved ? '✅' : '—'} Fundo removido</li>
            <li>{vd.changes.descriptionRewritten ? '✅' : '—'} Descrição reescrita</li>
          </ul>
        </div>
      </div>

      {/* Description diff */}
      {vd.changes.descriptionRewritten && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-700">Descrição reescrita</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
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
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showDiff ? 'Ocultar original' : 'Ver original'}
              </button>
            </div>
          </div>

          {showDiff && vd.originalDescription && (
            <div className="p-4 bg-red-50 border-b border-gray-200">
              <p className="text-xs text-red-600 font-semibold mb-2">ORIGINAL</p>
              <div
                className="text-xs text-gray-600 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: vd.originalDescription }}
              />
            </div>
          )}

          {applyDescription && (
            <div className="p-4">
              <p className="text-xs text-green-700 font-semibold mb-2">NOVA DESCRIÇÃO (editável)</p>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={10}
                className="w-full text-xs border border-gray-200 rounded p-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'A aplicar...' : 'Aprovar e Continuar →'}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium text-sm hover:bg-gray-300 disabled:opacity-50"
        >
          Manter original
        </button>
      </div>
    </div>
  )
}
