import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const STEP_LABELS = ['Ingestão', 'Import Shopify', 'Validação', 'Criativos', 'Meta Ads']

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-200 text-gray-700',
  running: 'bg-blue-200 text-blue-700',
  awaiting_approval: 'bg-yellow-200 text-yellow-700',
  approved: 'bg-green-200 text-green-700',
  failed: 'bg-red-200 text-red-700',
  completed: 'bg-green-500 text-white',
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const jobs = await prisma.job.findMany({
    include: {
      products: {
        include: { pipelineSteps: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Meta Ads Automator</h1>
          <Link
            href="/new-job"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            + Novo Job
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <p className="text-lg">Nenhum job criado ainda.</p>
            <p className="mt-2">Clica em &quot;Novo Job&quot; e cola os links dos produtos.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-500 font-mono">{job.id}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {new Date(job.createdAt).toLocaleString('pt-PT')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[job.status] ?? 'bg-gray-200'}`}>
                    {job.status}
                  </span>
                </div>

                <div className="space-y-3">
                  {job.products.map((product) => (
                    <div key={product.id} className="border border-gray-100 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-800 text-sm truncate max-w-md">
                            {product.title ?? product.sourceUrl}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                            product.type === 'collection' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {product.type === 'collection' ? 'Coleção' : 'Produto'}
                          </span>
                        </div>
                        <Link
                          href={`/pipeline/${product.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Ver Pipeline →
                        </Link>
                      </div>

                      {/* Progress steps */}
                      <div className="flex gap-2">
                        {STEP_LABELS.map((label, i) => {
                          const stepNum = i + 1
                          const step = product.pipelineSteps.find((s) => s.step === stepNum)
                          const status = step?.status ?? 'pending'
                          return (
                            <div key={stepNum} className="flex-1">
                              <div className={`h-2 rounded-full ${
                                status === 'approved' || status === 'completed'
                                  ? 'bg-green-500'
                                  : status === 'running'
                                  ? 'bg-blue-400 animate-pulse'
                                  : status === 'awaiting_approval'
                                  ? 'bg-yellow-400'
                                  : status === 'failed'
                                  ? 'bg-red-400'
                                  : 'bg-gray-200'
                              }`} />
                              <p className="text-xs text-gray-500 mt-1 text-center">{label}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
