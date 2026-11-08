"""Embeddings for semantic clustering/search: provider embeddings when available, else local feature hashing."""

from __future__ import annotations

import hashlib
import re

import numpy as np

from app.models.review import EMBEDDING_DIM

_TOKEN = re.compile(r"[a-z؀-ۿ]{2,}")
_STOP = {"the", "and", "was", "were", "for", "with", "that", "this", "but", "they", "have", "had", "are", "you",
         "not", "very", "our", "their", "there", "too", "its", "it's", "from", "all", "out", "about", "would", "been"}


def local_embedding(text: str) -> list[float]:
    """Deterministic hashed bag of unigrams + bigrams, L2-normalised. Good enough to group near-identical themes."""
    vec = np.zeros(EMBEDDING_DIM, dtype=np.float32)
    tokens = [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]
    grams = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:], strict=False)]
    for g in grams:
        h = int(hashlib.md5(g.encode()).hexdigest(), 16)
        vec[h % EMBEDDING_DIM] += 1.0 if (h >> 8) & 1 else -1.0
    norm = float(np.linalg.norm(vec))
    return (vec / norm).tolist() if norm else vec.tolist()


def cosine(a: list[float] | np.ndarray, b: list[float] | np.ndarray) -> float:
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    na, nb = float(np.linalg.norm(va)), float(np.linalg.norm(vb))
    return float(va @ vb / (na * nb)) if na and nb else 0.0


def greedy_cluster(vectors: list[list[float]], threshold: float) -> list[int]:
    """Assign each vector to the first centroid with cosine >= threshold; returns a cluster index per vector."""
    centroids: list[np.ndarray] = []
    counts: list[int] = []
    labels: list[int] = []
    for v in vectors:
        arr = np.asarray(v, dtype=np.float32)
        best, best_sim = -1, threshold
        for i, c in enumerate(centroids):
            sim = cosine(arr, c)
            if sim >= best_sim:
                best, best_sim = i, sim
        if best == -1:
            centroids.append(arr.copy())
            counts.append(1)
            labels.append(len(centroids) - 1)
        else:
            counts[best] += 1
            centroids[best] = centroids[best] + (arr - centroids[best]) / counts[best]
            labels.append(best)
    return labels
