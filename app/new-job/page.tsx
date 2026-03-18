'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type UrlType = 'single_product' | 'collection' | 'invalid'

interface ParsedUrl {
  raw: string
  type: UrlType
}

function detectType(url: string): UrlType {
  if (!url.startsWith('https://')) return 'invalid'
  if (url.includes('/collections/')) return 'collection'
  if (url.includes('/products/')) return 'single_product'
  return 'invalid'
}

const TYPE_LABELS: Record<UrlType, string> = {
  single_product: 'produto',
  collection: 'coleção',
  invalid: 'formato inválido',
}

const TYPE_COLORS: Record<UrlType, string> = {
  single_product: 'bg-blue-100 text-blue-700',
  collection: 'bg-purple-100 text-purple-700',
  invalid: 'bg-red-100 text-red-700',
}

export default function NewJobPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const parsed = useMemo<ParsedUrl[]>(() => {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((raw) => ({ raw, type: detectType(raw) }))
  }, [text])

  const validUrls = parsed.filter((p) => p.type !== 'invalid').map((p) => p.raw)
  const hasInvalid = parsed.some((p) => p.type === 'invalid')
  const canSubmit = validUrls.length > 0 && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: validUrls }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar job')
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <a href="/" className="text-blue-600 hover:text-blue-800 text-sm">← Dashboard</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-6">Novo Job</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Cola os links aqui, um por linha:
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={`https://loja.com/products/produto-a\nhttps://loja.com/collections/colecao-x\nhttps://loja.com/products/produto-b`}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* URL preview list */}
          {parsed.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {parsed.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm shrink-0">
                      {p.type === 'invalid' ? '⚠' : '✅'}
                    </span>
                    <span className={`text-sm font-mono truncate ${p.type === 'invalid' ? 'text-red-600' : 'text-gray-700'}`}>
                      {p.raw}
                    </span>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[p.type]}`}>
                    {TYPE_LABELS[p.type]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {hasInvalid && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              URLs inválidas serão ignoradas. Só URLs com <code>/products/</code> ou <code>/collections/</code> são aceites.
            </p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? 'A criar...'
              : `Criar Job com ${validUrls.length} produto${validUrls.length !== 1 ? 's' : ''}`}
          </button>
        </form>
      </div>
    </main>
  )
}
