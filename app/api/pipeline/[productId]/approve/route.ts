import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params
    const { step } = await req.json() as { step: number }

    await prisma.pipelineStep.updateMany({
      where: { productId, step },
      data: { status: 'approved' },
    })

    // Advance product's currentStep
    await prisma.product.update({
      where: { id: productId },
      data: { currentStep: step + 1 },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
