import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  downloadProductImages,
  validateCreativeMinimums,
  type CreativeType,
} from '@/lib/images'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function appendLog(productId: string, message: string) {
  const ps = await prisma.pipelineStep.findFirst({ where: { productId, step: 4 } })
  if (!ps) return
  const logs: string[] = ps.logs ? (JSON.parse(ps.logs) as string[]) : []
  logs.push(`[${new Date().toISOString()}] ${message}`)
  await prisma.pipelineStep.update({ where: { id: ps.id }, data: { logs: JSON.stringify(logs) } })
}

async function setStepStatus(productId: string, status: string, error?: string) {
  await prisma.pipelineStep.updateMany({
    where: { productId, step: 4 },
    data: { status, ...(error !== undefined ? { error } : {}) },
  })
}

// ─── POST — download and process all product images ───────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json() as { productId: string }

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    if (!product.shopifyId) {
      return NextResponse.json({ error: 'shopifyId em falta — completa a Etapa 2 primeiro' }, { status: 400 })
    }

    await setStepStatus(productId, 'running')
    await appendLog(productId, `A descarregar imagens do produto Shopify ID: ${product.shopifyId}`)

    const images = await downloadProductImages(product.shopifyId, productId)

    await appendLog(productId, `${images.length} imagens descarregadas e processadas.`)

    // Delete existing creatives for this product to avoid duplicates on re-run
    await prisma.creative.deleteMany({ where: { productId } })

    // Save each image as a Creative record
    const creatives = await prisma.$transaction(
      images.map((img) =>
        prisma.creative.create({
          data: {
            id: img.id,
            productId,
            url: img.sourceUrl,
            localPath: img.processedPath,
            type: img.type,
            selected: true, // selected by default
            exifRemoved: true,
            width: img.width,
            height: img.height,
            sizeBytes: img.sizeBytes,
          },
        })
      )
    )

    await appendLog(productId, `${creatives.length} criativos guardados na DB.`)

    const counts = images.reduce(
      (acc, img) => {
        acc[img.type] = (acc[img.type] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    await setStepStatus(productId, 'awaiting_approval')
    await prisma.pipelineStep.updateMany({
      where: { productId, step: 4 },
      data: { data: JSON.stringify({ counts, total: images.length }) },
    })

    return NextResponse.json({ images, counts, total: images.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await prisma.pipelineStep.updateMany({
      where: { step: 4 },
      data: { status: 'failed', error: message },
    }).catch(() => null)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── GET — return creatives for a product ────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  if (!productId) return NextResponse.json({ error: 'productId is required' }, { status: 400 })

  const creatives = await prisma.creative.findMany({ where: { productId } })
  return NextResponse.json({ creatives })
}

// ─── PATCH — save user's creative selection and type overrides ────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { productId, selectedIds, typeOverrides } = await req.json() as {
      productId: string
      selectedIds: string[]
      typeOverrides: Record<string, CreativeType>
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { type: true },
    })
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const selectedSet = new Set(selectedIds)

    // Update all creatives: selection + type overrides
    const allCreatives = await prisma.creative.findMany({ where: { productId } })

    await prisma.$transaction(
      allCreatives.map((c) =>
        prisma.creative.update({
          where: { id: c.id },
          data: {
            selected: selectedSet.has(c.id),
            type: typeOverrides[c.id] ?? c.type,
          },
        })
      )
    )

    // Validate minimums
    const selectedCreatives = allCreatives
      .filter((c) => selectedSet.has(c.id))
      .map((c) => ({ type: typeOverrides[c.id] ?? c.type }))

    const validation = validateCreativeMinimums(selectedCreatives, product.type)

    return NextResponse.json(validation)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
