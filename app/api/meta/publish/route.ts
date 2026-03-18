import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishAdSet, publishAd } from '@/lib/meta'

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json() as { productId: string }

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    if (!product.metaAdSetId) return NextResponse.json({ error: 'Ad Set não encontrado na DB' }, { status: 400 })

    // Get ad IDs from step data
    const step = await prisma.pipelineStep.findFirst({ where: { productId, step: 5 } })
    const stepData = step?.data ? JSON.parse(step.data) as { adIds?: string[] } : {}
    const adIds = stepData.adIds ?? []

    // Activate ad set
    await publishAdSet(product.metaAdSetId)

    // Activate each ad
    for (const adId of adIds) {
      await publishAd(adId)
    }

    // Mark pipeline step and job as completed
    await prisma.pipelineStep.updateMany({
      where: { productId, step: 5 },
      data: { status: 'approved' },
    })
    await prisma.product.update({
      where: { id: productId },
      data: { status: 'completed', currentStep: 6 },
    })

    // Mark job as completed if all products are done
    const prod = await prisma.product.findUnique({ where: { id: productId }, select: { jobId: true } })
    if (prod?.jobId) {
      const allDone = await prisma.product.count({
        where: { jobId: prod.jobId, status: { not: 'completed' } },
      })
      if (allDone === 0) {
        await prisma.job.update({ where: { id: prod.jobId }, data: { status: 'completed' } })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
