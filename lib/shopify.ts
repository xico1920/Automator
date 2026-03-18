const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN!
const SHOPIFY_VERSION = process.env.SHOPIFY_API_VERSION ?? '2024-01'

const BASE_URL = `https://${SHOPIFY_DOMAIN}/admin/api/${SHOPIFY_VERSION}`

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShopifyImage {
  id: number
  src: string
  alt: string | null
  width: number
  height: number
  position: number
}

export interface ShopifyProduct {
  id: number
  title: string
  handle: string
  body_html: string
  status: string
  images: ShopifyImage[]
  variants: ShopifyVariant[]
  tags: string
  vendor: string
  product_type: string
}

export interface ShopifyVariant {
  id: number
  title: string
  price: string
  compare_at_price: string | null
  sku: string
}

export interface ShopifyProductUpdate {
  title?: string
  body_html?: string
  status?: string
  tags?: string
}

// ─── Client ──────────────────────────────────────────────────────────────────

async function shopifyFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Shopify ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function getProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  try {
    const data = await shopifyFetch<{ product: ShopifyProduct }>(
      `/products.json?handle=${handle}&fields=id,title,handle,body_html,status,images,variants,tags,vendor,product_type`
    )
    return data.product ?? null
  } catch {
    return null
  }
}

export async function getProductById(id: string): Promise<ShopifyProduct | null> {
  try {
    const data = await shopifyFetch<{ product: ShopifyProduct }>(`/products/${id}.json`)
    return data.product ?? null
  } catch {
    return null
  }
}

export async function updateProduct(
  id: string,
  updates: ShopifyProductUpdate
): Promise<ShopifyProduct> {
  const data = await shopifyFetch<{ product: ShopifyProduct }>(`/products/${id}.json`, {
    method: 'PUT',
    body: JSON.stringify({ product: updates }),
  })
  return data.product
}

export async function updateProductImage(
  productId: string,
  imageId: string,
  imageBuffer: Buffer,
  filename: string
): Promise<ShopifyImage> {
  const base64 = imageBuffer.toString('base64')
  const data = await shopifyFetch<{ image: ShopifyImage }>(
    `/products/${productId}/images/${imageId}.json`,
    {
      method: 'PUT',
      body: JSON.stringify({
        image: {
          id: parseInt(imageId),
          attachment: base64,
          filename,
        },
      }),
    }
  )
  return data.image
}

export async function addProductImage(
  productId: string,
  imageBuffer: Buffer,
  filename: string,
  position: number = 1
): Promise<ShopifyImage> {
  const base64 = imageBuffer.toString('base64')
  const data = await shopifyFetch<{ image: ShopifyImage }>(
    `/products/${productId}/images.json`,
    {
      method: 'POST',
      body: JSON.stringify({
        image: { attachment: base64, filename, position },
      }),
    }
  )
  return data.image
}

export async function deleteProductImage(productId: string, imageId: string): Promise<void> {
  await shopifyFetch(`/products/${productId}/images/${imageId}.json`, { method: 'DELETE' })
}

/** Extracts handle from a Shopify product URL */
export function extractHandle(url: string): string | null {
  const match = url.match(/\/products\/([^/?#]+)/)
  return match ? match[1] : null
}
