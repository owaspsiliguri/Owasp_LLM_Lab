"""ChromaDB access. Uses the Chroma server when CHROMA_URL is set (Docker), else an embedded, file-backed client under LAB_DATA_DIR.

Embeddings are computed locally with a deterministic hashed bag-of-words function, so no model
download or cloud call is needed and retrieval results are reproducible.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
import uuid
from contextlib import contextmanager
from functools import lru_cache
from typing import Any
from urllib.parse import urlparse

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb  # noqa: E402
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings  # noqa: E402

DIM = 384
_TOKEN = re.compile(r"[a-z0-9.]+")


class HashEmbedding(chromadb.EmbeddingFunction):
    def __init__(self) -> None:  # noqa: D107 - required to avoid base-class warnings
        pass

    def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:  # noqa: A002 - chroma API name
        return [self.embed(text) for text in input]

    @staticmethod
    def embed(text: str) -> list[float]:
        vec = [0.0] * DIM
        for tok in _TOKEN.findall(text.lower()):
            h = int.from_bytes(hashlib.sha256(tok.encode()).digest()[:4], "big")
            vec[h % DIM] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    @staticmethod
    def name() -> str:
        return "lab-hash-embedding"


class VectorStoreError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _client() -> Any:
    url = get_settings().chroma_url
    try:
        if url:
            parsed = urlparse(url)
            return chromadb.HttpClient(host=parsed.hostname or "chromadb", port=parsed.port or 8000,
                                       settings=ChromaSettings(anonymized_telemetry=False))
        # A file-backed client: Chroma's in-memory SQLite is per-thread, and requests run in a thread pool.
        path = get_settings().data_dir / "chroma"
        path.mkdir(parents=True, exist_ok=True)
        return chromadb.PersistentClient(path=str(path), settings=ChromaSettings(anonymized_telemetry=False))
    except Exception as exc:  # chroma raises assorted types on connection problems
        raise VectorStoreError(f"ChromaDB unavailable: {exc.__class__.__name__}") from exc


def mode() -> str:
    return "server" if get_settings().chroma_url else "in-process"


def status() -> dict[str, Any]:
    try:
        _client().heartbeat()
        return {"reachable": True, "mode": mode()}
    except Exception:  # noqa: BLE001 - report, never raise from health
        return {"reachable": False, "mode": mode()}


@contextmanager
def scratch_collection(prefix: str):
    """A uniquely named collection that is always deleted afterwards (labs never share state)."""
    client = _client()
    name = f"{prefix}-{uuid.uuid4().hex[:12]}"
    try:
        col = client.create_collection(name=name, embedding_function=HashEmbedding(), metadata={"hnsw:space": "cosine"})
    except Exception as exc:
        raise VectorStoreError(f"ChromaDB unavailable: {exc.__class__.__name__}") from exc
    try:
        yield col
    finally:
        try:
            client.delete_collection(name)
        except Exception:  # noqa: BLE001, S110 - cleanup is best effort
            pass


def query(col: Any, text: str, n: int) -> list[dict[str, Any]]:
    count = col.count()
    if count == 0:
        return []
    res = col.query(query_texts=[text], n_results=min(n, count))
    out = []
    for i, doc_id in enumerate(res["ids"][0]):
        out.append({"id": doc_id, "text": res["documents"][0][i], "meta": res["metadatas"][0][i],
                    "similarity": round(1.0 - float(res["distances"][0][i]), 4)})
    return out
