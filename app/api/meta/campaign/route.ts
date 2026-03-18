import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  uploadCreativeImage,
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  calculateStartTime,
  getAdManagerUrl,
} from '@/lib/meta'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function appendLog(productId: string, message: string) {
  const ps = await prisma.pipelineStep.findFirst({ where: { productId, step: 5 } })
  if (!ps) return
  const logs: string[] = ps.logs ? (JSON.parse(ps.logs) as string[]) : []
  logs.push(`[${new Date().toISOString()}] ${message}`)
  await prisma.pipelineStep.update({ where: { id: ps.id }, data: { logs: JSON.stringify(logs) } })
}

// ─── POST — create full campaign ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { productId, selectedCopyVariantIndex, copyOverride } = await req.json() as {
      productId: string
      selectedCopyVariantIndex: number
      copyOverride?: { titulo: string; descripcion: string }
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { creatives: { where: { selected: true } } },
    })
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    if (!product.shopifyId) return NextResponse.json({ error: 'shopifyId em falta' }, { status: 400 })

    // Load saved copy from step data
    const stepRow = await prisma.pipelineStep.findFirst({ where: { productId, step: 5 } })
    const stepData = stepRow?.data ? JSON.parse(stepRow.data) as {
      variantes?: Array<{ titulo: string; descripcion: string }>
    } : {}

    const variant = copyOverride ?? stepData.variantes?.[selectedCopyVariantIndex]
    if (!variant) return NextResponse.json({ error: 'Variante de copy não encontrada' }, { status: 400 })

    await prisma.pipelineStep.updateMany({
      where: { productId, step: 5 },
      data: { status: 'running' },
    })

    const productUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN}/products/${product.shopifyHandle ?? ''}`
    const dateStr = new Date().toISOString().slice(0, 10)
    const typeTag = product.type === 'collection' ? 'COL' : 'SP'
    const productTitle = product.title ?? 'Producto'
    const dailyBudget = product.type === 'collection' ? 15000 : 5177
    const startTime = calculateStartTime()

    // ── 1. Upload creatives ──
    await appendLog(productId, `A fazer upload de ${product.creatives.length} criativos para o Meta...`)

    const uploadedImages: Array<{ creativeId: string; imageHash: string; type: string }> = []
    for (let i = 0; i < product.creatives.length; i++) {
      const creative = product.creatives[i]
      try {
        await appendLog(productId, `Upload ${i + 1}/${product.creatives.length}: ${creative.type}`)
        const localPath = creative.localPath
        if (!localPath) {
          await appendLog(productId, `  ⚠ Sem localPath — a usar URL do Shopify`)
          continue
        }
        const imageHash = await uploadCreativeImage(localPath)
        uploadedImages.push({ creativeId: creative.id, imageHash, type: creative.type })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await appendLog(productId, `  ❌ Falhou upload do criativo ${creative.id}: ${msg}`)
        // Continue with remaining creatives
      }
    }

    if (uploadedImages.length === 0) {
      throw new Error('Nenhum criativo foi carregado com sucesso para o Meta')
    }
    await appendLog(productId, `${uploadedImages.length} criativos carregados com sucesso.`)

    // ── 2. Create campaign ──
    await appendLog(productId, 'A criar Campaign...')
    const campaignName = `[ES] ${productTitle} — ${typeTag} — ${dateStr}`
    const campaignId = await createCampaign({ name: campaignName })
    await appendLog(productId, `Campaign criada: ${campaignId}`)

    // ── 3. Create ad set ──
    await appendLog(productId, 'A criar Ad Set...')
    const adsetName = `[ES] ${productTitle} — AdSet`
    const adsetId = await createAdSet({
      name: adsetName,
      campaignId,
      dailyBudget,
      startTime,
    })
    await appendLog(productId, `Ad Set criado: ${adsetId}`)

    // ── 4. Create ads ──
    await appendLog(productId, `A criar ${uploadedImages.length} Ads...`)
    const adIds: string[] = []

    // Group carousel images together
    const carouselImages = uploadedImages.filter((u) => u.type === 'carousel')
    const nonCarouselImages = uploadedImages.filter((u) => u.type !== 'carousel')

    // Single-image ads
    for (let i = 0; i < nonCarouselImages.length; i++) {
      const img = nonCarouselImages[i]
      try {
        const adName = `[ES] ${productTitle} — ${img.type} — ${i + 1}`
        await appendLog(productId, `  Ad ${i + 1}/${nonCarouselImages.length}: ${adName}`)

        const creativeId = await createAdCreative({
          name: `${adName} Creative`,
          type: 'single_image',
          link: productUrl,
          message: variant.descripcion,
          title: variant.titulo,
          imageHash: img.imageHash,
        })

        const adId = await createAd({ name: adName, adsetId, creativeId })
        adIds.push(adId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await appendLog(productId, `  ❌ Falhou criação do Ad: ${msg}`)
      }
    }

    // Carousel ad (all carousel images grouped into one)
    if (carouselImages.length >= 2) {
      try {
        const adName = `[ES] ${productTitle} — carousel — 1`
        await appendLog(productId, `  Ad carousel: ${adName}`)

        const creativeId = await createAdCreative({
          name: `${adName} Creative`,
          type: 'carousel',
          link: productUrl,
          message: variant.descripcion,
          title: variant.titulo,
          carouselItems: carouselImages.map((img, idx) => ({
            link: productUrl,
            imageHash: img.imageHash,
            name: `${variant.titulo} ${idx + 1}`,
          })),
        })

        const adId = await createAd({ name: adName, adsetId, creativeId })
        adIds.push(adId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await appendLog(productId, `  ❌ Falhou criação do Ad carousel: ${msg}`)
      }
    }

    await appendLog(productId, `${adIds.length} Ads criados com sucesso. Todos em PAUSED.`)

    const adManagerUrl = getAdManagerUrl(campaignId)

    // ── 5. Persist to DB ──
    await prisma.product.update({
      where: { id: productId },
      data: { metaCampaignId: campaignId, metaAdSetId: adsetId },
    })

    const result = {
      campaignId,
      adsetId,
      adIds,
      adManagerUrl,
      startTime,
      dailyBudget,
      campaignName,
      copyUsed: variant,
      totalCreatives: uploadedImages.length,
    }

    await prisma.pipelineStep.updateMany({
      where: { productId, step: 5 },
      data: {
        status: 'awaiting_approval',
        data: JSON.stringify({ ...stepData, ...result }),
      },
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await prisma.pipelineStep.updateMany({
      where: { step: 5 },
      data: { status: 'failed', error: message },
    }).catch(() => null)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
