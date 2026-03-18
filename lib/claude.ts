import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DescriptionQuality {
  isGood: boolean
  reason: string
  score: number // 1-10
}

export interface RewrittenDescription {
  html: string
  plainText: string
}

export interface AdCopyVariant {
  title: string       // max ~40 chars
  description: string // max ~125 chars
}

export interface AdCopyVariants {
  variantes: Array<{
    titulo: string    // max 40 chars
    descripcion: string // max 125 chars
  }>
}

// ─── Haiku: evaluate description quality ─────────────────────────────────────

export async function evaluateDescriptionQuality(
  description: string,
  productTitle: string
): Promise<DescriptionQuality> {
  const plainText = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Evalúa la calidad de esta descripción de producto para una tienda online en español.

Producto: "${productTitle}"
Descripción: "${plainText.slice(0, 1500)}"

Responde SOLO con JSON válido, sin explicaciones adicionales:
{"isGood": true/false, "score": 1-10, "reason": "motivo breve"}

Criterios: tiene copy persuasivo (beneficios, no solo specs), está en español, tiene al menos 50 palabras útiles, no es solo una lista de características técnicas.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[^}]+\}/)
  if (!jsonMatch) {
    return { isGood: false, reason: 'No se pudo evaluar', score: 0 }
  }

  return JSON.parse(jsonMatch[0]) as DescriptionQuality
}

// ─── Sonnet: rewrite description ─────────────────────────────────────────────

export async function rewriteDescription(
  originalDescription: string,
  productTitle: string,
  productType: string
): Promise<RewrittenDescription> {
  const plainText = originalDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Reescribe la descripción de este producto para una tienda de dropshipping en español.
El tono debe ser persuasivo, enfocado en beneficios, y adecuado para anuncios de Meta Ads.

Producto: "${productTitle}"
Tipo: "${productType}"
Descripción original: "${plainText.slice(0, 2000)}"

Reglas:
- Escribe en español de España
- 150-300 palabras
- Empieza con un beneficio principal, no con el nombre del producto
- Incluye 3-5 bullet points con beneficios clave (usa •)
- Termina con una llamada a la acción suave
- Devuelve SOLO el HTML con párrafos <p> y listas <ul><li>, sin más texto`,
      },
    ],
  })

  const html = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const plainTextResult = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  return { html, plainText: plainTextResult }
}

// ─── Sonnet: generate ad copy variants ───────────────────────────────────────

export async function generateAdCopyVariants(
  productTitle: string,
  description: string,
  productType: 'single_product' | 'collection'
): Promise<[AdCopyVariant, AdCopyVariant]> {
  const plainText = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Genera 2 variantes de copy para un anuncio de Meta Ads en español para este producto.

Producto: "${productTitle}"
Tipo: ${productType === 'collection' ? 'colección de productos' : 'producto individual'}
Descripción: "${plainText.slice(0, 1000)}"

Reglas:
- Título: máximo 40 caracteres, directo, con beneficio o curiosidad
- Descripción: máximo 125 caracteres, persuasiva, con llamada a la acción
- Las 2 variantes deben ser claramente diferentes en enfoque
- Español de España, sin emojis

Devuelve SOLO JSON válido:
[
  {"title": "...", "description": "..."},
  {"title": "...", "description": "..."}
]`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('No se pudo generar el copy del anuncio')
  }

  const variants = JSON.parse(jsonMatch[0]) as AdCopyVariant[]
  return [variants[0], variants[1]]
}

// ─── Sonnet: generate structured ad copy (Etapa 5) ───────────────────────────

export async function generateAdCopy(
  productTitle: string,
  description: string,
  productType: 'single_product' | 'collection'
): Promise<AdCopyVariants> {
  const plainText = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Eres un experto en publicidad digital para tiendas de dropshipping en España.
Genera exactamente 2 variantes de copy para un anuncio de Meta Ads (Facebook/Instagram).

Producto: "${productTitle}"
Tipo: ${productType === 'collection' ? 'colección de productos' : 'producto individual'}
Descripción: "${plainText.slice(0, 1200)}"

Reglas estrictas:
- Español de España (no latinoamérica)
- titulo: MÁXIMO 40 caracteres, directo, con beneficio concreto o pregunta gancho
- descripcion: MÁXIMO 125 caracteres, persuasiva, con llamada a la acción clara
- Las 2 variantes deben tener enfoques DIFERENTES (ej: una con beneficio racional, otra emocional)
- Máximo 1 emoji por variante, solo si aporta valor
- NO usar "¡" ni "!" en exceso
- NO mencionar el precio

Responde ÚNICAMENTE con este JSON exacto, sin markdown, sin explicaciones:
{"variantes":[{"titulo":"...","descripcion":"..."},{"titulo":"...","descripcion":"..."}]}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude não gerou JSON de copy válido')

  return JSON.parse(jsonMatch[0]) as AdCopyVariants
}
