import json
import os
import tempfile
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from supabase import create_client

load_dotenv()

MASTER_TABLE = "document_registry"
DOCUMENTS_TABLE = "documents"
DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="RAG Ingest API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


def _supabase_client():
    url = os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env")
    return create_client(url, key)


def _register_document(supabase, system_name: str, table_name: str, document_name: str, chunks: int):
    """Insert a record into the master document_registry table."""
    record = {
        "system_name": system_name,
        "table_name": table_name,
        "document_name": document_name,
        "chunks_uploaded": chunks,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase.table(MASTER_TABLE).insert(record).execute()
    except Exception as e:
        # Non-fatal — log but don't fail the request
        print(f"⚠ Could not write to master table '{MASTER_TABLE}': {e}")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/preview")
async def preview(
    file: UploadFile = File(...),
    chunk_size: int = Form(default=500),
    chunk_overlap: int = Form(default=50),
):
    """
    Extract and chunk a PDF without saving anything.
    Returns the chunks so the user can review before ingesting.
    """
    is_pdf = file.content_type == "application/pdf" or (
        file.filename and file.filename.lower().endswith(".pdf")
    )
    if not is_pdf:
        raise HTTPException(status_code=415, detail="Only PDF files are supported")

    pdf_bytes = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ".", " ", ""],
        )
        raw_chunks = splitter.split_documents(loader.load())
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"PDF processing failed: {exc}")
    finally:
        os.unlink(tmp_path)

    if not raw_chunks:
        raise HTTPException(status_code=422, detail="No text could be extracted from the PDF")

    return {
        "total": len(raw_chunks),
        "chunks": [
            {"index": i, "page": chunk.metadata.get("page", "?"), "text": chunk.page_content}
            for i, chunk in enumerate(raw_chunks)
        ],
    }


@app.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    chunk_size: int = Form(default=500),
    chunk_overlap: int = Form(default=50),
):
    """
    Accept a PDF upload, split it into chunks with LangChain,
    generate HuggingFace embeddings, and insert all chunks into Supabase
    using SupabaseVectorStore into the 'documents' table.

    Form fields
    -----------
    file          : PDF file (required)
    chunk_size    : Characters per chunk (default 500)
    chunk_overlap : Overlap between chunks (default 50)
    """

    # Validate file type
    is_pdf = file.content_type == "application/pdf" or (
        file.filename and file.filename.lower().endswith(".pdf")
    )
    if not is_pdf:
        raise HTTPException(status_code=415, detail="Only PDF files are supported")

    table_name = DOCUMENTS_TABLE
    document_name = file.filename or "upload.pdf"

    # Write upload to a temp file so PyPDFLoader can read it
    pdf_bytes = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ".", " ", ""],
        )
        raw_chunks = splitter.split_documents(loader.load())
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"PDF processing failed: {exc}")
    finally:
        os.unlink(tmp_path)

    if not raw_chunks:
        raise HTTPException(status_code=422, detail="No text could be extracted from the PDF")

    # Attach consistent metadata to every chunk (same fields as populate_database.py)
    docs_for_store = []
    for i, chunk in enumerate(raw_chunks):
        meta = {
            "source": document_name,
            "chunk_id": i,
            "document_name": document_name,
            **(chunk.metadata if isinstance(chunk, Document) else {}),
        }
        docs_for_store.append(Document(page_content=chunk.page_content, metadata=meta))

    # Embed and upload via SupabaseVectorStore (same as populate_database.py)
    try:
        embeddings = HuggingFaceEmbeddings(model_name=DEFAULT_MODEL)
        supabase = _supabase_client()
        SupabaseVectorStore.from_documents(
            documents=docs_for_store,
            embedding=embeddings,
            client=supabase,
            table_name=table_name,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Upload to Supabase failed: {exc}")

    # Register in master table (non-fatal if it fails)
    _register_document(supabase, "", table_name, document_name, len(docs_for_store))

    return {
        "inserted": len(docs_for_store),
        "table": table_name,
        "source": document_name,
    }


@app.post("/ingest-chunks")
async def ingest_chunks(
    document_name: str = Form(...),
    chunks: str = Form(...),   # JSON array of {index, page, text}
):
    """
    Accept pre-edited chunks (from the /preview + UI edit flow),
    embed them, and save to Supabase — skipping re-chunking.
    """
    try:
        chunk_list: list = json.loads(chunks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="'chunks' is not valid JSON")

    if not chunk_list:
        raise HTTPException(status_code=422, detail="No chunks provided")

    docs_for_store = [
        Document(
            page_content=c["text"],
            metadata={
                "source": document_name,
                "chunk_id": c["index"],
                "document_name": document_name,
                "page": c.get("page", 0),
            },
        )
        for c in chunk_list
        if c.get("text", "").strip()
    ]

    if not docs_for_store:
        raise HTTPException(status_code=422, detail="All chunks are empty after editing")

    try:
        embeddings = HuggingFaceEmbeddings(model_name=DEFAULT_MODEL)
        supabase = _supabase_client()
        SupabaseVectorStore.from_documents(
            documents=docs_for_store,
            embedding=embeddings,
            client=supabase,
            table_name=DOCUMENTS_TABLE,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Upload to Supabase failed: {exc}")

    _register_document(supabase, "", DOCUMENTS_TABLE, document_name, len(docs_for_store))

    return {
        "inserted": len(docs_for_store),
        "table": DOCUMENTS_TABLE,
        "source": document_name,
    }
