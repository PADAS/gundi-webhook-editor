import os
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from datetime import datetime, timedelta
from pydantic import BaseModel
import json
# Import jq with a try-except to handle the linter error
try:
    import jq
except ImportError:
    # This is just for the linter, the actual import will work at runtime
    jq = None
from typing import List, Optional
from anthropic import AnthropicVertex
from auth import verify_firebase_token, _init_firebase

VERTEX_AI_PROJECT = os.environ.get("VERTEX_AI_PROJECT") or os.environ.get("GCLOUD_PROJECT") or os.environ.get("FIREBASE_PROJECT_ID")
VERTEX_AI_LOCATION = os.environ.get("VERTEX_AI_LOCATION", "us-east5")

_vertex_client: Optional[AnthropicVertex] = None

def _get_vertex_client() -> Optional[AnthropicVertex]:
    global _vertex_client
    if _vertex_client is None:
        if not VERTEX_AI_PROJECT:
            return None
        try:
            _vertex_client = AnthropicVertex(project_id=VERTEX_AI_PROJECT, region=VERTEX_AI_LOCATION)
        except Exception:
            return None
    return _vertex_client

# Create FastAPI app
APP_VERSION = os.environ.get("APP_VERSION", "dev")
BUILD_SHA = os.environ.get("BUILD_SHA", "local")
BUILD_TIME = os.environ.get("BUILD_TIME", "unknown")
GITHUB_REPO_URL = os.environ.get("GITHUB_REPO_URL", "")

app = FastAPI(title="Gundi Webhook Editor")

# Mount static files
app.mount("/static", StaticFiles(directory="static/"), name="static")

# Setup templates
templates = Jinja2Templates(directory="templates")

# Firestore client (lazy init)
_firestore_db = None


def get_firestore():
    global _firestore_db
    if _firestore_db is None:
        _init_firebase()
        from google.cloud import firestore
        _firestore_db = firestore.Client(
            project=os.environ.get("GCLOUD_PROJECT") or os.environ.get("FIREBASE_PROJECT_ID"),
            database="(default)",
        )
    return _firestore_db


def normalize_value(value: str) -> str:
    return value.lower().replace(" ", "_")


def delete_subcollection(parent_ref, subcollection_name, batch_size=100):
    db = get_firestore()
    coll_ref = parent_ref.collection(subcollection_name)
    while True:
        docs = list(coll_ref.limit(batch_size).stream())
        if not docs:
            break
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()


def _trim_samples_to_limit(filter_ref, max_samples: int):
    from google.cloud import firestore as _firestore
    samples_ref = filter_ref.collection("samples")
    count_result = samples_ref.count().get()
    total = count_result[0][0].value
    if total > max_samples:
        oldest = (
            samples_ref
            .order_by("received_at", direction=_firestore.Query.ASCENDING)
            .limit(total - max_samples)
            .stream()
        )
        for doc in oldest:
            doc.reference.delete()


# Pydantic Models
class FilterBase(BaseModel):
    name: str
    description: Optional[str] = None
    value: str
    filter_expression: str
    max_samples: int = 100
    retention_days: Optional[int] = None
    enabled: bool = True

class FilterCreate(FilterBase):
    pass

class Filter(FilterBase):
    id: str
    created_at: datetime
    updated_at: datetime
    owner_uid: Optional[str] = None
    shared_with: Optional[List[str]] = None

class FilterTest(BaseModel):
    filter_expression: str
    input_json: str

class FilterTestResponse(BaseModel):
    result: Optional[List] = None
    error: Optional[str] = None

class BulkFilterTest(BaseModel):
    filter_expression: str
    inputs: List[str]

class BulkFilterTestResponse(BaseModel):
    results: List[FilterTestResponse]

class ShareRequest(BaseModel):
    email: str

class AIChatRequest(BaseModel):
    message: str
    filter_expression: Optional[str] = None
    sample_json: Optional[str] = None
    history: Optional[List[dict]] = None

class AIChatResponse(BaseModel):
    response: Optional[str] = None
    error: Optional[str] = None

class SampleCreate(BaseModel):
    payload: str
    label: Optional[str] = None

class SampleOut(BaseModel):
    id: str
    filter_id: str
    payload: str
    label: Optional[str] = None
    received_at: datetime


def _is_owner(doc_data: dict, user: dict) -> bool:
    owner_uid = doc_data.get("owner_uid")
    return owner_uid is not None and owner_uid == user["uid"]


def _can_read(doc_data: dict, user: dict) -> bool:
    owner_uid = doc_data.get("owner_uid")
    if owner_uid is None:
        return True  # legacy filter, visible to all
    if owner_uid == user["uid"]:
        return True
    if user.get("email") in doc_data.get("shared_with", []):
        return True
    return False


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/config")
async def get_config():
    config = {
        "apiKey": os.environ.get("FIREBASE_API_KEY", ""),
        "authDomain": os.environ.get("FIREBASE_AUTH_DOMAIN", ""),
        "projectId": os.environ.get("FIREBASE_PROJECT_ID", ""),
        "authDisabled": os.environ.get("AUTH_DISABLED", "").lower() == "true",
        "appVersion": APP_VERSION,
        "buildSha": BUILD_SHA,
        "buildTime": BUILD_TIME,
    }
    if GITHUB_REPO_URL:
        config["githubRepoUrl"] = GITHUB_REPO_URL
    emulator_url = os.environ.get("FIREBASE_AUTH_EMULATOR_URL", "")
    if emulator_url:
        config["authEmulatorUrl"] = emulator_url
    return config

@app.get("/api/filters", response_model=List[Filter])
async def get_filters(user=Depends(verify_firebase_token)):
    db = get_firestore()
    docs = db.collection("filters").stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        if not _can_read(data, user):
            continue
        results.append(Filter(
            id=doc.id,
            name=data["name"],
            value=data["value"],
            description=data.get("description"),
            filter_expression=data["filter_expression"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            owner_uid=data.get("owner_uid"),
            shared_with=data.get("shared_with", []),
            max_samples=data.get("max_samples", 100),
            retention_days=data.get("retention_days"),
            enabled=data.get("enabled", True),
        ))
    return results

@app.post("/api/filters", response_model=Filter, status_code=201)
async def create_filter(filter: FilterCreate, user=Depends(verify_firebase_token)):
    try:
        jq.compile(filter.filter_expression)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    db = get_firestore()
    value = normalize_value(filter.value)
    now = datetime.utcnow()

    @firestore_transaction(db)
    def txn_create(transaction):
        val_ref = db.collection("filter_values").document(value)
        val_snap = val_ref.get(transaction=transaction)
        if val_snap.exists:
            raise HTTPException(status_code=409, detail="A filter with this value already exists")

        filter_ref = db.collection("filters").document()
        transaction.set(filter_ref, {
            "name": filter.name,
            "value": value,
            "description": filter.description,
            "filter_expression": filter.filter_expression,
            "created_at": now,
            "updated_at": now,
            "owner_uid": user["uid"],
            "shared_with": [],
            "max_samples": filter.max_samples,
            "retention_days": filter.retention_days,
            "enabled": filter.enabled,
        })
        transaction.set(val_ref, {"filter_id": filter_ref.id})
        return filter_ref.id

    doc_id = txn_create()
    return Filter(
        id=doc_id,
        name=filter.name,
        value=value,
        description=filter.description,
        filter_expression=filter.filter_expression,
        created_at=now,
        updated_at=now,
        owner_uid=user["uid"],
        shared_with=[],
        max_samples=filter.max_samples,
        retention_days=filter.retention_days,
        enabled=filter.enabled,
    )

@app.get("/api/filters/{filter_id}", response_model=Filter)
async def get_filter(filter_id: str, user=Depends(verify_firebase_token)):
    db = get_firestore()
    doc = db.collection("filters").document(filter_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Filter not found")
    data = doc.to_dict()
    if not _can_read(data, user):
        raise HTTPException(status_code=403, detail="Access denied")
    return Filter(
        id=doc.id,
        name=data["name"],
        value=data["value"],
        description=data.get("description"),
        filter_expression=data["filter_expression"],
        created_at=data["created_at"],
        updated_at=data["updated_at"],
        owner_uid=data.get("owner_uid"),
        shared_with=data.get("shared_with", []),
        max_samples=data.get("max_samples", 100),
        retention_days=data.get("retention_days"),
        enabled=data.get("enabled", True),
    )

@app.put("/api/filters/{filter_id}", response_model=Filter)
async def update_filter(filter_id: str, filter: FilterCreate, background_tasks: BackgroundTasks, user=Depends(verify_firebase_token)):
    try:
        jq.compile(filter.filter_expression)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    db = get_firestore()
    new_value = normalize_value(filter.value)
    now = datetime.utcnow()

    @firestore_transaction(db)
    def txn_update(transaction):
        filter_ref = db.collection("filters").document(filter_id)
        snap = filter_ref.get(transaction=transaction)
        if not snap.exists:
            raise HTTPException(status_code=404, detail="Filter not found")

        old_data = snap.to_dict()
        if old_data.get("owner_uid") and not _is_owner(old_data, user):
            raise HTTPException(status_code=403, detail="Only the owner can edit this filter")
        old_value = old_data["value"]

        if new_value != old_value:
            new_val_ref = db.collection("filter_values").document(new_value)
            new_val_snap = new_val_ref.get(transaction=transaction)
            if new_val_snap.exists:
                raise HTTPException(status_code=409, detail="A filter with this value already exists")
            # Delete old value index, set new one
            old_val_ref = db.collection("filter_values").document(old_value)
            transaction.delete(old_val_ref)
            transaction.set(new_val_ref, {"filter_id": filter_id})

        transaction.update(filter_ref, {
            "name": filter.name,
            "value": new_value,
            "description": filter.description,
            "filter_expression": filter.filter_expression,
            "updated_at": now,
            "max_samples": filter.max_samples,
            "retention_days": filter.retention_days,
            "enabled": filter.enabled,
        })
        return old_data["created_at"], old_data.get("owner_uid"), old_data.get("shared_with", [])

    created_at, owner_uid, shared_with = txn_update()
    filter_ref = db.collection("filters").document(filter_id)
    background_tasks.add_task(_trim_samples_to_limit, filter_ref, filter.max_samples)
    return Filter(
        id=filter_id,
        name=filter.name,
        value=new_value,
        description=filter.description,
        filter_expression=filter.filter_expression,
        created_at=created_at,
        updated_at=now,
        owner_uid=owner_uid,
        shared_with=shared_with,
        max_samples=filter.max_samples,
        retention_days=filter.retention_days,
        enabled=filter.enabled,
    )

@app.delete("/api/filters/{filter_id}", status_code=204)
async def delete_filter(filter_id: str, user=Depends(verify_firebase_token)):
    db = get_firestore()
    filter_ref = db.collection("filters").document(filter_id)
    snap = filter_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Filter not found")

    data = snap.to_dict()
    if data.get("owner_uid") and not _is_owner(data, user):
        raise HTTPException(status_code=403, detail="Only the owner can delete this filter")
    # Delete samples subcollection
    delete_subcollection(filter_ref, "samples")
    # Delete filter_values index
    db.collection("filter_values").document(data["value"]).delete()
    # Delete filter doc
    filter_ref.delete()
    return None

@app.post("/api/filters/{filter_id}/share")
async def share_filter(filter_id: str, req: ShareRequest, user=Depends(verify_firebase_token)):
    db = get_firestore()
    from google.cloud.firestore import ArrayUnion
    filter_ref = db.collection("filters").document(filter_id)
    snap = filter_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Filter not found")
    data = snap.to_dict()
    if not _is_owner(data, user):
        raise HTTPException(status_code=403, detail="Only the owner can share this filter")
    filter_ref.update({"shared_with": ArrayUnion([req.email])})
    updated = filter_ref.get().to_dict()
    return {"shared_with": updated.get("shared_with", [])}


@app.delete("/api/filters/{filter_id}/share/{email}")
async def unshare_filter(filter_id: str, email: str, user=Depends(verify_firebase_token)):
    db = get_firestore()
    from google.cloud.firestore import ArrayRemove
    filter_ref = db.collection("filters").document(filter_id)
    snap = filter_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Filter not found")
    data = snap.to_dict()
    if not _is_owner(data, user):
        raise HTTPException(status_code=403, detail="Only the owner can unshare this filter")
    filter_ref.update({"shared_with": ArrayRemove([email])})
    updated = filter_ref.get().to_dict()
    return {"shared_with": updated.get("shared_with", [])}


@app.post("/api/test", response_model=FilterTestResponse)
async def test_filter(filter_test: FilterTest, user=Depends(verify_firebase_token)):
    try:
        input_json = json.loads(filter_test.input_json)
        filter_expression = jq.compile(filter_test.filter_expression)
        result = filter_expression.input(input_json).all()
        return FilterTestResponse(result=result, error=None)
    except json.JSONDecodeError:
        return FilterTestResponse(result=None, error="Invalid JSON input")
    except Exception as e:
        return FilterTestResponse(result=None, error=str(e))

@app.post("/api/test-bulk", response_model=BulkFilterTestResponse)
async def test_filter_bulk(filter_test: BulkFilterTest, user=Depends(verify_firebase_token)):
    results = []
    try:
        compiled = jq.compile(filter_test.filter_expression)
        for input_str in filter_test.inputs:
            try:
                input_json = json.loads(input_str)
                result = compiled.input(input_json).all()
                results.append(FilterTestResponse(result=result, error=None))
            except json.JSONDecodeError:
                results.append(FilterTestResponse(result=None, error="Invalid JSON input"))
            except Exception as e:
                results.append(FilterTestResponse(result=None, error=str(e)))
    except Exception as e:
        results = [FilterTestResponse(result=None, error=str(e)) for _ in filter_test.inputs]
    return BulkFilterTestResponse(results=results)

# ---- Sample endpoints ----

@app.get("/api/filters/{filter_id}/samples", response_model=List[SampleOut])
async def get_samples(filter_id: str, user=Depends(verify_firebase_token)):
    db = get_firestore()
    filter_ref = db.collection("filters").document(filter_id)
    filter_snap = filter_ref.get()
    if not filter_snap.exists:
        raise HTTPException(status_code=404, detail="Filter not found")
    filter_data = filter_snap.to_dict()
    from google.cloud import firestore as _firestore
    query = filter_ref.collection("samples").order_by("received_at", direction=_firestore.Query.DESCENDING)
    retention_days = filter_data.get("retention_days")
    if retention_days:
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        query = query.where("received_at", ">=", cutoff)
    docs = query.stream()
    return [
        SampleOut(
            id=doc.id,
            filter_id=filter_id,
            payload=doc.to_dict()["payload"],
            label=doc.to_dict().get("label"),
            received_at=doc.to_dict()["received_at"],
        )
        for doc in docs
    ]

@app.post("/api/filters/{filter_id}/samples", response_model=SampleOut, status_code=201)
async def create_sample(filter_id: str, sample: SampleCreate, user=Depends(verify_firebase_token)):
    db = get_firestore()
    filter_ref = db.collection("filters").document(filter_id)
    if not filter_ref.get().exists:
        raise HTTPException(status_code=404, detail="Filter not found")
    try:
        json.loads(sample.payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    now = datetime.utcnow()
    sample_ref = filter_ref.collection("samples").document()
    sample_ref.set({
        "payload": sample.payload,
        "label": sample.label,
        "received_at": now,
    })
    return SampleOut(
        id=sample_ref.id,
        filter_id=filter_id,
        payload=sample.payload,
        label=sample.label,
        received_at=now,
    )

@app.put("/api/filters/{filter_id}/samples/{sample_id}", response_model=SampleOut)
async def update_sample(filter_id: str, sample_id: str, sample: SampleCreate, user=Depends(verify_firebase_token)):
    db = get_firestore()
    sample_ref = db.collection("filters").document(filter_id).collection("samples").document(sample_id)
    snap = sample_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Sample not found")
    try:
        json.loads(sample.payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    existing = snap.to_dict()
    sample_ref.update({"payload": sample.payload})
    return SampleOut(
        id=sample_id,
        filter_id=filter_id,
        payload=sample.payload,
        label=existing.get("label"),
        received_at=existing["received_at"],
    )

@app.delete("/api/filters/{filter_id}/samples/{sample_id}", status_code=204)
async def delete_sample(filter_id: str, sample_id: str, user=Depends(verify_firebase_token)):
    db = get_firestore()
    sample_ref = db.collection("filters").document(filter_id).collection("samples").document(sample_id)
    snap = sample_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Sample not found")
    sample_ref.delete()
    return None

@app.delete("/api/filters/{filter_id}/samples", status_code=204)
async def delete_all_samples(filter_id: str, user=Depends(verify_firebase_token)):
    db = get_firestore()
    filter_ref = db.collection("filters").document(filter_id)
    if not filter_ref.get().exists:
        raise HTTPException(status_code=404, detail="Filter not found")
    delete_subcollection(filter_ref, "samples")
    return None

# ---- Webhook endpoint ----

def _lookup_filter_by_value(filter_value: str):
    """Returns (filter_ref, filter_snap) or (None, None) if not found."""
    db = get_firestore()
    val_doc = db.collection("filter_values").document(filter_value).get()
    if val_doc.exists:
        filter_id = val_doc.to_dict()["filter_id"]
        filter_ref = db.collection("filters").document(filter_id)
        return filter_ref, filter_ref.get()
    filter_ref = db.collection("filters").document(filter_value)
    filter_snap = filter_ref.get()
    if filter_snap.exists:
        return filter_ref, filter_snap
    return None, None


@app.get("/webhook/{filter_value:path}")
async def webhook_browser_redirect(filter_value: str, request: Request):
    filter_ref, filter_snap = _lookup_filter_by_value(filter_value)
    if not filter_snap or not filter_snap.exists:
        return templates.TemplateResponse(
            "webhook_not_found.html",
            {"request": request, "filter_value": filter_value},
            status_code=404,
        )
    return RedirectResponse(url=f"/?filter={filter_ref.id}", status_code=302)


@app.post("/webhook/{filter_value:path}", status_code=201)
async def webhook_receive(filter_value: str, request: Request, background_tasks: BackgroundTasks):
    filter_ref, filter_snap = _lookup_filter_by_value(filter_value)

    if not filter_snap or not filter_snap.exists:
        raise HTTPException(status_code=404, detail="Filter not found")

    filter_data = filter_snap.to_dict()
    if not filter_data.get("enabled", True):
        return {"status": "disabled"}

    try:
        body = await request.body()
        payload = body.decode("utf-8")
        json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Request body must be valid JSON")

    now = datetime.utcnow()
    samples_ref = filter_ref.collection("samples")
    sample_ref = samples_ref.document()
    sample_ref.set({
        "payload": payload,
        "label": "webhook",
        "received_at": now,
    })

    max_samples = filter_data.get("max_samples", 100)
    background_tasks.add_task(_trim_samples_to_limit, filter_ref, max_samples)

    return {"id": sample_ref.id, "status": "received"}


@app.post("/api/ai/chat", response_model=AIChatResponse)
async def ai_chat(req: AIChatRequest, user=Depends(verify_firebase_token)):
    client = _get_vertex_client()
    if not client:
        return AIChatResponse(error="AI assistant not configured. Check Vertex AI configuration.")

    system_prompt = (
        "You are a concise jq expert assistant. Help users write and debug jq filter expressions. "
        "When showing jq expressions, use ```jq code blocks. Keep responses short and practical. "
        "If the user provides their current filter or sample JSON, reference them in your answer. "
        "When analyzing a JSON payload, briefly describe its structure and suggest practical jq filters "
        "to extract the most useful fields."
    )

    context_parts = []
    if req.filter_expression:
        context_parts.append(f"Current filter: {req.filter_expression}")
    if req.sample_json:
        context_parts.append(f"Sample input JSON: {req.sample_json}")

    messages = []
    if req.history:
        for h in req.history[-10:]:
            if h.get("role") in ("user", "assistant") and h.get("content"):
                messages.append({"role": h["role"], "content": h["content"]})

    user_message = req.message
    if context_parts:
        user_message = "\n".join(context_parts) + "\n\n" + user_message

    messages.append({"role": "user", "content": user_message})

    try:
        response = client.messages.create(
            model="claude-sonnet-4@20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
        text = response.content[0].text
        return AIChatResponse(response=text)
    except Exception as e:
        return AIChatResponse(error=str(e))


def firestore_transaction(db):
    """Decorator that wraps a function in a Firestore transaction."""
    from google.cloud import firestore as _firestore

    def decorator(func):
        def wrapper():
            result_holder = []

            @_firestore.transactional
            def _in_transaction(transaction):
                result_holder.append(func(transaction))

            _in_transaction(db.transaction())
            return result_holder[0]
        return wrapper
    return decorator


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
