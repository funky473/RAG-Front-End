import { useState } from 'react'

export default function MetadataEditor({ value, onChange }) {
  const [rawMode, setRawMode] = useState(false)
  const [rawText, setRawText] = useState('')
  const [rawError, setRawError] = useState(null)

  const obj = value ?? {}
  // Use an ordered array internally to avoid duplicate-key issues during editing
  const pairs = Object.entries(obj)

  const handleAddPair = () => {
    // Use a unique placeholder key to avoid collisions
    const newKey = `key_${Date.now()}`
    onChange({ ...obj, [newKey]: '' })
  }

  const handleKeyChange = (oldKey, newKey) => {
    const entries = Object.entries(obj)
    const idx = entries.findIndex(([k]) => k === oldKey)
    if (idx === -1) return
    entries[idx] = [newKey, entries[idx][1]]
    onChange(Object.fromEntries(entries))
  }

  const handleValueChange = (key, newVal) => {
    onChange({ ...obj, [key]: newVal })
  }

  const handleRemove = (key) => {
    const next = { ...obj }
    delete next[key]
    onChange(next)
  }

  const enterRawMode = () => {
    setRawText(JSON.stringify(obj, null, 2))
    setRawError(null)
    setRawMode(true)
  }

  const handleRawChange = (e) => {
    setRawText(e.target.value)
    try {
      const parsed = JSON.parse(e.target.value)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        onChange(parsed)
        setRawError(null)
      } else {
        setRawError('Value must be a JSON object {}')
      }
    } catch {
      setRawError('Invalid JSON')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">Metadata (JSONB)</label>
        <button
          type="button"
          onClick={() => rawMode ? setRawMode(false) : enterRawMode()}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {rawMode ? '← Key-Value Editor' : 'Raw JSON →'}
        </button>
      </div>

      {rawMode ? (
        <div>
          <textarea
            value={rawText}
            onChange={handleRawChange}
            rows={6}
            spellCheck={false}
            className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y ${
              rawError ? 'border-red-300 bg-red-50' : 'border-slate-300'
            }`}
            placeholder="{}"
          />
          {rawError && <p className="mt-1 text-xs text-red-600">{rawError}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {pairs.length === 0 && (
            <p className="text-xs text-slate-400 italic py-1">No metadata fields. Click "Add Field" to add one.</p>
          )}
          {pairs.map(([key, val]) => (
            <div key={key} className="flex gap-2 items-center">
              <input
                type="text"
                value={key}
                onChange={(e) => handleKeyChange(key, e.target.value)}
                placeholder="key"
                className="w-36 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
              />
              <span className="text-slate-400 text-sm">:</span>
              <input
                type="text"
                value={typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                onChange={(e) => handleValueChange(key, e.target.value)}
                placeholder="value"
                className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleRemove(key)}
                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                title="Remove field"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddPair}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mt-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Field
          </button>
        </div>
      )}
    </div>
  )
}
