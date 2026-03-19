'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Step2Review from './Step2Review'
import Step3Review from './Step3Review'
import Step4Review from './Step4Review'
import Step5Review from './Step5Review'
import type { CampaignData } from './Step5Review'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineStep {
  id: string; step: number; status: string
  logs: string | null; data: string | null; error: string | null
}

interface Product {
  id: string; title: string | null; sourceUrl: string; type: string
  shopifyId: string | null; shopifyHandle: string | null
  description: string | null; currentStep: number; status: string
  pipelineSteps: PipelineStep[]; creatives: unknown[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_META = [
  { label: 'Ingestão',     desc: 'Deteção de tipo' },
  { label: 'Import Poky',  desc: 'Browser automation' },
  { label: 'Shopify',      desc: 'Validação e enriquecimento' },
  { label: 'Criativos',    desc: 'Download e seleção' },
  { label: 'Meta Ads',     desc: 'Criação de campanha' },
]

const STATUS_BADGE: Record<string, { label: string; cls: string; dot: string }> = {
  pending:           { label: 'Pendente',        cls: 'badge-muted',  dot: 'dot-pending'  },
  running:           { label: 'A correr…',        cls: 'badge-blue',   dot: 'dot-running'  },
  awaiting_approval: { label: 'Aguarda revisão', cls: 'badge-amber',  dot: 'dot-approval' },
  approved:          { label: 'Aprovado',         cls: 'badge-green',  dot: 'dot-approved' },
  failed:            { label: 'Falhou',           cls: 'badge-red',    dot: 'dot-failed'   },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { productId } = useParams<{ productId: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningStep3, setRunningStep3] = useState(false)

  const fetchProduct = useCallback(async () => {
    const res = await fetch(`/api/product/${productId}`)
    if (res.ok) {
      const data = await res.json() as { product: Product }
      setProduct(data.product)
    }
  }, [productId])

  useEffect(() => { fetchProduct().finally(() => setLoading(false)) }, [fetchProduct])

  useEffect(() => {
    const hasRunning = product?.pipelineSteps.some((s) => s.status === 'running')
    if (!hasRunning) return
    const interval = setInterval(fetchProduct, 2000)
    return () => clearInterval(interval)
  }, [product, fetchProduct])

  async function runStep3() {
    setRunningStep3(true)
    await fetch(`/api/shopify?productId=${productId}`)
    await fetchProduct()
    setRunningStep3(false)
  }

  if (loading) return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>A carregar…</span>
    </main>
  )

  if (!product) return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--red)', fontSize: 14 }}>Produto não encontrado.</span>
    </main>
  )

  const step2 = product.pipelineSteps.find((s) => s.step === 2)
  const step3 = product.pipelineSteps.find((s) => s.step === 3)
  const step4 = product.pipelineSteps.find((s) => s.step === 4)
  const step2Approved = step2?.status === 'approved'
  const step3Approved = step3?.status === 'approved'
  const step4Approved = step4?.status === 'approved'

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'rgba(4,4,10,0.92)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.04em' }}>← DASHBOARD</a>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
            {product.title ?? product.sourceUrl}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge ${product.type === 'collection' ? 'badge-purple' : 'badge-blue'}`}>
              {product.type === 'collection' ? 'COL' : 'PRD'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--shopify-green)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, letterSpacing: '0.02em' }}>
              {product.type === 'collection' ? '150.00' : '51.77'}€/dia
            </span>
          </div>
        </div>
      </nav>

      {/* Progress bar across top */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 4, paddingTop: 20, paddingBottom: 4 }}>
          {product.pipelineSteps.map((step) => {
            const status = step.status
            const color =
              status === 'approved' ? 'var(--green)' :
              status === 'running' ? 'var(--meta-blue)' :
              status === 'awaiting_approval' ? 'var(--amber)' :
              status === 'failed' ? 'var(--red)' : 'var(--bg-hover)'
            return (
              <div key={step.step} style={{ flex: 1, height: 3, borderRadius: 2, background: color, transition: 'background 0.3s' }} />
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {STEP_META.map((m, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '4px 0 16px' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {product.pipelineSteps.map((step) => {
          const logs: string[] = step.logs ? JSON.parse(step.logs) as string[] : []
          const stepData = step.data ? JSON.parse(step.data) as Record<string, unknown> : null
          const meta = STEP_META[step.step - 1]
          const sb = STATUS_BADGE[step.status] ?? STATUS_BADGE.pending
          const isActive = step.step === product.currentStep

          return (
            <div key={step.id} className="card" style={{
              borderColor: isActive ? 'rgba(8,102,255,0.25)' : undefined,
              boxShadow: isActive ? '0 0 0 1px rgba(8,102,255,0.12)' : undefined,
            }}>
              {/* Step header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: step.status === 'approved' ? 'rgba(34,197,94,0.1)' : isActive ? 'rgba(8,102,255,0.1)' : 'var(--bg-elevated)',
                    border: `1px solid ${step.status === 'approved' ? 'rgba(34,197,94,0.2)' : isActive ? 'rgba(8,102,255,0.2)' : 'var(--border)'}`,
                    fontSize: 11, fontWeight: 600, color: step.status === 'approved' ? 'var(--green)' : isActive ? 'var(--meta-blue)' : 'var(--text-muted)',
                    fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
                  }}>
                    {step.status === 'approved' ? '✓' : step.step}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                      {meta?.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{meta?.desc}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className={`status-dot ${sb.dot}`} />
                  <span className={`badge ${sb.cls}`}>{sb.label}</span>
                </div>
              </div>

              {/* Step body */}
              <div style={{ padding: '14px 18px' }}>

                {/* Error */}
                {step.error && step.step !== 2 && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 13, color: '#f87171' }}>
                    <strong>Erro:</strong> {step.error}
                  </div>
                )}

                {/* Logs (non-step2) */}
                {logs.length > 0 && step.step !== 2 && step.step !== 5 && (
                  <div className="log-terminal" style={{ marginBottom: 12 }}>
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                  </div>
                )}

                {/* ── Step 1 ── */}
                {step.step === 1 && step.status === 'pending' && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Produto criado. Avança para a Etapa 2.
                  </p>
                )}

                {/* ── Step 2 ── */}
                {step.step === 2 && step.status !== 'approved' && (
                  <Step2Review
                    productId={productId} stepStatus={step.status} logs={logs}
                    data={stepData as { shopifyProductId?: string; shopifyProductUrl?: string; screenshotPath?: string } | null}
                    error={step.error} onStarted={fetchProduct} onApproved={fetchProduct}
                  />
                )}
                {step.step === 2 && step.status === 'approved' && (
                  <p style={{ fontSize: 13, color: 'var(--green)' }}>
                    ✓ Produto importado
                    {(stepData as { shopifyProductId?: string } | null)?.shopifyProductId && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                        ID: {(stepData as { shopifyProductId: string }).shopifyProductId}
                      </span>
                    )}
                  </p>
                )}

                {/* ── Step 3 ── */}
                {step.step === 3 && step.status === 'awaiting_approval' && stepData && (
                  <Step3Review productId={productId} data={stepData} onApproved={fetchProduct} />
                )}
                {step.step === 3 && step.status === 'pending' && product.currentStep === 3 && (
                  !step2Approved
                    ? <p style={{ fontSize: 12, color: 'var(--amber)' }}>⚠ Aguarda aprovação da Etapa 2 primeiro.</p>
                    : <button onClick={runStep3} disabled={runningStep3} className="btn btn-primary" style={{ fontSize: 13 }}>
                        {runningStep3 ? 'A validar…' : 'Iniciar Validação Shopify'}
                      </button>
                )}
                {step.step === 3 && step.status === 'failed' && step2Approved && (
                  <button onClick={runStep3} disabled={runningStep3} className="btn btn-danger" style={{ fontSize: 13 }}>
                    Tentar novamente
                  </button>
                )}

                {/* ── Step 4 ── */}
                {step.step === 4 && !step3Approved && step.status === 'pending' && (
                  <p style={{ fontSize: 12, color: 'var(--amber)' }}>⚠ Aguarda aprovação da Etapa 3 primeiro.</p>
                )}
                {step.step === 4 && (step3Approved || step.status !== 'pending') && (
                  <Step4Review productId={productId} productType={product.type}
                    stepStatus={step.status} onStarted={fetchProduct} onApproved={fetchProduct} />
                )}

                {/* ── Step 5 ── */}
                {step.step === 5 && !step4Approved && step.status === 'pending' && (
                  <p style={{ fontSize: 12, color: 'var(--amber)' }}>⚠ Aguarda aprovação da Etapa 4 primeiro.</p>
                )}
                {step.step === 5 && (step4Approved || step.status !== 'pending') && (
                  <Step5Review
                    productId={productId} productType={product.type}
                    productTitle={product.title ?? 'Produto'}
                    stepStatus={step.status} stepData={stepData as CampaignData | null}
                    logs={logs} onRefresh={fetchProduct}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
