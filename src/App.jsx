import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, supabaseMisconfigured } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Documents from './pages/Documents'
import DocumentForm from './pages/DocumentForm'
import Search from './pages/Search'


function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (supabaseMisconfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    )
  }

  if (supabaseMisconfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-amber-200 rounded-2xl p-8 max-w-md w-full shadow-sm">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Supabase not configured</h1>
          <p className="text-sm text-slate-500 mb-4">
            Open <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">.env</code> in
            the project root and replace the placeholder values with your real Supabase credentials.
          </p>
          <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-1 leading-relaxed">
            <p><span className="text-slate-500"># .env</span></p>
            <p><span className="text-amber-400">VITE_SUPABASE_URL</span>=<span className="text-green-400">https://xxxxxxxxxxxx.supabase.co</span></p>
            <p><span className="text-amber-400">VITE_SUPABASE_ANON_KEY</span>=<span className="text-green-400">eyJh…</span></p>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Find these values in your Supabase dashboard under <strong>Project Settings → API</strong>, then restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/documents" replace /> : <Login />}
        />
        <Route
          path="/"
          element={session ? <Layout session={session} /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Navigate to="/documents" replace />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents/new" element={<DocumentForm />} />
          <Route path="documents/:id/edit" element={<DocumentForm />} />
          <Route path="search" element={<Search />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
