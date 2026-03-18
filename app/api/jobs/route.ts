import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function detectType(url: string): 'single_product' | 'collection' | null {
  if (url.includes('/collections/')) return 'collection'
  if (url.includes('/products/')) return 'single_product'
  return null
}

// ─── POST — create job from URL list ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json() as { urls: string[] }

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Pelo menos 1 URL é obrigatório' }, { status: 400 })
    }

    const invalid = urls.filter((u) => !u.startsWith('https://') || detectType(u) === null)
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `URLs inválidas: ${invalid.join(', ')}` },
        { status: 400 }
      )
    }

    const job = await prisma.job.create({
      data: {
        sheetUrl: '',
        products: {
          create: urls.map((url) => ({
            sourceUrl: url,
            type: detectType(url)!,
            pipelineSteps: {
              create: [1, 2, 3, 4, 5].map((step) => ({ step })),
            },
          })),
        },
      },
      include: { products: true },
    })

    return NextResponse.json({
      jobId: job.id,
      products: job.products.map((p) => ({ id: p.id, url: p.sourceUrl, type: p.type })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

// ─── GET — list all jobs ──────────────────────────────────────────────────────

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        products: { include: { pipelineSteps: true, creatives: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ jobs })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
