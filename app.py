from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, validates, relationship
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

# Create FastAPI app
app = FastAPI(title="JQ Filter Editor")

# Mount static files
app.mount("/static", StaticFiles(directory="static/"), name="static")

# Setup templates
templates = Jinja2Templates(directory="templates")

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./filters.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class JQFilter(Base):
    __tablename__ = "jq_filters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    value = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    filter_expression = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    samples = relationship("Sample", back_populates="filter", cascade="all, delete-orphan")

    @validates('value')
    def convert_upper(self, key, value):
        return value.lower().replace(" ", "_")


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    filter_id = Column(Integer, ForeignKey("jq_filters.id", ondelete="CASCADE"), nullable=False)
    payload = Column(Text, nullable=False)
    label = Column(String(200), nullable=True)
    received_at = Column(DateTime, default=datetime.utcnow)

    filter = relationship("JQFilter", back_populates="samples")


# Pydantic Models
class FilterBase(BaseModel):
    name: str
    description: Optional[str] = None
    value: str
    filter_expression: str

class FilterCreate(FilterBase):
    pass

class Filter(FilterBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

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
    id: int
    filter_id: int
    payload: str
    label: Optional[str] = None
    received_at: datetime

    class Config:
        from_attributes = True

# Create database tables
Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/filters", response_model=List[Filter])
async def get_filters(db: Session = Depends(get_db)):
    filters = db.query(JQFilter).all()
    return filters

@app.post("/api/filters", response_model=Filter, status_code=201)
async def create_filter(filter: FilterCreate, db: Session = Depends(get_db)):
    try:
        # Validate the filter expression by compiling it
        jq.compile(filter.filter_expression)

        db_filter = JQFilter(
            name=filter.name,
            description=filter.description,
            value=filter.value,
            filter_expression=filter.filter_expression
        )
        db.add(db_filter)
        db.commit()
        db.refresh(db_filter)
        return db_filter
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/filters/{filter_id}", response_model=Filter)
async def get_filter(filter_id: int, db: Session = Depends(get_db)):
    filter_obj = db.query(JQFilter).filter(JQFilter.id == filter_id).first()
    if filter_obj is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    return filter_obj

@app.put("/api/filters/{filter_id}", response_model=Filter)
async def update_filter(filter_id: int, filter: FilterCreate, db: Session = Depends(get_db)):
    db_filter = db.query(JQFilter).filter(JQFilter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")

    try:
        # Validate the filter expression by compiling it
        jq.compile(filter.filter_expression)

        db_filter.name = filter.name
        db_filter.value = filter.value
        db_filter.description = filter.description
        db_filter.filter_expression = filter.filter_expression

        db.commit()
        db.refresh(db_filter)
        return db_filter
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/filters/{filter_id}", status_code=204)
async def delete_filter(filter_id: int, db: Session = Depends(get_db)):
    db_filter = db.query(JQFilter).filter(JQFilter.id == filter_id).first()
    if db_filter is None:
        raise HTTPException(status_code=404, detail="Filter not found")

    db.delete(db_filter)
    db.commit()
    return None

@app.post("/api/test", response_model=FilterTestResponse)
async def test_filter(filter_test: FilterTest):
    try:
        # Parse the input JSON
        input_json = json.loads(filter_test.input_json)

        # Compile and apply the filter
        filter_expression = jq.compile(filter_test.filter_expression)
        result = filter_expression.input(input_json).all()

        return FilterTestResponse(result=result, error=None)
    except json.JSONDecodeError:
        return FilterTestResponse(result=None, error="Invalid JSON input")
    except Exception as e:
        return FilterTestResponse(result=None, error=str(e))

@app.post("/api/test-bulk", response_model=BulkFilterTestResponse)
async def test_filter_bulk(filter_test: BulkFilterTest):
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
async def get_samples(filter_id: int, db: Session = Depends(get_db)):
    filter_obj = db.query(JQFilter).filter(JQFilter.id == filter_id).first()
    if filter_obj is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    return db.query(Sample).filter(Sample.filter_id == filter_id).order_by(Sample.received_at.desc()).all()

@app.post("/api/filters/{filter_id}/samples", response_model=SampleOut, status_code=201)
async def create_sample(filter_id: int, sample: SampleCreate, db: Session = Depends(get_db)):
    filter_obj = db.query(JQFilter).filter(JQFilter.id == filter_id).first()
    if filter_obj is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    # Validate JSON
    try:
        json.loads(sample.payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    db_sample = Sample(filter_id=filter_id, payload=sample.payload, label=sample.label)
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample

@app.delete("/api/samples/{sample_id}", status_code=204)
async def delete_sample(sample_id: int, db: Session = Depends(get_db)):
    sample = db.query(Sample).filter(Sample.id == sample_id).first()
    if sample is None:
        raise HTTPException(status_code=404, detail="Sample not found")
    db.delete(sample)
    db.commit()
    return None

@app.delete("/api/filters/{filter_id}/samples", status_code=204)
async def delete_all_samples(filter_id: int, db: Session = Depends(get_db)):
    filter_obj = db.query(JQFilter).filter(JQFilter.id == filter_id).first()
    if filter_obj is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    db.query(Sample).filter(Sample.filter_id == filter_id).delete()
    db.commit()
    return None

# ---- Webhook endpoint ----

@app.post("/webhook/{filter_id}", status_code=201)
async def webhook_receive(filter_id: int, request: Request, db: Session = Depends(get_db)):
    filter_obj = db.query(JQFilter).filter(JQFilter.id == filter_id).first()
    if filter_obj is None:
        raise HTTPException(status_code=404, detail="Filter not found")
    try:
        body = await request.body()
        payload = body.decode("utf-8")
        # Validate it's JSON
        json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Request body must be valid JSON")
    db_sample = Sample(filter_id=filter_id, payload=payload, label="webhook")
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return {"id": db_sample.id, "status": "received"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
