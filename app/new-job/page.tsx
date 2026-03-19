'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type UrlType = 'single_product' | 'collection' | 'invalid'

interface ParsedUrl { raw: string; type: UrlType }

function detectType(url: string): UrlType {
  if (!url.startsWith('https://')) return 'invalid'
  if (url.includes('/collections/')) return 'collection'
  if (url.includes('/products/')) return 'single_product'
  return 'invalid'
}

const TYPE_LABEL: Record<UrlType, string> = {
  single_product: 'PRD',
  collection:     'COL',
  invalid:        'INV',
}

const TYPE_BADGE: Record<UrlType, string> = {
  single_product: 'badge-blue',
  collection:     'badge-purple',
  invalid:        'badge-red',
}

export default function NewJobPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const parsed = useMemo<ParsedUrl[]>(() =>
    text.split('\n').map((l) => l.trim()).filter(Boolean).map((raw) => ({ raw, type: detectType(raw) }))
  , [text])

  const validUrls  = parsed.filter((p) => p.type !== 'invalid').map((p) => p.raw)
  const hasInvalid = parsed.some((p) => p.type === 'invalid')
  const canSubmit  = validUrls.length > 0 && !loading

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
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{
        borderBottom: '1px solid var(--border)',
        background: 'rgba(4,4,10,0.92)',
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: 780, margin: '0 auto', padding: '0 24px',
          height: 48, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <a href="/" style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11, color: 'var(--text-muted)',
            textDecoration: 'none', letterSpacing: '0.02em',
            transition: 'color 0.15s',
          }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
          >
            ← DASHBOARD
          </a>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>/</span>
          <span style={{
            fontFamily: 'Bebas Neue, cursive',
            fontSize: 15, letterSpacing: '0.1em',
            color: 'var(--text-secondary)',
          }}>
            NOVO JOB
          </span>
        </div>
      </nav>

      <div style={{
        maxWidth: 780, margin: '0 auto', padding: '40px 24px 52px',
        width: '100%', flex: 1,
      }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontFamily: 'Bebas Neue, cursive',
            fontSize: 48, lineHeight: 1,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}>
            ADICIONAR PRODUTOS
          </h1>
          <p style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11, color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            COLA OS LINKS DOS PRODUTOS OU COLEÇÕES SHOPIFY, UM POR LINHA
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Terminal textarea */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Terminal header */}
            <div style={{
              padding: '8px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.015)',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', opacity: 0.7 }} />
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber)', opacity: 0.7 }} />
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--shopify-green)', opacity: 0.7 }} />
              <span style={{
                marginLeft: 8,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10, color: 'var(--text-muted)',
                letterSpacing: '0.05em',
              }}>
                urls.txt
              </span>
              {parsed.length > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9, color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                }}>
                  {parsed.length} LINHA{parsed.length !== 1 ? 'S' : ''}
                </span>
              )}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={'https://loja.myshopify.com/products/produto-a\nhttps://loja.myshopify.com/collections/colecao-x\nhttps://loja.myshopify.com/products/produto-b'}
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: 'none', outline: 'none',
                padding: '14px 16px',
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12, resize: 'vertical', lineHeight: 1.85,
              }}
            />
          </div>

          {/* URL parse preview */}
          {parsed.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '7px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  PARSED URLS
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9, color: validUrls.length > 0 ? 'var(--green)' : 'var(--text-muted)',
                  letterSpacing: '0.05em',
                }}>
                  {validUrls.length}/{parsed.length} VÁLIDAS
                </span>
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {parsed.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12,
                      padding: '8px 14px',
                      borderBottom: i < parsed.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11, flexShrink: 0,
                        color: p.type === 'invalid' ? 'var(--red)' : 'var(--green)',
                      }}>
                        {p.type === 'invalid' ? '✕' : '✓'}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        color: p.type === 'invalid' ? 'rgba(239,68,68,0.6)' : 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.raw}
                      </span>
                    </div>
                    <span className={`badge shrink-0 ${TYPE_BADGE[p.type]}`}>
                      {TYPE_LABEL[p.type]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invalid warning */}
          {hasInvalid && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 14px', borderRadius: 5,
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.14)',
            }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10, color: 'var(--amber)',
                flexShrink: 0, marginTop: 1,
              }}>
                WARN
              </span>
              <p style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10, color: 'rgba(245,158,11,0.7)',
                lineHeight: 1.6, letterSpacing: '0.02em',
              }}>
                URLs inválidas serão ignoradas. Aceites:{' '}
                <code style={{ color: 'var(--amber)' }}>/products/</code>{' '}
                ou{' '}
                <code style={{ color: 'var(--amber)' }}>/collections/</code>
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 5,
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.16)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11, color: '#f87171',
              letterSpacing: '0.02em',
            }}>
              ERR: {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '13px',
              borderRadius: 5,
              justifyContent: 'center',
              letterSpacing: '0.05em',
              fontFamily: 'Bebas Neue, cursive',
              fontSize: 16,
            }}
          >
            {loading
              ? 'A CRIAR JOB...'
              : canSubmit
              ? `CRIAR JOB · ${validUrls.length} PRODUTO${validUrls.length !== 1 ? 'S' : ''}`
              : 'COLA PELO MENOS 1 URL VÁLIDA'}
          </button>
        </form>
      </div>
    </main>
  )
}
