import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

interface SheetProduct {
  url: string
  type: 'single_product' | 'collection'
}

function detectType(url: string): 'single_product' | 'collection' {
  if (url.includes('/collections/') || url.includes('collection')) {
    return 'collection'
  }
  return 'single_product'
}

export async function POST(req: NextRequest) {
  try {
    const { spreadsheetId, range } = await req.json() as { spreadsheetId: string; range: string }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: range || 'A:A',
    })

    const rows = response.data.values ?? []
    const urls: SheetProduct[] = rows
      .flat()
      .filter((cell): cell is string => typeof cell === 'string' && cell.startsWith('http'))
      .map((url) => ({ url: url.trim(), type: detectType(url.trim()) }))

    // Create a job with all products
    const job = await prisma.job.create({
      data: {
        sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        products: {
          create: urls.map((p) => ({
            sourceUrl: p.url,
            type: p.type,
            pipelineSteps: {
              create: [1, 2, 3, 4, 5].map((step) => ({ step })),
            },
          })),
        },
      },
      include: { products: { include: { pipelineSteps: true } } },
    })

    return NextResponse.json({ job, count: urls.length })
  } catch (error) {
    console.error('Sheets error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        products: {
          include: { pipelineSteps: true, creatives: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ jobs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
