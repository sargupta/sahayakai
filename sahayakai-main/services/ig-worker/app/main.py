"""SahayakAI Instagram (unofficial) worker.

Wraps instagrapi behind a small FastAPI service so n8n / Next.js can drive
DMs, posts, and scrape lookups via plain HTTP. Sessions are persisted to
Redis so container restarts do not trigger fresh logins (which themselves
look like ban-worthy behaviour).

Risk model: only burner accounts and the user's personal IG business account
(initially) sit on this worker. The @sahayakai brand handle uses the
official Instagram Graph API and never touches instagrapi.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

import redis
from fastapi import FastAPI, Header, HTTPException, UploadFile, File, Form
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, LoginRequired
from pydantic import BaseModel

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
log = logging.getLogger("ig-worker")

INTERNAL_KEY = os.environ.get("INTERNAL_API_KEY")
if not INTERNAL_KEY:
    raise RuntimeError("INTERNAL_API_KEY is required")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
r = redis.from_url(REDIS_URL, decode_responses=True)

DAILY_CAPS = {
    "dm": int(os.environ.get("IG_CAP_DM", "50")),
    "follow": int(os.environ.get("IG_CAP_FOLLOW", "30")),
    "like": int(os.environ.get("IG_CAP_LIKE", "60")),
    "comment": int(os.environ.get("IG_CAP_COMMENT", "20")),
}

app = FastAPI(title="SahayakAI ig-worker", version="0.1.0")

# ───────── auth + helpers ─────────

def _auth(x_internal_key: Optional[str]):
    if x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")


def _session_key(account: str) -> str:
    return f"ig:session:{account}"


def _cap_key(account: str, kind: str) -> str:
    from datetime import datetime, timezone
    day = datetime.now(timezone.utc).date().isoformat()
    return f"ig:cap:{account}:{kind}:{day}"


def _check_cap(account: str, kind: str) -> int:
    cap = DAILY_CAPS.get(kind, 0)
    used = int(r.get(_cap_key(account, kind)) or 0)
    if used >= cap:
        raise HTTPException(status_code=429, detail={"error": "daily_cap_reached", "kind": kind, "cap": cap})
    return cap - used


def _record_cap(account: str, kind: str) -> None:
    key = _cap_key(account, kind)
    used = r.incr(key)
    if used == 1:
        r.expire(key, 60 * 60 * 36)


def _client_for(account: str, *, proxy: Optional[str] = None) -> Client:
    cl = Client()
    if proxy:
        cl.set_proxy(proxy)
    raw = r.get(_session_key(account))
    if not raw:
        raise HTTPException(status_code=404, detail="no_session_for_account_login_first")
    try:
        cl.set_settings(json.loads(raw))
        cl.get_timeline_feed()  # cheap healthcheck
    except (LoginRequired, ChallengeRequired) as e:
        raise HTTPException(status_code=409, detail={"error": "session_invalid", "type": type(e).__name__})
    return cl


# ───────── models ─────────

class LoginBody(BaseModel):
    account: str
    username: str
    password: str
    proxy: Optional[str] = None
    verification_code: Optional[str] = None  # 2FA / challenge code

class DMBody(BaseModel):
    account: str
    to_username: str
    text: str

class PostBody(BaseModel):
    account: str
    media_url: str   # public URL; worker downloads then uploads
    caption: str
    kind: str = "photo"  # photo | reel | story

class FollowBody(BaseModel):
    account: str
    target_username: str


# ───────── endpoints ─────────

@app.get("/health")
def health():
    return {"ok": True}


@app.post("/login")
def login(body: LoginBody, x_internal_key: str = Header(None)):
    _auth(x_internal_key)
    cl = Client()
    if body.proxy:
        cl.set_proxy(body.proxy)
    try:
        if body.verification_code:
            cl.login(body.username, body.password, verification_code=body.verification_code)
        else:
            cl.login(body.username, body.password)
    except ChallengeRequired:
        # Caller must re-submit /login with verification_code
        return {"status": "challenge_required"}
    r.set(_session_key(body.account), json.dumps(cl.get_settings()))
    return {"status": "ok", "account": body.account}


@app.post("/dm")
def send_dm(body: DMBody, x_internal_key: str = Header(None)):
    _auth(x_internal_key)
    _check_cap(body.account, "dm")
    cl = _client_for(body.account)
    user_id = cl.user_id_from_username(body.to_username)
    cl.direct_send(body.text, [user_id])
    _record_cap(body.account, "dm")
    return {"ok": True}


@app.post("/follow")
def follow(body: FollowBody, x_internal_key: str = Header(None)):
    _auth(x_internal_key)
    _check_cap(body.account, "follow")
    cl = _client_for(body.account)
    user_id = cl.user_id_from_username(body.target_username)
    cl.user_follow(user_id)
    _record_cap(body.account, "follow")
    return {"ok": True}


@app.post("/post")
def post(body: PostBody, x_internal_key: str = Header(None)):
    _auth(x_internal_key)
    cl = _client_for(body.account)
    import httpx
    import tempfile
    with httpx.stream("GET", body.media_url, follow_redirects=True, timeout=30.0) as resp:
        resp.raise_for_status()
        suffix = ".jpg" if body.kind != "reel" else ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            for chunk in resp.iter_bytes():
                f.write(chunk)
            path = f.name
    if body.kind == "reel":
        media = cl.clip_upload(path, caption=body.caption)
    elif body.kind == "story":
        media = cl.photo_upload_to_story(path, caption=body.caption)
    else:
        media = cl.photo_upload(path, caption=body.caption)
    return {"ok": True, "media_id": media.id}


@app.get("/caps/{account}")
def caps(account: str, x_internal_key: str = Header(None)):
    _auth(x_internal_key)
    out = {}
    for kind, cap in DAILY_CAPS.items():
        used = int(r.get(_cap_key(account, kind)) or 0)
        out[kind] = {"used": used, "cap": cap, "remaining": max(0, cap - used)}
    return out
