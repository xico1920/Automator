import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import { getProductById } from './shopify'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BackgroundCheckResult {
  hasWhiteBackground: boolean
  nonWhiteRatio: number // 0-1, percentage of border pixels that are not white
}

export interface ProcessedImage {
  buffer: Buffer
  filename: string
  width: number
  height: number
}

export type CreativeType = 'single_image' | 'collage' | 'carousel' | 'video'

export interface DownloadedImage {
  id: string
  originalPath: string
  processedPath: string
  filename: string
  width: number
  height: number
  sizeBytes: number
  type: CreativeType
  sourceUrl: string
}

// ─── Background detection ─────────────────────────────────────────────────────

/**
 * Checks if an image has a white background by sampling the border pixels.
 * Threshold: if more than 15% of border pixels are not white (RGB < 240), returns false.
 */
export async function checkWhiteBackground(imageBuffer: Buffer): Promise<BackgroundCheckResult> {
  const image = sharp(imageBuffer)
  const { width, height } = await image.metadata()

  if (!width || !height) {
    return { hasWhiteBackground: false, nonWhiteRatio: 1 }
  }

  // Extract raw RGB pixels
  const { data } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = 4 // RGBA
  let borderPixelCount = 0
  let nonWhiteCount = 0

  function checkPixel(x: number, y: number) {
    const idx = (y * width + x) * channels
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const a = data[idx + 3]

    borderPixelCount++
    // Ignore transparent pixels
    if (a < 10) return
    if (r < 240 || g < 240 || b < 240) {
      nonWhiteCount++
    }
  }

  // Sample top and bottom rows
  for (let x = 0; x < width; x++) {
    checkPixel(x, 0)
    checkPixel(x, height - 1)
  }

  // Sample left and right columns (skip corners already sampled)
  for (let y = 1; y < height - 1; y++) {
    checkPixel(0, y)
    checkPixel(width - 1, y)
  }

  const nonWhiteRatio = borderPixelCount > 0 ? nonWhiteCount / borderPixelCount : 0
  const THRESHOLD = 0.15

  return {
    hasWhiteBackground: nonWhiteRatio <= THRESHOLD,
    nonWhiteRatio,
  }
}

// ─── EXIF removal ─────────────────────────────────────────────────────────────

export async function removeExif(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .withMetadata({}) // strips all EXIF/metadata by passing empty object
    .toBuffer()
}

// ─── Download image ───────────────────────────────────────────────────────────

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download image: ${res.status} ${url}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── Process and save image ───────────────────────────────────────────────────

export async function processAndSaveImage(
  imageUrl: string,
  outputDir: string,
  filename: string
): Promise<ProcessedImage> {
  await fs.mkdir(outputDir, { recursive: true })

  const rawBuffer = await downloadImage(imageUrl)
  const cleanBuffer = await removeExif(rawBuffer)

  const { width, height } = await sharp(cleanBuffer).metadata()
  const outputPath = path.join(outputDir, filename)
  await fs.writeFile(outputPath, cleanBuffer)

  return {
    buffer: cleanBuffer,
    filename,
    width: width ?? 0,
    height: height ?? 0,
  }
}

// ─── Remove.bg integration ────────────────────────────────────────────────────

export async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  const apiKey = process.env.REMOVEBG_API_KEY
  if (!apiKey) throw new Error('REMOVEBG_API_KEY not set')

  const formData = new FormData()
  // Copy to a clean ArrayBuffer to satisfy strict TypeScript BlobPart types
  const cleanBuffer = imageBuffer.buffer.slice(
    imageBuffer.byteOffset,
    imageBuffer.byteOffset + imageBuffer.byteLength
  ) as ArrayBuffer
  const blob = new Blob([cleanBuffer], { type: 'image/jpeg' })
  formData.append('image_file', blob, 'image.jpg')
  formData.append('size', 'auto')
  formData.append('bg_color', 'ffffff') // white background

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: formData,
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Remove.bg error ${res.status}: ${error}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── Count images in HTML ─────────────────────────────────────────────────────

export function countImagesInHtml(html: string): number {
  const matches = html.match(/<img[^>]+>/gi)
  return matches ? matches.length : 0
}

// ─── Ensure creatives dir ─────────────────────────────────────────────────────

export function getCreativesDir(productId: string): string {
  return path.join('/tmp', 'creatives', productId)
}

// ─── Creative type classification ────────────────────────────────────────────

export async function classifyCreativeType(imagePath: string): Promise<CreativeType> {
  const meta = await sharp(imagePath).metadata()
  const w = meta.width ?? 1
  const h = meta.height ?? 1
  const ratio = w / h

  // Panoramic / wide → carousel
  if (ratio > 2.5) return 'carousel'

  // Multi-panel collage heuristic: analyze horizontal variance in a middle strip
  // Sample a horizontal slice at 50% height and check for strong vertical color boundaries
  const stripHeight = Math.max(1, Math.floor(h * 0.1))
  const stripTop = Math.floor(h * 0.45)

  const { data } = await sharp(imagePath)
    .extract({ left: 0, top: stripTop, width: w, height: stripHeight })
    .resize(Math.min(w, 200), stripHeight, { fit: 'fill' }) // downsample for speed
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const sampleWidth = Math.min(w, 200)
  let transitions = 0
  let prevBrightness = -1

  for (let x = 0; x < sampleWidth; x++) {
    const idx = x * 4
    const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
    if (prevBrightness >= 0 && Math.abs(brightness - prevBrightness) > 80) {
      transitions++
    }
    prevBrightness = brightness
  }

  // Many abrupt transitions suggest a collage with distinct panels
  if (transitions > 6) return 'collage'

  return 'single_image'
}

// ─── Batch download product images ───────────────────────────────────────────

export async function downloadProductImages(
  shopifyProductId: string,
  productId: string
): Promise<DownloadedImage[]> {
  const shopifyProduct = await getProductById(shopifyProductId)
  if (!shopifyProduct) throw new Error(`Shopify product ${shopifyProductId} not found`)

  const originalDir = path.join(getCreativesDir(productId), 'original')
  const processedDir = path.join(getCreativesDir(productId), 'processed')
  await fs.mkdir(originalDir, { recursive: true })
  await fs.mkdir(processedDir, { recursive: true })

  const results: DownloadedImage[] = []

  for (const image of shopifyProduct.images) {
    const ext = path.extname(new URL(image.src).pathname) || '.jpg'
    const filename = `${image.position ?? results.length + 1}${ext}`
    const originalPath = path.join(originalDir, filename)
    const processedPath = path.join(processedDir, filename)

    // Download raw
    const rawBuffer = await downloadImage(image.src)
    await fs.writeFile(originalPath, rawBuffer)

    // Process: strip EXIF
    const cleanBuffer = await removeExif(rawBuffer)
    await fs.writeFile(processedPath, cleanBuffer)

    const stat = await fs.stat(processedPath)
    const meta = await sharp(processedPath).metadata()

    const type = await classifyCreativeType(processedPath)

    results.push({
      id: uuidv4(),
      originalPath,
      processedPath,
      filename,
      width: meta.width ?? image.width ?? 0,
      height: meta.height ?? image.height ?? 0,
      sizeBytes: stat.size,
      type,
      sourceUrl: image.src,
    })
  }

  return results
}

// ─── Check processed images still exist on disk ───────────────────────────────

export async function processedImageExists(localPath: string): Promise<boolean> {
  try {
    await fs.access(localPath)
    return true
  } catch {
    return false
  }
}

// ─── Validate creative minimums ───────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  counts: Record<CreativeType, number>
  total: number
  missing: string[]
}

export function validateCreativeMinimums(
  selected: { type: string }[],
  productType: string
): ValidationResult {
  const counts: Record<CreativeType, number> = {
    single_image: 0,
    collage: 0,
    carousel: 0,
    video: 0,
  }

  for (const c of selected) {
    const t = c.type as CreativeType
    if (t in counts) counts[t]++
  }

  const total = selected.length
  const uniqueTypes = (Object.keys(counts) as CreativeType[]).filter((k) => counts[k] > 0).length
  const missing: string[] = []

  if (productType === 'collection') {
    if (total < 9) missing.push(`${9 - total} criativos em falta (mínimo 9)`)
    if (uniqueTypes < 3) missing.push(`Precisa de pelo menos 3 tipos diferentes (tens ${uniqueTypes})`)
  } else {
    if (total < 4) missing.push(`${4 - total} criativos em falta (mínimo 4)`)
    if (uniqueTypes < 2) missing.push(`Precisa de pelo menos 2 tipos diferentes (tens ${uniqueTypes})`)
  }

  return { valid: missing.length === 0, counts, total, missing }
}
