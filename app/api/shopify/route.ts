import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getProductByHandle,
  getProductById,
  updateProduct,
  updateProductImage,
  addProductImage,
  deleteProductImage,
  extractHandle,
} from '@/lib/shopify'
import {
  evaluateDescriptionQuality,
  rewriteDescription,
} from '@/lib/claude'
import {
  checkWhiteBackground,
  removeBackground,
  downloadImage,
  countImagesInHtml,
} from '@/lib/images'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValidationResult {
  productId: string
  shopifyProductId: string
  title: string
  descriptionQuality: {
    isGood: boolean
    score: number
    reason: string
  }
  backgroundCheck: {
    hasWhiteBackground: boolean
    nonWhiteRatio: number
  }
  imageCount: number
  imageCountInDescription: number
  changes: {
    descriptionRewritten: boolean
    backgroundRemoved: boolean
  }
  newDescription?: string
  originalDescription?: string
}

// ─── Helper: append log to PipelineStep ──────────────────────────────────────

async function appendLog(productId: string, step: number, message: string) {
  const ps = await prisma.pipelineStep.findFirst({ where: { productId, step } })
  if (!ps) return
  const logs: string[] = ps.logs ? (JSON.parse(ps.logs) as string[]) : []
  logs.push(`[${new Date().toISOString()}] ${message}`)
  await prisma.pipelineStep.update({
    where: { id: ps.id },
    data: { logs: JSON.stringify(logs) },
  })
}

async function setStepStatus(productId: string, step: number, status: string, error?: string) {
  await prisma.pipelineStep.updateMany({
    where: { productId, step },
    data: { status, ...(error ? { error } : {}) },
  })
}

// ─── GET — fetch product from Shopify and validate ────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    await setStepStatus(productId, 3, 'running')
    await appendLog(productId, 3, 'Iniciando validação do produto no Shopify...')

    // Resolve Shopify product
    let shopifyProduct = null

    if (product.shopifyId) {
      await appendLog(productId, 3, `Buscando produto por ID: ${product.shopifyId}`)
      shopifyProduct = await getProductById(product.shopifyId)
    }

    if (!shopifyProduct) {
      const handle = product.shopifyHandle ?? extractHandle(product.sourceUrl)
      if (handle) {
        await appendLog(productId, 3, `Buscando produto por handle: ${handle}`)
        shopifyProduct = await getProductByHandle(handle)
      }
    }

    if (!shopifyProduct) {
      await setStepStatus(productId, 3, 'failed', 'Produto não encontrado no Shopify')
      return NextResponse.json({ error: 'Shopify product not found' }, { status: 404 })
    }

    await appendLog(productId, 3, `Produto encontrado: "${shopifyProduct.title}" (ID: ${shopifyProduct.id})`)

    // Update product record with Shopify info
    await prisma.product.update({
      where: { id: productId },
      data: {
        shopifyId: String(shopifyProduct.id),
        shopifyHandle: shopifyProduct.handle,
        title: shopifyProduct.title,
        description: shopifyProduct.body_html,
      },
    })

    // 1. Evaluate description quality
    await appendLog(productId, 3, 'Avaliando qualidade da descrição com Claude Haiku...')
    const descQuality = await evaluateDescriptionQuality(
      shopifyProduct.body_html,
      shopifyProduct.title
    )
    await appendLog(
      productId,
      3,
      `Qualidade da descrição: ${descQuality.score}/10 — ${descQuality.reason}`
    )

    // 2. Check first image background
    const firstImage = shopifyProduct.images[0]
    let bgCheck = { hasWhiteBackground: true, nonWhiteRatio: 0 }
    let backgroundRemoved = false

    if (firstImage) {
      await appendLog(productId, 3, `Verificando fundo da primeira imagem: ${firstImage.src}`)
      const imageBuffer = await downloadImage(firstImage.src)
      bgCheck = await checkWhiteBackground(imageBuffer)
      await appendLog(
        productId,
        3,
        `Fundo branco: ${bgCheck.hasWhiteBackground} (${Math.round(bgCheck.nonWhiteRatio * 100)}% pixels não-brancos)`
      )

      if (!bgCheck.hasWhiteBackground) {
        await appendLog(productId, 3, 'Fundo não branco detetado — chamando Remove.bg...')
        const cleanBuffer = await removeBackground(imageBuffer)
        await updateProductImage(
          String(shopifyProduct.id),
          String(firstImage.id),
          cleanBuffer,
          `${shopifyProduct.handle}-clean.png`
        )
        backgroundRemoved = true
        await appendLog(productId, 3, 'Fundo removido e imagem atualizada no Shopify.')
      }
    }

    // 3. Check image count in description HTML
    const imageCountInDesc = countImagesInHtml(shopifyProduct.body_html)
    await appendLog(productId, 3, `Imagens na descrição HTML: ${imageCountInDesc}`)

    // 4. Rewrite description if needed
    let descriptionRewritten = false
    let newDescription: string | undefined

    if (!descQuality.isGood || descQuality.score < 6) {
      await appendLog(productId, 3, 'Descrição fraca — reescrevendo com Claude Sonnet...')
      const rewritten = await rewriteDescription(
        shopifyProduct.body_html,
        shopifyProduct.title,
        shopifyProduct.product_type
      )
      newDescription = rewritten.html
      descriptionRewritten = true
      await appendLog(productId, 3, 'Descrição reescrita com sucesso.')
    }

    // Compose result for human review
    const result: ValidationResult = {
      productId,
      shopifyProductId: String(shopifyProduct.id),
      title: shopifyProduct.title,
      descriptionQuality: descQuality,
      backgroundCheck: bgCheck,
      imageCount: shopifyProduct.images.length,
      imageCountInDescription: imageCountInDesc,
      changes: { descriptionRewritten, backgroundRemoved },
      ...(descriptionRewritten
        ? {
            originalDescription: shopifyProduct.body_html,
            newDescription,
          }
        : {}),
    }

    // Save result to PipelineStep data
    await prisma.pipelineStep.updateMany({
      where: { productId, step: 3 },
      data: {
        status: 'awaiting_approval',
        data: JSON.stringify(result),
      },
    })

    await appendLog(productId, 3, 'Validação concluída — aguarda aprovação humana.')

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await setStepStatus(productId, 3, 'failed', message).catch(() => {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST — apply approved changes to Shopify ────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      productId: string
      shopifyProductId: string
      applyDescription: boolean
      newDescription?: string
    }

    const { productId, shopifyProductId, applyDescription, newDescription } = body

    await appendLog(productId, 3, 'Aplicando alterações aprovadas no Shopify...')

    if (applyDescription && newDescription) {
      await updateProduct(shopifyProductId, { body_html: newDescription })
      await prisma.product.update({
        where: { id: productId },
        data: { description: newDescription },
      })
      await appendLog(productId, 3, 'Descrição atualizada no Shopify.')
    }

    // Mark step as approved
    await prisma.pipelineStep.updateMany({
      where: { productId, step: 3 },
      data: { status: 'approved' },
    })
    await prisma.product.update({
      where: { id: productId },
      data: { currentStep: 4 },
    })

    await appendLog(productId, 3, 'Etapa 3 concluída.')
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
