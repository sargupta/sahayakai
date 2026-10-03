"""Live voice app context: validation, freshness and fail-soft behaviour.

The web app is the source of truth for sections / workflows / actions; this
store only bounds and keeps the latest push. Nothing here may grant an action
the screen did not offer.
"""
from __future__ import annotations

from sahayakai_agents.agents.vidya_voice.app_context import AppContextStore

FRAME = {
    "knowledge": "SahayakAI sections ... - attendance | Attendance (/attendance) ... - my-library | My Library ...",
    "sections": ["home", "attendance", "my-library"],
    "screen": {
        "path": "/attendance/c1",
        "section": "Attendance",
        "screenId": "attendance.class",
        "entities": {"className": "Class 7A", "absentCount": 2, "absentStudents": ["Ravi"], "attendanceSubmitted": False},
        "capabilities": [
            {"id": "attendance.mark_all_present", "enabled": True, "description": "Mark every student present", "params": [], "requiresConfirmation": False},
            {"id": "attendance.submit", "enabled": True, "description": "Submit today's attendance", "params": [], "requiresConfirmation": True},
            {"id": "students.open_add", "enabled": False, "reason": "40-student limit reached", "params": [], "requiresConfirmation": False},
        ],
        "fingerprint": "fp-1",
    },
}


def test_unavailable_until_the_app_pushes_context() -> None:
    store = AppContextStore()
    assert not store.available
    assert store.for_model()["status"] == "unavailable"
    assert store.check_capability("attendance.submit") == ("unavailable", None)
    assert store.check_destination("attendance") is not None


def test_serves_the_app_guide_and_current_screen() -> None:
    store = AppContextStore()
    assert store.update(FRAME)
    out = store.for_model()
    assert out["status"] == "ok"
    assert "My Library" in out["appGuide"]
    assert out["currentScreen"]["section"] == "Attendance"
    assert out["currentScreen"]["whatTheScreenShows"]["className"] == "Class 7A"
    assert {a["id"] for a in out["currentScreen"]["availableActions"]} == {
        "attendance.mark_all_present", "attendance.submit", "students.open_add",
    }


def test_route_change_replaces_the_screen_and_keeps_knowledge() -> None:
    store = AppContextStore()
    store.update(FRAME)
    store.update({"screen": {"path": "/my-library", "section": "My Library", "screenId": "my-library", "fingerprint": "fp-2"}})
    out = store.for_model()
    assert out["currentScreen"]["section"] == "My Library"
    assert out["currentScreen"]["availableActions"] == []
    assert "My Library" in out["appGuide"]  # knowledge kept from the earlier push


def test_invalid_frame_is_dropped_and_previous_context_kept() -> None:
    store = AppContextStore()
    store.update(FRAME)
    assert not store.update({"screen": {"entities": {"x": {"nested": "object"}}}})
    assert not store.update("not an object")
    assert not store.update({"screen": {"entities": {"big": ["y" * 200] * 40}}})  # over the entity budget
    assert store.for_model()["currentScreen"]["section"] == "Attendance"


def test_capability_checks_follow_what_the_screen_offered() -> None:
    store = AppContextStore()
    store.update(FRAME)
    assert store.check_capability("attendance.submit")[0] == "ok"
    assert store.check_capability("students.open_add")[0] == "disabled"
    assert store.check_capability("library.filter")[0] == "unavailable"  # real action, other screen
    assert store.check_capability("grant_admin")[0] == "unavailable"


def test_navigation_only_to_sections_the_app_listed() -> None:
    store = AppContextStore()
    store.update(FRAME)
    assert store.check_destination("my-library") is None
    assert store.check_destination("/admin/cost-dashboard") is not None


def test_fingerprint_is_the_screen_version_the_model_saw() -> None:
    store = AppContextStore()
    store.update(FRAME)
    store.for_model()  # model reads fp-1
    store.update({**FRAME, "screen": {**FRAME["screen"], "fingerprint": "fp-2"}})  # screen changed after
    assert store.fingerprint_for_action() == "fp-1"  # browser will refuse as stale


def test_unknown_extra_fields_do_not_drop_context() -> None:
    store = AppContextStore()
    assert store.update({**FRAME, "futureField": 1})


def test_missing_requires_confirmation_defaults_to_confirm() -> None:
    store = AppContextStore()
    store.update({"sections": ["home"], "screen": {"capabilities": [{"id": "attendance.submit", "enabled": True}]}})
    _, cap = store.check_capability("attendance.submit")
    assert cap is not None and cap.requiresConfirmation is True
