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
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--bg-surface)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: 320,
      }}
    >
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="creative" className="w-full aspect-square object-cover" />
      )}
      {!imageUrl && (
        <div
          className="w-full aspect-square flex items-center justify-center text-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(8,102,255,0.12), rgba(168,85,247,0.12))',
            color: 'var(--text-muted)',
          }}
        >
          Preview do criativo
        </div>
      )}
      <div className="p-3 space-y-1" style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Patrocinado · SHOP NOW</p>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.3' }}>{titulo || '—'}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{descripcion || '—'}</p>
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
      <div
        className="mt-4 space-y-3"
        style={{
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.18)',
          borderRadius: 12,
          padding: '1.25rem',
        }}
      >
        <p style={{ color: '#4ade80', fontWeight: 600 }}>Campanha publicada e ativa!</p>
        {campaignData?.adManagerUrl && (
          <a
            href={campaignData.adManagerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-block"
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
        <div
          style={{
            background: 'rgba(8,102,255,0.08)',
            border: '1px solid rgba(8,102,255,0.18)',
            color: '#93c5fd',
            borderRadius: 8,
            padding: '1rem',
            fontSize: '0.875rem',
          }}
        >
          <p className="font-medium mb-1">Criação de Campanha Meta Ads</p>
          <p>Orçamento: <strong>{productType === 'collection' ? '150€/dia' : '51.77€/dia'}</strong> · Objetivo: OUTCOME_TRAFFIC · Status: PAUSED</p>
        </div>
        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}
        <button
          onClick={handleGenerateCopy}
          disabled={loading}
          className="btn btn-primary"
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
          <div
            className="w-4 h-4 rounded-full animate-spin"
            style={{ border: '2px solid var(--meta-blue)', borderTopColor: 'transparent' }}
          />
          <p style={{ fontSize: '0.875rem', color: 'var(--meta-blue)', fontWeight: 500 }}>A criar campanha no Meta Ads...</p>
        </div>
        {logs.length > 0 && (
          <div className="log-terminal max-h-48 overflow-y-auto space-y-1">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}
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
            <button
              onClick={() => setPhase('copy')}
              style={{ marginLeft: '0.75rem', textDecoration: 'underline', fontSize: '0.75rem', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
            >
              ← Voltar
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Copy selection ──
  if (phase === 'copy') {
    return (
      <div className="mt-4 space-y-4">
        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Seleciona e edita uma variante de copy:</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {editedVariants.map((variant, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedVariantIdx(idx)}
              style={{
                border: selectedVariantIdx === idx
                  ? '2px solid var(--meta-blue)'
                  : '2px solid var(--border)',
                boxShadow: selectedVariantIdx === idx ? '0 0 0 1px rgba(8,102,255,0.15)' : 'none',
                background: 'var(--bg-elevated)',
                borderRadius: 12,
                padding: '1rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Variante {idx + 1}
                </span>
                {selectedVariantIdx === idx && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: 'var(--meta-blue-dim)',
                      color: '#93c5fd',
                      padding: '2px 8px',
                      borderRadius: 9999,
                    }}
                  >
                    Selecionada
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Título ({variant.titulo.length}/40)
                  </label>
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
                    className="input-dark w-full"
                    style={{ fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Descrição ({variant.descripcion.length}/125)
                  </label>
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
                    className="input-dark w-full resize-none"
                    style={{ fontSize: '0.875rem' }}
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

        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleCreateCampaign}
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? 'A criar...' : `Criar Campanha com Variante ${selectedVariantIdx + 1} →`}
          </button>
          <button
            onClick={handleGenerateCopy}
            disabled={loading}
            className="btn btn-ghost"
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
        <div
          className="space-y-3"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '1.25rem',
          }}
        >
          <div className="flex items-center justify-between">
            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>Campanha criada (PAUSED)</h3>
            <span className="badge badge-amber">PAUSED</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nome</p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {campaignData.campaignName ?? '—'}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Orçamento diário</p>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{budget}€</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Início calculado</p>
              <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{startDate}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Anúncios criados</p>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{campaignData.adIds?.length ?? 0}</p>
            </div>
          </div>

          {/* Copy used */}
          {campaignData.copyUsed && (
            <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '0.75rem' }} className="space-y-1">
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Copy utilizado</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{campaignData.copyUsed.titulo}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{campaignData.copyUsed.descripcion}</p>
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
              style={{ fontSize: '0.75rem', color: 'var(--meta-blue)', textDecoration: 'underline' }}
            >
              Ver no Meta Ads Manager →
            </a>
          )}
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="log-terminal max-h-32 overflow-y-auto space-y-1">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}

        {error && <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>{error}</p>}

        {/* Publish confirmation */}
        {publishConfirm ? (
          <div
            className="space-y-3"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.18)',
              borderRadius: 12,
              padding: '1rem',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--amber)', fontWeight: 500 }}>
              Tens a certeza? Esta ação vai ativar a campanha e começar a gastar orçamento real ({budget}€/dia).
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePublish}
                disabled={loading}
                className="btn btn-danger flex-1"
              >
                {loading ? 'A publicar...' : 'Confirmar Publicação'}
              </button>
              <button
                onClick={() => setPublishConfirm(false)}
                className="btn btn-ghost"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setPublishConfirm(true)}
              className="btn btn-success flex-1"
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
              className="btn btn-ghost"
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
