import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import MetadataEditor from '../components/MetadataEditor'

export default function DocumentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const fileInputRef = useRef(null)

  const [content, setContent] = useState('')
  const [metadata, setMetadata] = useState({})
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [hasEmbedding, setHasEmbedding] = useState(false)
  const [fileName, setFileName] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    const fetchDoc = async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, content, metadata, embedding')
        .eq('id', id)
        .single()

      if (error) {
        setError(error.message)
      } else if (data) {
        setContent(data.content)
        setMetadata(data.metadata ?? {})
        setHasEmbedding(!!data.embedding)
      }
      setLoading(false)
    }
    fetchDoc()
  }, [id, isEdit])

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setContent(ev.target.result ?? '')
    }
    reader.readAsText(file)
    // Reset the input so the same file can be re-selected if needed
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      content: content.trim(),
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    }

    let dbError
    if (isEdit) {
      const { error } = await supabase.from('documents').update(payload).eq('id', id)
      dbError = error
    } else {
      const { error } = await supabase.from('documents').insert([payload])
      dbError = error
    }

    if (dbError) {
      setError(dbError.message)
      setSaving(false)
      return
    }

    navigate('/documents')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading document…
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <button
          onClick={() => navigate('/documents')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-slate-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEdit ? 'Edit Document' : 'New Document'}
          </h1>
          {isEdit && (
            <p className="text-xs font-mono text-slate-400 mt-0.5">{id}</p>
          )}
        </div>
      </div>

      {/* Embedding status banner (edit mode only) */}
      {isEdit && (
        <div className={`mb-5 p-3 rounded-xl text-sm flex items-start gap-2.5 ${
          hasEmbedding
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            {hasEmbedding ? (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            )}
          </svg>
          {hasEmbedding
            ? 'Vector embedding is present — this document is ready for semantic search.'
            : 'No vector embedding. After saving, use your backend service (e.g. a Supabase Edge Function) to generate and store the embedding.'}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Content <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {fileName && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {fileName}
                </span>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 hover:border-indigo-400 px-2.5 py-1 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={14}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed font-mono"
            placeholder="Paste or type document content here… or use 'Import file' to load a .txt / .md file."
          />
          <p className="mt-1 text-xs text-slate-400">{content.length} characters</p>
        </div>

        {/* Metadata */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <MetadataEditor value={metadata} onChange={setMetadata} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Document'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/documents')}
            className="px-5 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 text-sm font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
