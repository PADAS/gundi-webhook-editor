import os
from fastapi import HTTPException, Request

AUTH_DISABLED = os.environ.get("AUTH_DISABLED", "").lower() == "true"

_firebase_initialized = False


def _init_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return
    import firebase_admin
    firebase_admin.initialize_app()
    _firebase_initialized = True


def _check_allowed(email: str) -> bool:
    allowed = os.environ.get("ALLOWED_EMAILS", "")
    if not allowed:
        return True
    entries = [e.strip() for e in allowed.split(",") if e.strip()]
    for entry in entries:
        if entry.startswith("@"):
            if email.endswith(entry):
                return True
        elif email == entry:
            return True
    return False


async def verify_firebase_token(request: Request):
    if AUTH_DISABLED:
        dev_email = request.headers.get("X-Dev-User", "user-a@dev.local")
        dev_uid = "dev_" + dev_email.replace("@", "_at_").replace(".", "_")
        return {"uid": dev_uid, "email": dev_email}

    _init_firebase()
    from firebase_admin import auth

    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization[7:]
    try:
        decoded = auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    email = decoded.get("email", "")
    if not _check_allowed(email):
        raise HTTPException(status_code=403, detail="Email not authorized")

    return decoded
