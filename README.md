# RAG Manager — Admin Panel

A React-based admin UI for managing the document knowledge base that powers a **LangChain RAG payroll chatbot** (INFO 3601 — University of the West Indies, St. Augustine).

The backend chatbot (`LLM.py`) uses Google Gemini + Supabase vector search to answer payroll-related questions about PowPay. This admin panel is what you use to upload, chunk, review, and manage the documents stored in that Supabase vector database.

---

## Related: LangChain RAG Backend

This admin panel manages the vector database used by the RAG backend (`[text](https://github.com/Software-Solutions-Project-Repo/langchain-rag.git)`), which consists of:

| Script | Purpose |
|---|---|
| `populate_database.py` | CLI tool — PDF → chunks → embeddings → Supabase |
| `query_data.py` | Semantic similarity search against Supabase |
| `LLM.py` | Interactive payroll chatbot (Gemini + RAG) |

The admin panel replaces `populate_database.py` for day-to-day document management — providing a UI to upload PDFs, review and edit chunks before saving, and delete stale entries.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Router | React Router v6 |
| Auth & DB | Supabase (`@supabase/supabase-js`) |
| Ingest API | FastAPI (Python) |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` via LangChain |
| PDF parsing | LangChain `PyPDFLoader` + `RecursiveCharacterTextSplitter` |

---

## Project Structure

```
├── main.py                  # FastAPI ingest server
├── requirements.txt         # Python dependencies
├── populate_database.py     # Reference CLI ingestion script
├── src/
│   ├── App.jsx              # Routes + auth gate
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   │   ├── Layout.jsx       # Sidebar + nav shell
│   │   └── ConfirmModal.jsx
│   ├── pages/
│   │   ├── Documents.jsx    # Document list with pagination
│   │   ├── DocumentForm.jsx # Upload + chunk preview/edit
│   │   ├── Search.jsx       # Semantic search UI
│   │   └── Login.jsx
│   └── lib/
│       └── supabase.js      # Supabase client
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Supabase (frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# FastAPI ingest server URL
VITE_INGEST_API_URL=http://localhost:8000

# Supabase (backend / Python)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# Allowed CORS origins for the FastAPI server
CORS_ORIGINS=http://localhost:5173
```

---

## Getting Started

### 1. Frontend

```bash
npm install
npm run dev
```

Runs at `http://localhost:5173`.

### 2. Backend (FastAPI ingest server)

```bash
pip install -r requirements.txt
c:/python314/python.exe -m uvicorn main:app --reload --port 8000
```

Confirm it's running:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/preview` | Extract and chunk a PDF — returns chunks, no saving |
| `POST` | `/ingest` | Full pipeline: chunk → embed → save to Supabase |
| `POST` | `/ingest-chunks` | Embed and save pre-edited chunks (skips re-chunking) |

### `/preview` — request

```
Content-Type: multipart/form-data
file: <PDF file>
```

### `/preview` — response

```json
{
  "total": 12,
  "chunks": [
    { "index": 0, "page": 0, "text": "..." },
    ...
  ]
}
```

### `/ingest-chunks` — request

```
Content-Type: multipart/form-data
document_name: "my-file.pdf"
chunks: "[{\"index\": 0, \"page\": 0, \"text\": \"...\"}]"
```

---

## Upload Flow

1. Drag-and-drop or click to select a file (`.pdf`, `.txt`, `.md`, `.csv`, `.json`)
2. **PDF files**: sent to `/preview` → chunks displayed as editable cards
   - Edit chunk text inline
   - Delete unwanted chunks
   - Click **Save to Database** → sends edited chunks to `/ingest-chunks`
3. **Text files**: content previewed in read-only textarea → saved directly to Supabase

---

## Supabase Tables

These tables are shared with the RAG backend — any documents uploaded here are immediately available to the chatbot (`LLM.py`).

### `documents`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `content` | `text` | Chunk text |
| `metadata` | `jsonb` | `{source, chunk_id, document_name, page}` |
| `embedding` | `vector(384)` | HuggingFace 384-dim embedding |
| `created_at` | `timestamptz` | Auto-set |

### `document_registry`

Master table tracking ingested documents (source, chunk count, timestamp).

---

## Author

Henry Sylvester — INFO 3601, University of the West Indies, St. Augustine (2026)

