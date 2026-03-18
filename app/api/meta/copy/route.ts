import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateAdCopy } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json() as { productId: string }

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    await prisma.pipelineStep.updateMany({
      where: { productId, step: 5 },
      data: { status: 'running', error: null },
    })

    const variantes = await generateAdCopy(
      product.title ?? 'Producto',
      product.description ?? '',
      product.type as 'single_product' | 'collection'
    )

    // Persist copy in step data so it survives page reloads
    const existing = await prisma.pipelineStep.findFirst({ where: { productId, step: 5 } })
    const prevData = existing?.data ? JSON.parse(existing.data) as Record<string, unknown> : {}
    await prisma.pipelineStep.updateMany({
      where: { productId, step: 5 },
      data: {
        status: 'awaiting_approval',
        data: JSON.stringify({ ...prevData, variantes: variantes.variantes }),
      },
    })

    return NextResponse.json(variantes)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await prisma.pipelineStep.updateMany({
      where: { step: 5 },
      data: { status: 'failed', error: message },
    }).catch(() => null)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
