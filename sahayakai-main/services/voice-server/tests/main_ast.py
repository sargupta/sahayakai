"""Shared helpers for the gates that read main.py's handlers (AST + behaviour)."""

from __future__ import annotations

import ast
import asyncio
from pathlib import Path

from bot_harness import FrameDirection, TranscriptionFrame, run_from_recorder
from src.opt_out import SUPPRESSION_COLLECTION

MAIN = Path(__file__).resolve().parents[1] / "src" / "main.py"
SOURCE = MAIN.read_text(encoding="utf-8")

PHONE = "+919800000101"
RECORD = {
    "parentPhone": PHONE, "teacherUid": "teacher-test-1", "classId": "class-test-1",
    "studentId": "student-test-1", "studentName": "Aarav", "reason": "consecutive_absences",
    "parentLanguage": "Hindi", "teacherName": "Ms. Sharma", "schoolName": "Demo Public School",
}


def call_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Call):
        f = node.func
        if isinstance(f, ast.Name):
            return f.id
        if isinstance(f, ast.Attribute):
            return f.attr
    return None


def handlers(tree: ast.Module) -> list[ast.AsyncFunctionDef]:
    """Functions registered as routes on the FastAPI app."""
    out = []
    for node in tree.body:
        if isinstance(node, ast.AsyncFunctionDef):
            for dec in node.decorator_list:
                if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and \
                        isinstance(dec.func.value, ast.Name) and dec.func.value.id == "app":
                    out.append(node)
                    break
    return out


def suppressions(db) -> list[tuple]:
    return [w for w in db.writes if w[1] == SUPPRESSION_COLLECTION]


def opt_out_requests(db) -> list[dict]:
    """Every optOutRequested map the engine recorded on an outreach."""
    return [w[3]["optOutRequested"] for w in db.writes
            if w[0] == "update" and w[1] == "parent_outreach" and "optOutRequested" in w[3]]


async def say(text: str) -> None:
    run = run_from_recorder()
    guards = [p for p in run.processors if type(p).__name__ == "StopRequestGuard"]
    for guard in guards:
        await guard.process_frame(TranscriptionFrame(text=text), FrameDirection.DOWNSTREAM)
    for _ in range(5):
        await asyncio.sleep(0)
