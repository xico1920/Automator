import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STEP_LABELS = ['Ingestão', 'Poky', 'Shopify', 'Criativos', 'Meta']

const STEP_COLOR: Record<string, string> = {
  pending:           'var(--bg-hover)',
  running:           'var(--meta-blue)',
  awaiting_approval: 'var(--amber)',
  approved:          'var(--green)',
  failed:            'var(--red)',
}

const JOB_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendente',  cls: 'badge-muted'  },
  running:   { label: 'Em curso',  cls: 'badge-blue'   },
  completed: { label: 'Concluído', cls: 'badge-green'  },
  failed:    { label: 'Falhou',    cls: 'badge-red'    },
}

// ─── Logos ────────────────────────────────────────────────────────────────────

function MetaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 24" fill="none">
      <path d="M2 17C2 20.3 3.4 22.5 5.6 22.5C7.2 22.5 8.5 21.5 10.4 18.5L13 14L10.3 9.5C8.4 6.5 7.1 5.5 5.6 5.5C3.4 5.5 2 7.8 2 11V17Z" fill="#0081FB"/>
      <path d="M20 14L17.2 9.4C15.3 6.4 13.8 5.5 12.3 5.5C10.6 5.5 9.2 6.6 7.9 8.9L6.5 11.2L9.4 16.2C11 19 12.5 20.2 14.2 20.2C15.9 20.2 17.4 19 19.2 16L20 14Z" fill="url(#meta_logo_g)"/>
      <path d="M26 5.5C24.5 5.5 23.2 6.5 21.3 9.5L18.7 13.8L21.6 18.5C23.5 21.5 24.8 22.5 26.4 22.5C28.6 22.5 30 20.3 30 17V11C30 7.8 28.6 5.5 26 5.5Z" fill="#0081FB"/>
      <defs>
        <linearGradient id="meta_logo_g" x1="6.5" y1="12.85" x2="20" y2="12.85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0064E1"/>
          <stop offset="1" stopColor="#0081FB"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function ShopifyLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 44" fill="none">
      {/* Bag */}
      <path d="M34.5 10.8C34.4 10.1 33.8 9.7 33.3 9.7C32.8 9.7 27.5 9.4 27.5 9.4C27.5 9.4 23.5 5.5 23.1 5.1C22.7 4.7 21.9 4.8 21.6 4.9L19.8 5.5C19.1 3.3 17.7 1.3 15.3 1.3H15.1C14.4 0.5 13.5 0.1 12.7 0.1C6.9 0.2 4.3 7.4 3.5 11L0 12.1L4.2 38.3L28.1 33.9L33.9 12C34.1 11.6 34.6 11.2 34.5 10.8Z" fill="#95BF47"/>
      {/* S */}
      <path d="M20.4 17.2C19.4 16.9 18.9 16.6 18.9 15.9C18.9 15.3 19.4 14.9 20.3 14.9C21.8 14.9 22.4 15.7 22.4 15.7L23.7 13.4C23.7 13.4 22.5 12 20 12C17.4 12 15.6 13.7 15.6 16C15.6 18.2 17.2 19.2 18.8 19.8C19.9 20.2 20.5 20.6 20.5 21.4C20.5 22.2 19.9 22.7 18.8 22.7C17.1 22.7 16.2 21.6 16.2 21.6L14.8 23.9C14.8 23.9 15.9 25.5 18.6 25.5C21.4 25.5 23.2 23.8 23.2 21.3C23.2 19 21.6 18 20.4 17.2Z" fill="white"/>
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const jobs = await prisma.job.findMany({
    include: { products: { include: { pipelineSteps: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const totalProducts   = jobs.reduce((a, j) => a + j.products.length, 0)
  const completedProducts = jobs.reduce(
    (a, j) => a + j.products.filter((p) => p.status === 'completed').length, 0
  )
  const runningProducts = jobs.reduce(
    (a, j) => a + j.products.filter((p) => p.pipelineSteps.some((s) => s.status === 'running')).length, 0
  )

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* ── Nav ── */}
      <nav style={{
        borderBottom: '1px solid var(--border)',
        background: 'rgba(4,4,10,0.92)',
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 24px',
          height: 48, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>

          {/* Logo group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MetaLogo size={20} />
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10, color: 'var(--text-muted)',
              }}>×</span>
              <ShopifyLogo size={18} />
            </div>
            <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
            <span style={{
              fontFamily: 'Bebas Neue, cursive',
              fontSize: 16, letterSpacing: '0.14em',
              color: 'var(--text-primary)',
            }}>
              AUTOMATOR
            </span>
          </div>

          <Link href="/new-job" className="btn btn-primary" style={{ fontSize: 12, padding: '7px 14px' }}>
            + Novo Job
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 52px' }}>

        {/* ── Stats strip ── */}
        <div className="card" style={{ marginBottom: 20, display: 'flex', overflow: 'hidden' }}>
          {[
            { label: 'TOTAL',     value: totalProducts,    color: 'var(--text-primary)' },
            { label: 'EM CURSO',  value: runningProducts,  color: 'var(--meta-blue)' },
            { label: 'CONCLUÍDOS', value: completedProducts, color: 'var(--shopify-green)' },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              flex: 1,
              padding: '18px 28px',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
            }}>
              <p style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9, fontWeight: 500,
                letterSpacing: '0.14em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                {stat.label}
              </p>
              <p style={{
                fontFamily: 'Bebas Neue, cursive',
                fontSize: 46, lineHeight: 1,
                color: stat.color,
                letterSpacing: '0.02em',
              }}>
                {String(stat.value).padStart(2, '0')}
              </p>
            </div>
          ))}
        </div>

        {/* ── Jobs list ── */}
        {jobs.length === 0 ? (
          <div className="card" style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '80px 24px', gap: 14,
          }}>
            <p style={{
              fontFamily: 'Bebas Neue, cursive',
              fontSize: 72, lineHeight: 1,
              color: 'var(--text-muted)',
              letterSpacing: '0.05em',
            }}>
              00
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Nenhum job ainda.
            </p>
            <Link href="/new-job" className="btn btn-primary" style={{ marginTop: 8 }}>
              Criar primeiro job
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobs.map((job) => {
              const jobStatus = JOB_STATUS[job.status] ?? JOB_STATUS.pending
              return (
                <div key={job.id} className="card" style={{ overflow: 'hidden' }}>

                  {/* Job header row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.012)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`badge ${jobStatus.cls}`}>{jobStatus.label}</span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 9, letterSpacing: '0.06em',
                        color: 'var(--text-muted)',
                      }}>
                        {job.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 9, color: 'var(--text-muted)',
                      }}>
                        {new Date(job.createdAt).toLocaleString('pt-PT', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 9, color: 'var(--text-muted)',
                    }}>
                      {job.products.length} produto{job.products.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Products */}
                  {job.products.map((product, pi) => (
                    <div
                      key={product.id}
                      className="product-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px',
                        borderBottom: pi < job.products.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {/* Type badge */}
                      <span className={`badge shrink-0 ${product.type === 'collection' ? 'badge-purple' : 'badge-blue'}`}
                        style={{ minWidth: 36, justifyContent: 'center' }}>
                        {product.type === 'collection' ? 'COL' : 'PRD'}
                      </span>

                      {/* Title + URL */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 13, fontWeight: 500,
                          color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {product.title ?? product.sourceUrl}
                        </p>
                        {product.title && (
                          <p style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 10, color: 'var(--text-muted)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginTop: 1,
                          }}>
                            {product.sourceUrl}
                          </p>
                        )}
                      </div>

                      {/* Pipeline step squares */}
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        {STEP_LABELS.map((label, i) => {
                          const stepNum = i + 1
                          const s = product.pipelineSteps.find((ps) => ps.step === stepNum)
                          const status = s?.status ?? 'pending'
                          const color = STEP_COLOR[status] ?? 'var(--bg-hover)'
                          return (
                            <div
                              key={stepNum}
                              title={`${label}: ${status}`}
                              className={status === 'running' ? 'step-running' : ''}
                              style={{
                                width: 22, height: 22, borderRadius: 3,
                                background: color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 8, fontWeight: 500,
                                color: status === 'pending' ? 'var(--text-muted)' : 'rgba(0,0,0,0.45)',
                                opacity: status === 'pending' ? 0.4 : 1,
                              }}
                            >
                              {stepNum}
                            </div>
                          )
                        })}
                      </div>

                      {/* Budget */}
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11, fontWeight: 500,
                        color: 'var(--shopify-green)',
                        whiteSpace: 'nowrap', flexShrink: 0,
                        letterSpacing: '0.02em',
                      }}>
                        {product.type === 'collection' ? '150.00' : '51.77'}€<span style={{ opacity: 0.5, fontWeight: 400 }}>/dia</span>
                      </span>

                      {/* Arrow link */}
                      <Link href={`/pipeline/${product.id}`} className="pipeline-arrow">
                        →
                      </Link>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
