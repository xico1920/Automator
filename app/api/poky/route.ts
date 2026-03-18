import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { importProductViaPoky } from '@/lib/playwright-poky'

// ─── POST — start Poky automation in background ───────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json() as { productId: string }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { pipelineSteps: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const step2 = product.pipelineSteps.find((s) => s.step === 2)
    if (step2?.status === 'running') {
      return NextResponse.json({ error: 'Automação já em curso' }, { status: 409 })
    }

    // Reset step state for retries
    await prisma.pipelineStep.updateMany({
      where: { productId, step: 2 },
      data: { status: 'running', error: null, logs: JSON.stringify([]) },
    })

    // Fire and forget — do NOT await this
    // We respond immediately and the automation runs in the background
    importProductViaPoky(productId).catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.pipelineStep.updateMany({
        where: { productId, step: 2 },
        data: { status: 'failed', error: message },
      })
    })

    return NextResponse.json({ status: 'running' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

// ─── GET — return current state of step 2 ────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }

  try {
    const step = await prisma.pipelineStep.findFirst({
      where: { productId, step: 2 },
    })

    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    return NextResponse.json({
      status: step.status,
      logs: step.logs ? (JSON.parse(step.logs) as string[]) : [],
      data: step.data ? JSON.parse(step.data) : null,
      error: step.error,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
