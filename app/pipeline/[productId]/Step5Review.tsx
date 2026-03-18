'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CopyVariant {
  titulo: string
  descripcion: string
}

export interface CampaignData {
  variantes?: CopyVariant[]
  campaignId?: string
  adsetId?: string
  adIds?: string[]
  adManagerUrl?: string
  startTime?: string
  dailyBudget?: number
  campaignName?: string
  copyUsed?: CopyVariant
  totalCreatives?: number
}

interface Creative {
  id: string
  url: string
  localPath: string | null
  type: string
  selected: boolean
}

interface Props {
  productId: string
  productType: string
  productTitle: string
  stepStatus: string
  stepData: CampaignData | null
  logs: string[]
  onRefresh: () => void
}

// ─── Ad preview mock ──────────────────────────────────────────────────────────

function AdPreview({ imageUrl, titulo, descripcion }: { imageUrl?: string; titulo: string; descripcion: string }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm w-full max-w-xs">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="creative" className="w-full aspect-square object-cover" />
      )}
      {!imageUrl && (
        <div className="w-full aspect-square bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-gray-400 text-sm">
          Preview do criativo
        </div>
      )}
      <div className="p-3 space-y-1 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500">Patrocinado · SHOP NOW</p>
        <p className="text-sm font-semibold text-gray-900 leading-tight">{titulo || '—'}</p>
        <p className="text-xs text-gray-600 leading-snug">{descripcion || '—'}</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Step5Review({
  productId,
  productType,
  productTitle,
  stepStatus,
  stepData,
  logs,
  onRefresh,
}: Props) {
  const [phase, setPhase] = useState<'idle' | 'copy' | 'campaign' | 'preview' | 'done'>('idle')
  const [variants, setVariants] = useState<CopyVariant[]>(stepData?.variantes ?? [])
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0)
  const [editedVariants, setEditedVariants] = useState<CopyVariant[]>(stepData?.variantes ?? [])
  const [campaignData, setCampaignData] = useState<CampaignData | null>(stepData ?? null)
  const [firstCreativeUrl, setFirstCreativeUrl] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [publishConfirm, setPublishConfirm] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState('')

  // Restore state from persisted stepData on mount
  useEffect(() => {
    if (!stepData) return
    if (stepData.variantes?.length) {
      setVariants(stepData.variantes)
      setEditedVariants(stepData.variantes)
      if (stepData.campaignId) {
        setCampaignData(stepData)
        setPhase('preview')
      } else {
        setPhase('copy')
      }
    }
    if (stepStatus === 'approved') setPublished(true)
  }, [stepData, stepStatus])

  // Fetch first selected creative image for preview
  const fetchFirstCreative = useCallback(async () => {
    const res = await fetch(`/api/images?productId=${productId}`)
    if (!res.ok) return
    const data = await res.json() as { creatives: Creative[] }
    const first = data.creatives.find((c) => c.selected)
    if (first?.localPath) {
      setFirstCreativeUrl(`/api/images/file?path=${encodeURIComponent(first.localPath)}`)
    } else if (first?.url) {
      setFirstCreativeUrl(first.url)
    }
  }, [productId])

  useEffect(() => {
    if (phase === 'copy' || phase === 'preview') {
      void fetchFirstCreative()
    }
  }, [phase, fetchFirstCreative])

  // ── Generate copy ──
  async function handleGenerateCopy() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/meta/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json() as { variantes?: CopyVariant[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar copy')
      const vars = data.variantes ?? []
      setVariants(vars)
      setEditedVariants(vars)
      setPhase('copy')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  // ── Create campaign ──
  async function handleCreateCampaign() {
    setLoading(true)
    setError('')
    try {
      setPhase('campaign')
      const res = await fetch('/api/meta/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          selectedCopyVariantIndex: selectedVariantIdx,
          copyOverride: editedVariants[selectedVariantIdx],
        }),
      })
      const data = await res.json() as CampaignData & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar campanha')
      setCampaignData(data)
      setPhase('preview')
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setPhase('copy')
    } finally {
      setLoading(false)
    }
  }

  // ── Publish ──
  async function handlePublish() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/meta/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erro ao publicar')
      setPublished(true)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
      setPublishConfirm(false)
    }
  }

  // ── Published ──
  if (published || stepStatus === 'approved') {
    return (
      <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
        <p className="text-green-800 font-semibold">Campanha publicada e ativa!</p>
        {campaignData?.adManagerUrl && (
          <a
            href={campaignData.adManagerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Ver no Meta Ads Manager →
          </a>
        )}
      </div>
    )
  }

  // ── Idle ──
  if (phase === 'idle') {
    return (
      <div className="mt-4 space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Criação de Campanha Meta Ads</p>
          <p>Orçamento: <strong>{productType === 'collection' ? '150€/dia' : '51.77€/dia'}</strong> · Objetivo: OUTCOME_TRAFFIC · Status: PAUSED</p>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={handleGenerateCopy}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'A gerar...' : 'Gerar Copy para Anúncio'}
        </button>
      </div>
    )
  }

  // ── Creating campaign (in-progress) ──
  if (phase === 'campaign') {
    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-blue-700 font-medium">A criar campanha no Meta Ads...</p>
        </div>
        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1 max-h-48 overflow-y-auto">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
            <button onClick={() => setPhase('copy')} className="ml-3 underline text-xs">← Voltar</button>
          </div>
        )}
      </div>
    )
  }

  // ── Copy selection ──
  if (phase === 'copy') {
    return (
      <div className="mt-4 space-y-4">
        <p className="text-sm font-medium text-gray-700">Seleciona e edita uma variante de copy:</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {editedVariants.map((variant, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedVariantIdx(idx)}
              className={`border-2 rounded-xl p-4 cursor-pointer transition-all space-y-3 ${
                selectedVariantIdx === idx ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">Variante {idx + 1}</span>
                {selectedVariantIdx === idx && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Selecionada</span>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Título ({variant.titulo.length}/40)</label>
                  <input
                    type="text"
                    value={variant.titulo}
                    maxLength={40}
                    onChange={(e) => {
                      const updated = [...editedVariants]
                      updated[idx] = { ...updated[idx], titulo: e.target.value }
                      setEditedVariants(updated)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Descrição ({variant.descripcion.length}/125)</label>
                  <textarea
                    value={variant.descripcion}
                    maxLength={125}
                    rows={3}
                    onChange={(e) => {
                      const updated = [...editedVariants]
                      updated[idx] = { ...updated[idx], descripcion: e.target.value }
                      setEditedVariants(updated)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                </div>
              </div>

              {/* Mini ad preview */}
              <AdPreview
                imageUrl={firstCreativeUrl}
                titulo={variant.titulo}
                descripcion={variant.descripcion}
              />
            </div>
          ))}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleCreateCampaign}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'A criar...' : `Criar Campanha com Variante ${selectedVariantIdx + 1} →`}
          </button>
          <button
            onClick={handleGenerateCopy}
            disabled={loading}
            className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50"
          >
            Regenerar
          </button>
        </div>
      </div>
    )
  }

  // ── Preview (campaign created, awaiting publish) ──
  if (phase === 'preview' && campaignData?.campaignId) {
    const budget = campaignData.dailyBudget
      ? (campaignData.dailyBudget / 100).toFixed(2)
      : (productType === 'collection' ? '150.00' : '51.77')

    const startDate = campaignData.startTime
      ? new Date(campaignData.startTime).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })
      : '—'

    return (
      <div className="mt-4 space-y-4">
        {/* Campaign summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">Campanha criada (PAUSED)</h3>
            <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">PAUSED</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Nome</p>
              <p className="font-mono text-xs text-gray-700 mt-0.5">{campaignData.campaignName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Orçamento diário</p>
              <p className="font-semibold text-gray-800 mt-0.5">{budget}€</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Início calculado</p>
              <p className="text-gray-700 mt-0.5">{startDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Anúncios criados</p>
              <p className="font-semibold text-gray-800 mt-0.5">{campaignData.adIds?.length ?? 0}</p>
            </div>
          </div>

          {/* Copy used */}
          {campaignData.copyUsed && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="text-xs text-gray-500 font-medium">Copy utilizado</p>
              <p className="text-sm font-semibold text-gray-800">{campaignData.copyUsed.titulo}</p>
              <p className="text-xs text-gray-600">{campaignData.copyUsed.descripcion}</p>
            </div>
          )}

          {/* Ad preview */}
          {campaignData.copyUsed && (
            <AdPreview
              imageUrl={firstCreativeUrl}
              titulo={campaignData.copyUsed.titulo}
              descripcion={campaignData.copyUsed.descripcion}
            />
          )}

          {/* Ad Manager link */}
          {campaignData.adManagerUrl && (
            <a
              href={campaignData.adManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Ver no Meta Ads Manager →
            </a>
          )}
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1 max-h-32 overflow-y-auto">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Publish confirmation */}
        {publishConfirm ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-sm text-amber-800 font-medium">
              Tens a certeza? Esta ação vai ativar a campanha e começar a gastar orçamento real ({budget}€/dia).
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePublish}
                disabled={loading}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'A publicar...' : 'Confirmar Publicação'}
              </button>
              <button
                onClick={() => setPublishConfirm(false)}
                className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setPublishConfirm(true)}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-green-700"
            >
              Publicar Campanha (ACTIVE)
            </button>
            <button
              onClick={() => {
                // Approve step as "done but paused" without activating
                void fetch(`/api/pipeline/${productId}/approve`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ step: 5 }),
                }).then(() => onRefresh())
              }}
              className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm hover:bg-gray-300"
            >
              Deixar em Pausa
            </button>
          </div>
        )}
      </div>
    )
  }

  return null
}
