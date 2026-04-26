"""Unit tests for the shadow-diff aggregator scoring math.

We do NOT exercise the Firestore reads or Cloud Monitoring writes here
— those land in integration tests once a deployed environment is
available. The pure scoring helper is what gates the rolling mean, so
pin its behaviour explicitly.
"""
from __future__ import annotations

import os

import pytest

os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "test")

from cloud_functions.shadow_diff_aggregator import main  # noqa: E402

pytestmark = pytest.mark.unit


class TestTfCosine:
    def test_identical_strings_score_1(self) -> None:
        assert main._cosine_tf("hello world", "hello world") == 1.0

    def test_disjoint_strings_score_0(self) -> None:
        assert main._cosine_tf("alpha beta", "gamma delta") == 0.0

    def test_empty_input_scores_0(self) -> None:
        assert main._cosine_tf("", "anything") == 0.0
        assert main._cosine_tf("anything", "") == 0.0
        assert main._cosine_tf("", "") == 0.0

    def test_partial_overlap_in_zero_one(self) -> None:
        score = main._cosine_tf(
            "thank you for taking the call",
            "thank you for the time today",
        )
        assert 0.0 < score < 1.0

    def test_unicode_indic_text(self) -> None:
        # Hindi reply pair — same content, slight word-order shift.
        a = "धन्यवाद रोज दस मिनट पढ़ाई करें"
        b = "रोज दस मिनट पढ़ाई करें धन्यवाद"
        score = main._cosine_tf(a, b)
        # Bag-of-words is order-insensitive; identical token sets → 1.0.
        assert score == 1.0


class TestScorePairDispatch:
    def test_dispatches_to_tf_by_default(self) -> None:
        assert main._score_pair("alpha", "alpha", use_embeddings=False) == 1.0

    def test_dispatches_to_embeddings_when_flagged(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Stub the embedding path so the test doesn't pay the model
        # download cost. We only verify the dispatch.
        called = {"hits": 0}

        def _stub(_a: str, _b: str) -> float:
            called["hits"] += 1
            return 0.42

        monkeypatch.setattr(main, "_embedding_cosine", _stub)
        result = main._score_pair("a", "b", use_embeddings=True)
        assert result == 0.42
        assert called["hits"] == 1
