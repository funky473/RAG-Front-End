import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ConfirmModal from '../components/ConfirmModal'

const PAGE_SIZE = 20

function EmbeddingBadge({ hasEmbedding }) {
  if (hasEmbedding) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-md text-xs font-medium">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Ready
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-xs font-medium">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      Missing
    </span>
  )
}

export default function Documents() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error, count } = await supabase
      .from('documents')
      .select('id, content, metadata, embedding, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      setError(error.message)
    } else {
      setDocuments(data ?? [])
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [page])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('documents').delete().eq('id', deleteTarget.id)
    if (error) {
      setError(error.message)
    } else {
      setDeleteTarget(null)
      // Go back a page if we deleted the last item on this page
      if (documents.length === 1 && page > 0) setPage(p => p - 1)
      else fetchDocuments()
    }
    setDeleting(false)
  }

  const copyId = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const withEmbedding = documents.filter(d => !!d.embedding).length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documentation</h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-slate-500">{total} total</span>
            {documents.length > 0 && (
              <span className="text-sm text-slate-400">
                {withEmbedding}/{documents.length} on this page have embeddings
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/documents/new')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Update Documents
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400">
          <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading documents…
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No documents yet</h3>
          <p className="text-sm text-slate-400 mb-5">Upload your first document to get started</p>
          <button
            onClick={() => navigate('/documents/new')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Create Document
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Content</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-52">Metadata</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Embedding</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Created</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyId(doc.id)}
                        title="Click to copy full ID"
                        className="font-mono text-xs text-slate-400 hover:text-indigo-600 transition-colors text-left"
                      >
                        {copiedId === doc.id ? (
                          <span className="text-green-600">Copied!</span>
                        ) : (
                          `${doc.id.slice(0, 8)}…`
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-slate-800 text-sm leading-relaxed line-clamp-2">
                        {doc.content}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {doc.metadata && Object.keys(doc.metadata).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(doc.metadata).slice(0, 3).map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-xs text-slate-600 max-w-[140px] truncate"
                              title={`${k}: ${String(v)}`}
                            >
                              <span className="font-medium truncate">{k}:</span>
                              <span className="ml-0.5 truncate">{String(v).slice(0, 12)}</span>
                            </span>
                          ))}
                          {Object.keys(doc.metadata).length > 3 && (
                            <span className="text-xs text-slate-400">
                              +{Object.keys(doc.metadata).length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <EmbeddingBadge hasEmbedding={!!doc.embedding} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/documents/${doc.id}/edit`)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(doc)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-white transition-colors"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-white transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Document"
        message="Are you sure you want to delete this document? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
      />
    </div>
  )
}
