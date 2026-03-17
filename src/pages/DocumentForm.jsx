import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function DocumentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const fileInputRef = useRef(null)

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [hasEmbedding, setHasEmbedding] = useState(false)
  const [fileName, setFileName] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [chunks, setChunks] = useState(null)      // preview chunks from /preview
  const [previewing, setPreviewing] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)   // which chunk is being edited
  const [editingText, setEditingText] = useState('')

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
        setHasEmbedding(!!data.embedding)
      }
      setLoading(false)
    }
    fetchDoc()
  }, [id, isEdit])

  const processFile = async (file) => {
    if (!file) return
    setFileName(file.name)
    setError(null)
    setChunks(null)

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setPdfFile(file)
      setContent('')

      // Auto-fetch preview chunks so user can review before ingesting
      const apiBase = import.meta.env.VITE_INGEST_API_URL
      if (apiBase) {
        setPreviewing(true)
        try {
          const form = new FormData()
          form.append('file', file)
          const res = await fetch(`${apiBase}/preview`, { method: 'POST', body: form })
          if (res.ok) {
            const data = await res.json()
            setChunks(data.chunks)
          } else {
            const body = await res.json().catch(() => ({}))
            setError(body.detail ?? 'Preview failed')
          }
        } catch {
          setError('Could not reach the ingest API. Is it running?')
        } finally {
          setPreviewing(false)
        }
      }
    } else {
      setPdfFile(null)
      const reader = new FileReader()
      reader.onload = (ev) => setContent(ev.target.result ?? '')
      reader.readAsText(file)
    }
  }

  const handleFileInput = (e) => {
    processFile(e.target.files?.[0])
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files?.[0])
  }

  const handleClearFile = () => {
    setFileName(null)
    setPdfFile(null)
    setContent('')
    setChunks(null)
    setEditingIndex(null)
    setError(null)
  }

  const handleDeleteChunk = (index) => {
    setChunks((prev) => prev.filter((c) => c.index !== index).map((c, i) => ({ ...c, index: i })))
  }

  const handleStartEdit = (chunk) => {
    setEditingIndex(chunk.index)
    setEditingText(chunk.text)
  }

  const handleSaveEdit = (index) => {
    setChunks((prev) => prev.map((c) => c.index === index ? { ...c, text: editingText } : c))
    setEditingIndex(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // ── PDF path: POST edited chunks to /ingest-chunks ──────────────────────
    if (pdfFile) {
      const apiBase = import.meta.env.VITE_INGEST_API_URL
      if (!apiBase) {
        setError('VITE_INGEST_API_URL is not set. Add it to your .env file.')
        setSaving(false)
        return
      }
      try {
        const form = new FormData()
        form.append('document_name', fileName)
        form.append('chunks', JSON.stringify(chunks ?? []))
        const res = await fetch(`${apiBase}/ingest-chunks`, { method: 'POST', body: form })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail ?? `API error ${res.status}`)
        }
      } catch (err) {
        setError(err.message)
        setSaving(false)
        return
      }
      navigate('/documents')
      return
    }

    // ── Text path: save directly to Supabase ────────────────────────────────
    const payload = { content: content.trim(), metadata: null }
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

  const fileLoaded = !!fileName
  const isPdf = !!pdfFile

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
            {isEdit ? 'Review Document' : 'Upload Document'}
          </h1>
          {isEdit && <p className="text-xs font-mono text-slate-400 mt-0.5">{id}</p>}
        </div>
      </div>

      {/* Embedding banner (edit mode) */}
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
            ? 'Vector embedding present — this document is ready for semantic search.'
            : 'No vector embedding. The embedding will be generated when this document is ingested.'}
        </div>
      )}

      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── STEP 1: Upload zone (hidden once a file is loaded in new-doc mode) ── */}
        {!isEdit && !fileLoaded && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-14 cursor-pointer transition-colors ${
              dragOver
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Drop a file here, or <span className="text-indigo-600">browse</span></p>
              <p className="text-xs text-slate-400 mt-1">Supported formats: .pdf · .txt · .md · .csv · .json</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.json,.pdf"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        )}

        {/* ── STEP 2: File loaded — file bar + preview ── */}
        {(fileLoaded || isEdit) && (
          <>
            {/* File bar */}
            {!isEdit && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isPdf ? (
                    <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="text-sm font-medium text-slate-700 truncate">{fileName}</span>
                  {isPdf && (
                    <span className="shrink-0 text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PDF</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="ml-4 shrink-0 text-xs text-slate-400 hover:text-red-500 font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            )}

            {/* PDF chunk preview */}
            {isPdf && (
              <div>
                {previewing && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                    <svg className="animate-spin w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Extracting and chunking PDF…
                  </div>
                )}

                {chunks && !previewing && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-slate-700">Chunk Preview</p>
                      <span className="text-xs text-slate-400">{chunks.length} chunk{chunks.length !== 1 ? 's' : ''} — edit or delete before ingesting</span>
                    </div>
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {chunks.map((chunk) => (
                        <div key={chunk.index} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                            <span className="text-xs font-semibold text-slate-500">Chunk {chunk.index + 1}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400">Page {chunk.page + 1}</span>
                              {editingIndex === chunk.index ? (
                                <>
                                  <button type="button" onClick={() => handleSaveEdit(chunk.index)}
                                    className="text-xs text-green-600 hover:text-green-700 font-semibold transition-colors">
                                    Save
                                  </button>
                                  <button type="button" onClick={() => setEditingIndex(null)}
                                    className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" onClick={() => handleStartEdit(chunk)}
                                    className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                                    Edit
                                  </button>
                                  <button type="button" onClick={() => handleDeleteChunk(chunk.index)}
                                    className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {editingIndex === chunk.index ? (
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={6}
                              autoFocus
                              className="w-full px-3 py-2.5 text-xs font-mono text-slate-700 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                          ) : (
                            <p className="px-3 py-2.5 text-xs font-mono text-slate-600 leading-relaxed whitespace-pre-wrap">{chunk.text}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!chunks && !previewing && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    Set <code className="text-xs bg-amber-100 px-1 rounded">VITE_INGEST_API_URL</code> in your .env to preview chunks before ingesting.
                  </div>
                )}
              </div>
            )}

            {/* Text content preview */}
            {!isPdf && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700">Extracted Content Preview</label>
                  <span className="text-xs text-slate-400">{content.length.toLocaleString()} characters</span>
                </div>
                <textarea
                  value={content}
                  readOnly
                  rows={18}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-600 font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-default"
                />
                <p className="mt-1.5 text-xs text-slate-400">Read-only preview. Review the content above before saving to the database.</p>
              </div>
            )}
          </>
        )}

        {/* ── Actions ── */}
        {(fileLoaded || isEdit) && (
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !fileLoaded || previewing}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isPdf ? 'Ingesting…' : 'Saving…'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  {isPdf ? 'Ingest PDF' : isEdit ? 'Save Changes' : 'Save to Database'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/documents')}
              className="px-5 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 text-sm font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

      </form>
    </div>
  )
}

