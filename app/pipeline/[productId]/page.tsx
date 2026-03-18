'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Step2Review from './Step2Review'
import Step3Review from './Step3Review'
import Step4Review from './Step4Review'
import Step5Review from './Step5Review'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineStep {
  id: string
  step: number
  status: string
  logs: string | null
  data: string | null
  error: string | null
}

interface Creative {
  id: string
  url: string
  type: string
  selected: boolean
}

interface Product {
  id: string
  title: string | null
  sourceUrl: string
  type: string
  shopifyId: string | null
  shopifyHandle: string | null
  description: string | null
  currentStep: number
  status: string
  pipelineSteps: PipelineStep[]
  creatives: Creative[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Ingestão & Deteção',
  'Import Shopify (Poky)',
  'Validação & Enriquecimento',
  'Preparação de Criativos',
  'Criação de Campanha Meta',
]

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  running: 'A correr...',
  awaiting_approval: 'Aguarda aprovação',
  approved: 'Aprovado',
  failed: 'Falhou',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700 animate-pulse',
  awaiting_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
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

  // Initial load
  useEffect(() => {
    fetchProduct().finally(() => setLoading(false))
  }, [fetchProduct])

  // Poll every 2s while any step is running
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">A carregar...</p>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">Produto não encontrado.</p>
      </main>
    )
  }

  const step2 = product.pipelineSteps.find((s) => s.step === 2)
  const step3 = product.pipelineSteps.find((s) => s.step === 3)
  const step4 = product.pipelineSteps.find((s) => s.step === 4)
  const step2Approved = step2?.status === 'approved'
  const step3Approved = step3?.status === 'approved'
  const step4Approved = step4?.status === 'approved'

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <a href="/" className="text-blue-600 hover:text-blue-800 text-sm">← Dashboard</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {product.title ?? 'Produto sem título'}
          </h1>
          <p className="text-sm text-gray-500 mt-1 break-all">{product.sourceUrl}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block ${
            product.type === 'collection' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {product.type === 'collection' ? 'Coleção' : 'Produto'} · {product.type === 'collection' ? '150€/dia' : '51.77€/dia'}
          </span>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {product.pipelineSteps.map((step) => {
            const logs: string[] = step.logs ? (JSON.parse(step.logs) as string[]) : []
            const isCurrentStep = step.step === product.currentStep
            const stepData = step.data ? JSON.parse(step.data) as Record<string, unknown> : null

            return (
              <div
                key={step.id}
                className={`bg-white rounded-xl border p-6 transition-all ${
                  isCurrentStep ? 'border-blue-300 shadow-sm' : 'border-gray-200'
                }`}
              >
                {/* Step header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      step.status === 'approved'
                        ? 'bg-green-500 text-white'
                        : isCurrentStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {step.status === 'approved' ? '✓' : step.step}
                    </span>
                    <h2 className="font-semibold text-gray-800">{STEP_LABELS[step.step - 1]}</h2>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[step.status] ?? ''}`}>
                    {STATUS_LABELS[step.status] ?? step.status}
                  </span>
                </div>

                {/* Error (shown for all steps except steps with their own review UI) */}
                {step.error && step.step !== 2 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-3">
                    <strong>Erro:</strong> {step.error}
                  </div>
                )}

                {/* Logs (shown for steps without their own review UI) */}
                {logs.length > 0 && step.step !== 2 && (
                  <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1 mb-3 max-h-40 overflow-y-auto">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                  </div>
                )}

                {/* ── Step 2 — Poky ── */}
                {step.step === 2 && step.status !== 'approved' && (
                  <Step2Review
                    productId={productId}
                    stepStatus={step.status}
                    logs={logs}
                    data={stepData as { shopifyProductId?: string; shopifyProductUrl?: string; screenshotPath?: string } | null}
                    error={step.error}
                    onStarted={fetchProduct}
                    onApproved={fetchProduct}
                  />
                )}
                {step.step === 2 && step.status === 'approved' && (
                  <p className="text-sm text-green-700 mt-2">
                    ✓ Importado
                    {(stepData as { shopifyProductId?: string } | null)?.shopifyProductId && (
                      <span className="text-gray-500 ml-2 font-mono text-xs">
                        ID: {(stepData as { shopifyProductId: string }).shopifyProductId}
                      </span>
                    )}
                  </p>
                )}

                {/* ── Step 3 — Shopify validation ── */}
                {step.step === 3 && step.status === 'awaiting_approval' && stepData && (
                  <Step3Review
                    productId={productId}
                    data={stepData}
                    onApproved={fetchProduct}
                  />
                )}
                {step.step === 3 && step.status === 'pending' && product.currentStep === 3 && (
                  <>
                    {!step2Approved && (
                      <p className="text-xs text-amber-600 mt-2">
                        ⚠ Aguarda aprovação da Etapa 2 (Poky) antes de continuar.
                      </p>
                    )}
                    {step2Approved && (
                      <button
                        onClick={runStep3}
                        disabled={runningStep3}
                        className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {runningStep3 ? 'A validar...' : 'Iniciar Validação Shopify'}
                      </button>
                    )}
                  </>
                )}
                {step.step === 3 && step.status === 'failed' && step2Approved && (
                  <button
                    onClick={runStep3}
                    disabled={runningStep3}
                    className="mt-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    Tentar novamente
                  </button>
                )}

                {/* ── Step 4 — Creatives ── */}
                {step.step === 4 && (
                  <>
                    {!step3Approved && step.status === 'pending' && (
                      <p className="text-xs text-amber-600 mt-2">
                        ⚠ Aguarda aprovação da Etapa 3 (Validação) antes de continuar.
                      </p>
                    )}
                    {(step3Approved || step.status !== 'pending') && (
                      <Step4Review
                        productId={productId}
                        productType={product.type}
                        stepStatus={step.status}
                        onStarted={fetchProduct}
                        onApproved={fetchProduct}
                      />
                    )}
                  </>
                )}

                {/* ── Step 5 — Meta Ads ── */}
                {step.step === 5 && !step4Approved && step.status === 'pending' && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠ Aguarda aprovação da Etapa 4 (Criativos) antes de continuar.
                  </p>
                )}
                {step.step === 5 && (step4Approved || step.status !== 'pending') && (
                  <Step5Review
                    productId={productId}
                    productType={product.type}
                    productTitle={product.title ?? 'Produto'}
                    stepStatus={step.status}
                    stepData={stepData as import('./Step5Review').CampaignData | null}
                    logs={logs}
                    onRefresh={fetchProduct}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
