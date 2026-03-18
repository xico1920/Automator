import { chromium, type Browser, type BrowserContext, type Page, type BrowserContextOptions } from 'playwright'
import path from 'path'
import fs from 'fs/promises'
import { prisma } from './prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PokyImportResult {
  success: boolean
  shopifyProductId?: string
  shopifyProductUrl?: string
  screenshotPath?: string
  error?: string
  retries: number
}

interface StorageState {
  cookies: unknown[]
  origins: unknown[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_FILE = path.join(process.cwd(), 'playwright-state.json')
const SCREENSHOTS_DIR = '/tmp/poky-screenshots'
const POKY_URL = 'https://app.poky.app'
const ACTION_TIMEOUT = 30_000

// ─── Logging helpers ──────────────────────────────────────────────────────────

async function appendLog(productId: string, message: string) {
  const ps = await prisma.pipelineStep.findFirst({ where: { productId, step: 2 } })
  if (!ps) return
  const logs: string[] = ps.logs ? (JSON.parse(ps.logs) as string[]) : []
  logs.push(`[${new Date().toISOString()}] ${message}`)
  await prisma.pipelineStep.update({ where: { id: ps.id }, data: { logs: JSON.stringify(logs) } })
}

async function setStatus(productId: string, status: string, error?: string) {
  await prisma.pipelineStep.updateMany({
    where: { productId, step: 2 },
    data: { status, ...(error !== undefined ? { error } : {}) },
  })
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

async function takeScreenshot(page: Page, productId: string, label: string): Promise<string> {
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true })
  const filename = `${productId}-${label}-${Date.now()}.png`
  const screenshotPath = path.join(SCREENSHOTS_DIR, filename)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  return screenshotPath
}

// ─── Browser factory ──────────────────────────────────────────────────────────

async function launchBrowser(): Promise<Browser> {
  const isDev = process.env.NODE_ENV !== 'production'
  return chromium.launch({
    headless: !isDev,
    slowMo: isDev ? 100 : 0,
  })
}

async function createContext(browser: Browser): Promise<BrowserContext> {
  let storageState: StorageState | undefined

  try {
    const raw = await fs.readFile(SESSION_FILE, 'utf-8')
    storageState = JSON.parse(raw) as StorageState
  } catch {
    storageState = undefined
  }

  const contextOptions: BrowserContextOptions = { viewport: { width: 1280, height: 800 } }
  if (storageState) {
    contextOptions.storageState = storageState as BrowserContextOptions['storageState']
  }
  return browser.newContext(contextOptions)
}

async function saveSession(context: BrowserContext) {
  const state = await context.storageState()
  await fs.writeFile(SESSION_FILE, JSON.stringify(state, null, 2))
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function ensureLoggedIn(page: Page, productId: string): Promise<void> {
  await page.goto(`${POKY_URL}/dashboard`, { timeout: ACTION_TIMEOUT })

  const isLoginPage =
    page.url().includes('/login') ||
    (await page.locator('input[type="password"]').count()) > 0

  if (!isLoginPage) {
    await appendLog(productId, 'Sessão válida — já autenticado no Poky.')
    return
  }

  await appendLog(productId, 'Sessão expirada — a fazer login...')

  const email = process.env.POKY_EMAIL
  const password = process.env.POKY_PASSWORD
  if (!email || !password) throw new Error('POKY_EMAIL ou POKY_PASSWORD não configurados')

  await page.goto(`${POKY_URL}/login`, { timeout: ACTION_TIMEOUT })
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.locator('button[type="submit"]').click()

  // Wait for redirect away from login
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: ACTION_TIMEOUT })

  await saveSession(page.context())
  await appendLog(productId, 'Login bem-sucedido. Sessão guardada.')
}

// ─── Single product import ────────────────────────────────────────────────────

async function importSingleProduct(
  page: Page,
  productId: string,
  sourceUrl: string
): Promise<{ shopifyProductId: string; shopifyProductUrl: string }> {
  await appendLog(productId, `A importar produto: ${sourceUrl}`)

  await page.goto(POKY_URL, { timeout: ACTION_TIMEOUT })

  // Find URL input field
  const urlInput = page.locator('input[placeholder*="url" i], input[placeholder*="link" i], input[type="url"], input[name*="url" i]').first()
  await urlInput.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT })
  await urlInput.fill(sourceUrl)

  await appendLog(productId, 'URL inserido. A clicar importar...')

  // Click import button
  const importBtn = page.locator('button:has-text("Import"), button:has-text("Importar")').first()
  await importBtn.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT })
  await importBtn.click()

  // Wait for product to load
  await page.waitForLoadState('networkidle', { timeout: ACTION_TIMEOUT })

  // Try to enable Spanish translation
  const translateToggle = page
    .locator('text="Español", text="Spanish", text="Traducir", label:has-text("Español")')
    .first()
  const translateCount = await translateToggle.count()
  if (translateCount > 0) {
    await appendLog(productId, 'A ativar tradução para Espanhol...')
    await translateToggle.click()
    await page.waitForTimeout(1000)
  }

  // Confirm final import
  const confirmBtn = page
    .locator('button:has-text("Confirm"), button:has-text("Confirmar"), button:has-text("Add to Shopify"), button:has-text("Save")')
    .first()
  const confirmCount = await confirmBtn.count()
  if (confirmCount > 0) {
    await confirmBtn.click()
    await page.waitForLoadState('networkidle', { timeout: ACTION_TIMEOUT })
  }

  await appendLog(productId, 'Import confirmado. A extrair dados do produto...')

  // Extract Shopify product URL from page
  const shopifyLink = await page
    .locator('a[href*="myshopify.com"], a[href*="admin/products"]')
    .first()
    .getAttribute('href')
    .catch(() => null)

  const shopifyProductIdMatch = shopifyLink?.match(/\/products\/(\d+)/) ?? null
  const shopifyProductId = shopifyProductIdMatch ? shopifyProductIdMatch[1] : ''
  const shopifyProductUrl = shopifyLink ?? ''

  await appendLog(productId, `Produto importado. ID Shopify: ${shopifyProductId || 'desconhecido'}`)

  return { shopifyProductId, shopifyProductUrl }
}

// ─── Collection import ────────────────────────────────────────────────────────

async function importCollection(
  page: Page,
  productId: string,
  sourceUrl: string
): Promise<{ shopifyProductId: string; shopifyProductUrl: string }> {
  await appendLog(productId, `A importar coleção: ${sourceUrl}`)

  await page.goto(POKY_URL, { timeout: ACTION_TIMEOUT })

  // Find URL input and paste collection URL
  const urlInput = page
    .locator('input[placeholder*="url" i], input[placeholder*="link" i], input[type="url"], input[name*="url" i]')
    .first()
  await urlInput.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT })
  await urlInput.fill(sourceUrl)

  // Click "Load Products" or equivalent
  const loadBtn = page
    .locator('button:has-text("Load"), button:has-text("Load Products"), button:has-text("Carregar")')
    .first()
  await loadBtn.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT })
  await loadBtn.click()

  await appendLog(productId, 'A aguardar lista de produtos...')
  await page.waitForLoadState('networkidle', { timeout: ACTION_TIMEOUT })

  // Select all products
  const selectAllCheckbox = page
    .locator('input[type="checkbox"][aria-label*="all" i], input[type="checkbox"].select-all, th input[type="checkbox"]')
    .first()
  const selectAllCount = await selectAllCheckbox.count()
  if (selectAllCount > 0) {
    await selectAllCheckbox.check()
    await appendLog(productId, 'Todos os produtos selecionados.')
  } else {
    // Try to select each product checkbox individually
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check().catch(() => null)
    }
    await appendLog(productId, `${count} produtos selecionados individualmente.`)
  }

  // Click Import
  const importBtn = page
    .locator('button:has-text("Import"), button:has-text("Importar")')
    .first()
  await importBtn.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT })
  await importBtn.click()

  await page.waitForLoadState('networkidle', { timeout: ACTION_TIMEOUT })

  // If prompted for collection name, extract collection name from URL and fill it
  const collectionNameInput = page
    .locator('input[placeholder*="collection" i], input[placeholder*="coleção" i]')
    .first()
  const collectionNameCount = await collectionNameInput.count()
  if (collectionNameCount > 0) {
    // Extract collection name from URL path
    const collectionName =
      sourceUrl
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Nova Coleção'

    await collectionNameInput.fill(collectionName)
    await appendLog(productId, `Nome da coleção definido: "${collectionName}"`)

    const createBtn = page
      .locator('button:has-text("Create"), button:has-text("Criar"), button:has-text("Confirm")')
      .first()
    await createBtn.click()
    await page.waitForLoadState('networkidle', { timeout: ACTION_TIMEOUT })
  }

  await appendLog(productId, 'Coleção importada com sucesso.')

  // Try to get first product's Shopify link
  const shopifyLink = await page
    .locator('a[href*="myshopify.com"], a[href*="admin/products"]')
    .first()
    .getAttribute('href')
    .catch(() => null)

  const shopifyProductIdMatch = shopifyLink?.match(/\/products\/(\d+)/) ?? null
  const shopifyProductId = shopifyProductIdMatch ? shopifyProductIdMatch[1] : ''

  return { shopifyProductId, shopifyProductUrl: shopifyLink ?? '' }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function importProductViaPoky(productId: string): Promise<PokyImportResult> {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return { success: false, error: 'Produto não encontrado na DB', retries: 0 }

  let browser: Browser | null = null
  let retries = 0
  const MAX_RETRIES = 3

  while (retries < MAX_RETRIES) {
    try {
      await setStatus(productId, 'running')
      await appendLog(productId, `Tentativa ${retries + 1}/${MAX_RETRIES} — a abrir browser...`)

      browser = await launchBrowser()
      const context = await createContext(browser)
      const page = await context.newPage()

      page.setDefaultTimeout(ACTION_TIMEOUT)

      await ensureLoggedIn(page, productId)

      let result: { shopifyProductId: string; shopifyProductUrl: string }

      if (product.type === 'collection') {
        result = await importCollection(page, productId, product.sourceUrl)
      } else {
        result = await importSingleProduct(page, productId, product.sourceUrl)
      }

      await saveSession(context)
      await browser.close()
      browser = null

      // Update product in DB
      if (result.shopifyProductId) {
        await prisma.product.update({
          where: { id: productId },
          data: { shopifyId: result.shopifyProductId },
        })
      }

      // Save result and mark as awaiting approval
      await prisma.pipelineStep.updateMany({
        where: { productId, step: 2 },
        data: {
          status: 'awaiting_approval',
          data: JSON.stringify(result),
        },
      })

      return { success: true, ...result, retries }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await appendLog(productId, `Erro na tentativa ${retries + 1}: ${message}`)

      let screenshotPath: string | undefined
      if (browser) {
        try {
          const pages = browser.contexts()[0]?.pages()
          const activePage = pages?.[pages.length - 1]
          if (activePage) {
            screenshotPath = await takeScreenshot(activePage, productId, `error-attempt${retries + 1}`)
            await appendLog(productId, `Screenshot guardado: ${screenshotPath}`)
          }
        } catch {
          // screenshot failed, not critical
        }
        await browser.close().catch(() => null)
        browser = null
      }

      retries++

      if (retries >= MAX_RETRIES) {
        await setStatus(productId, 'failed', message)
        return { success: false, error: message, screenshotPath, retries }
      }

      await appendLog(productId, `A aguardar 2s antes da próxima tentativa...`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  return { success: false, error: 'Max retries reached', retries }
}
