import fs from 'fs/promises'
import path from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────

const META_API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

function getToken() {
  const t = process.env.META_ACCESS_TOKEN
  if (!t) throw new Error('META_ACCESS_TOKEN não configurado')
  return t
}
function getAdAccountId() {
  const id = process.env.META_AD_ACCOUNT_ID
  if (!id) throw new Error('META_AD_ACCOUNT_ID não configurado')
  return id
}
function getPageId() {
  const id = process.env.META_PAGE_ID
  if (!id) throw new Error('META_PAGE_ID não configurado')
  return id
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetaApiError {
  code: number
  message: string
  error_subcode?: number
  type?: string
}

export interface CreateCampaignParams {
  name: string
  objective?: string
}

export interface CreateAdSetParams {
  name: string
  campaignId: string
  dailyBudget: number // centimos: 5177 = 51.77€
  startTime: string   // ISO 8601
}

export interface AdCreativeLinkData {
  imageHash: string
  link: string
  message: string
  name: string
}

export interface AdCreativeCarouselChild {
  link: string
  imageHash: string
  name: string
}

export interface CreateAdCreativeParams {
  name: string
  type: 'single_image' | 'carousel'
  link: string
  message: string
  title: string
  imageHash?: string
  carouselItems?: AdCreativeCarouselChild[]
}

export interface CreateAdParams {
  name: string
  adsetId: string
  creativeId: string
}

export interface CampaignIds {
  campaignId: string
  adsetId: string
  adIds: string[]
  adManagerUrl: string
}

// ─── Meta API error parser ────────────────────────────────────────────────────

function parseMetaError(body: unknown): MetaApiError | null {
  if (
    body !== null &&
    typeof body === 'object' &&
    'error' in body &&
    body.error !== null &&
    typeof body.error === 'object'
  ) {
    return body.error as MetaApiError
  }
  return null
}

// ─── Core fetch with retry on rate-limit ─────────────────────────────────────

async function metaFetch<T>(
  url: string,
  options: RequestInit = {},
  attempt = 0
): Promise<T> {
  const res = await fetch(url, options)
  const body = await res.json() as T

  if (!res.ok) {
    const metaError = parseMetaError(body)
    if (metaError) {
      // Rate limit — exponential backoff
      if (metaError.code === 17 && attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((r) => setTimeout(r, delay))
        return metaFetch<T>(url, options, attempt + 1)
      }
      // Token expired
      if (metaError.code === 190) {
        throw new Error(`Token Meta expirado ou inválido. Renova o META_ACCESS_TOKEN. (${metaError.message})`)
      }
      throw new Error(`Meta API erro ${metaError.code}: ${metaError.message}`)
    }
    throw new Error(`Meta API HTTP ${res.status}`)
  }

  return body
}

// ─── Upload image ─────────────────────────────────────────────────────────────

export async function uploadCreativeImage(imagePath: string): Promise<string> {
  const adAccountId = getAdAccountId()
  const token = getToken()

  const buffer = await fs.readFile(imagePath)
  const filename = path.basename(imagePath)

  const form = new FormData()
  const cleanBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer
  const blob = new Blob([cleanBuffer], { type: 'image/jpeg' })
  form.append('filename', blob, filename)
  form.append('access_token', token)

  const data = await metaFetch<{ images: Record<string, { hash: string }> }>(
    `${BASE_URL}/${adAccountId}/adimages`,
    { method: 'POST', body: form }
  )

  const imageData = Object.values(data.images)[0]
  if (!imageData?.hash) throw new Error('Meta não devolveu image_hash')
  return imageData.hash
}

// ─── Upload video ─────────────────────────────────────────────────────────────

export async function uploadCreativeVideo(videoPath: string): Promise<string> {
  const adAccountId = getAdAccountId()
  const token = getToken()

  const buffer = await fs.readFile(videoPath)
  const filename = path.basename(videoPath)

  const form = new FormData()
  const cleanBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer
  const blob = new Blob([cleanBuffer], { type: 'video/mp4' })
  form.append('source', blob, filename)
  form.append('access_token', token)

  const data = await metaFetch<{ id: string }>(
    `${BASE_URL}/${adAccountId}/advideos`,
    { method: 'POST', body: form }
  )

  if (!data.id) throw new Error('Meta não devolveu video_id')
  return data.id
}

// ─── Create campaign ──────────────────────────────────────────────────────────

export async function createCampaign(params: CreateCampaignParams): Promise<string> {
  const adAccountId = getAdAccountId()
  const token = getToken()

  const body = new URLSearchParams({
    name: params.name,
    objective: params.objective ?? 'OUTCOME_TRAFFIC',
    status: 'PAUSED',
    special_ad_categories: '[]',
    access_token: token,
  })

  const data = await metaFetch<{ id: string }>(
    `${BASE_URL}/${adAccountId}/campaigns`,
    { method: 'POST', body }
  )

  return data.id
}

// ─── Create ad set ────────────────────────────────────────────────────────────

export async function createAdSet(params: CreateAdSetParams): Promise<string> {
  const adAccountId = getAdAccountId()
  const token = getToken()

  const targeting = JSON.stringify({
    geo_locations: { countries: ['ES'] },
    age_min: 18,
    age_max: 65,
  })

  const body = new URLSearchParams({
    name: params.name,
    campaign_id: params.campaignId,
    daily_budget: String(params.dailyBudget),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LINK_CLICKS',
    targeting,
    status: 'PAUSED',
    start_time: params.startTime,
    access_token: token,
  })

  const data = await metaFetch<{ id: string }>(
    `${BASE_URL}/${adAccountId}/adsets`,
    { method: 'POST', body }
  )

  return data.id
}

// ─── Create ad creative ───────────────────────────────────────────────────────

export async function createAdCreative(params: CreateAdCreativeParams): Promise<string> {
  const adAccountId = getAdAccountId()
  const token = getToken()
  const pageId = getPageId()

  let linkData: Record<string, unknown>

  if (params.type === 'carousel' && params.carouselItems?.length) {
    linkData = {
      child_attachments: params.carouselItems.map((item) => ({
        link: item.link,
        image_hash: item.imageHash,
        name: item.name,
      })),
      message: params.message,
      link: params.link,
      call_to_action: { type: 'SHOP_NOW' },
    }
  } else {
    linkData = {
      image_hash: params.imageHash,
      link: params.link,
      message: params.message,
      name: params.title,
      call_to_action: { type: 'SHOP_NOW' },
    }
  }

  const objectStorySpec = JSON.stringify({
    page_id: pageId,
    link_data: linkData,
  })

  const body = new URLSearchParams({
    name: params.name,
    object_story_spec: objectStorySpec,
    access_token: token,
  })

  const data = await metaFetch<{ id: string }>(
    `${BASE_URL}/${adAccountId}/adcreatives`,
    { method: 'POST', body }
  )

  return data.id
}

// ─── Create ad ────────────────────────────────────────────────────────────────

export async function createAd(params: CreateAdParams): Promise<string> {
  const adAccountId = getAdAccountId()
  const token = getToken()

  const body = new URLSearchParams({
    name: params.name,
    adset_id: params.adsetId,
    creative: JSON.stringify({ creative_id: params.creativeId }),
    status: 'PAUSED',
    access_token: token,
  })

  const data = await metaFetch<{ id: string }>(
    `${BASE_URL}/${adAccountId}/ads`,
    { method: 'POST', body }
  )

  return data.id
}

// ─── Publish (PAUSED → ACTIVE) ────────────────────────────────────────────────

export async function publishAdSet(adsetId: string): Promise<void> {
  const token = getToken()
  const body = new URLSearchParams({ status: 'ACTIVE', access_token: token })
  await metaFetch(`${BASE_URL}/${adsetId}`, { method: 'POST', body })
}

export async function publishAd(adId: string): Promise<void> {
  const token = getToken()
  const body = new URLSearchParams({ status: 'ACTIVE', access_token: token })
  await metaFetch(`${BASE_URL}/${adId}`, { method: 'POST', body })
}

// ─── Calculate start time (Lisboa UTC+1 / UTC+2 DST) ─────────────────────────

export function calculateStartTime(): string {
  const now = new Date()

  // Lisboa offset: UTC+1 standard, UTC+2 DST (last Sunday March → last Sunday October)
  const month = now.getUTCMonth() + 1 // 1-12
  const isDST = month >= 4 && month <= 10 // approximate: April–October
  const lisbonOffsetHours = isDST ? 2 : 1

  // Current time in Lisboa
  const lisbonMs = now.getTime() + lisbonOffsetHours * 60 * 60 * 1000
  const lisbonNow = new Date(lisbonMs)

  const lisbonHour = lisbonNow.getUTCHours()
  const lisbonMinute = lisbonNow.getUTCMinutes()

  // If already past 04:00 Lisboa, start tomorrow at 00:01
  // If before 04:00, start today at 00:01
  const startLisbon = new Date(lisbonNow)
  startLisbon.setUTCHours(0, 1, 0, 0)

  if (lisbonHour >= 4 || (lisbonHour === 4 && lisbonMinute > 0)) {
    startLisbon.setUTCDate(startLisbon.getUTCDate() + 1)
  }

  // Convert back to UTC for Meta API
  const startUtc = new Date(startLisbon.getTime() - lisbonOffsetHours * 60 * 60 * 1000)
  return startUtc.toISOString()
}

// ─── Ad Manager URL ───────────────────────────────────────────────────────────

export function getAdManagerUrl(campaignId: string): string {
  const adAccountId = getAdAccountId().replace('act_', '')
  return `https://www.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}&selected_campaign_ids=${campaignId}`
}
