import os
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from datetime import datetime
from pydantic import BaseModel
import json
# Import jq with a try-except to handle the linter error
try:
    import jq
except ImportError:
    # This is just for the linter, the actual import will work at runtime
    jq = None
from typing import List, Optional
from auth import verify_firebase_token, _init_firebase

# Create FastAPI app
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


# Pydantic Models
class FilterBase(BaseModel):
    name: str
    description: Optional[str] = None
    value: str
    filter_expression: str

class FilterCreate(FilterBase):
    pass

class Filter(FilterBase):
    id: str
    created_at: datetime
    updated_at: datetime

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

class SampleCreate(BaseModel):
    payload: str
    label: Optional[str] = None

class SampleOut(BaseModel):
    id: str
    filter_id: str
    payload: str
    label: Optional[str] = None
    received_at: datetime


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
    }
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
        results.append(Filter(
            id=doc.id,
            name=data["name"],
            value=data["value"],
            description=data.get("description"),
            filter_expression=data["filter_expression"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
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
    )

@app.get("/api/filters/{filter_id}", response_model=Filter)
async def get_filter(filter_id: str, user=Depends(verify_firebase_token)):
    db = get_firestore()
    doc = db.collection("filters").document(filter_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Filter not found")
    data = doc.to_dict()
    return Filter(
        id=doc.id,
        name=data["name"],
        value=data["value"],
        description=data.get("description"),
        filter_expression=data["filter_expression"],
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )

@app.put("/api/filters/{filter_id}", response_model=Filter)
async def update_filter(filter_id: str, filter: FilterCreate, user=Depends(verify_firebase_token)):
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
        })
        return old_data["created_at"]

    created_at = txn_update()
    return Filter(
        id=filter_id,
        name=filter.name,
        value=new_value,
        description=filter.description,
        filter_expression=filter.filter_expression,
        created_at=created_at,
        updated_at=now,
    )

@app.delete("/api/filters/{filter_id}", status_code=204)
async def delete_filter(filter_id: str, user=Depends(verify_firebase_token)):
    db = get_firestore()
    filter_ref = db.collection("filters").document(filter_id)
    snap = filter_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Filter not found")

    data = snap.to_dict()
    # Delete samples subcollection
    delete_subcollection(filter_ref, "samples")
    # Delete filter_values index
    db.collection("filter_values").document(data["value"]).delete()
    # Delete filter doc
    filter_ref.delete()
    return None

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
    if not filter_ref.get().exists:
        raise HTTPException(status_code=404, detail="Filter not found")
    from google.cloud import firestore as _firestore
    docs = filter_ref.collection("samples").order_by("received_at", direction=_firestore.Query.DESCENDING).stream()
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

@app.post("/webhook/{filter_value:path}", status_code=201)
async def webhook_receive(filter_value: str, request: Request):
    db = get_firestore()

    # Look up by value index first
    val_doc = db.collection("filter_values").document(filter_value).get()
    if val_doc.exists:
        filter_id = val_doc.to_dict()["filter_id"]
        filter_ref = db.collection("filters").document(filter_id)
        filter_snap = filter_ref.get()
    else:
        # Fall back to direct doc ID lookup
        filter_ref = db.collection("filters").document(filter_value)
        filter_snap = filter_ref.get()

    if not filter_snap.exists:
        raise HTTPException(status_code=404, detail="Filter not found")

    try:
        body = await request.body()
        payload = body.decode("utf-8")
        json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Request body must be valid JSON")

    now = datetime.utcnow()
    sample_ref = filter_ref.collection("samples").document()
    sample_ref.set({
        "payload": payload,
        "label": "webhook",
        "received_at": now,
    })
    return {"id": sample_ref.id, "status": "received"}


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
