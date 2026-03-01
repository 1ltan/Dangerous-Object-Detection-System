import os
import asyncio
from typing import List
from datetime import datetime

from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.staticfiles import StaticFiles

from backend import models, schemas, crud, database
from backend.detector import get_video_stream

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Dangerous Object Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("backend/captures", exist_ok=True)
app.mount("/backend/captures", StaticFiles(directory="backend/captures"), name="captures")

alert_queue = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"WebSocket send error: {e}")

manager = ConnectionManager()

main_loop = None

def add_to_alert_queue(alert_data: dict):
    try:
        if main_loop and alert_queue is not None:
            main_loop.call_soon_threadsafe(alert_queue.put_nowait, alert_data)
        else:
            print("Queue error: main_loop or alert_queue is not set")
    except Exception as e:
        print(f"Queue error: {e}")

async def broadcast_alerts():
    while True:
        alert = await alert_queue.get()
        await manager.broadcast(alert)
        alert_queue.task_done()

@app.on_event("startup")
async def startup_event():
    global main_loop, alert_queue
    main_loop = asyncio.get_running_loop()
    alert_queue = asyncio.Queue()
    asyncio.create_task(broadcast_alerts())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- Routes ---

@app.post("/cameras/", response_model=schemas.Camera)
def create_camera(camera: schemas.CameraCreate, db: Session = Depends(database.get_db)):
    return crud.create_camera(db=db, camera=camera)

@app.get("/cameras/", response_model=List[schemas.Camera])
def read_cameras(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return crud.get_cameras(db, skip=skip, limit=limit)

@app.delete("/cameras/{camera_id}")
def delete_camera(camera_id: int, db: Session = Depends(database.get_db)):
    deleted = crud.delete_camera(db, camera_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Camera not found")
    import backend.detector as detector
    detector.active_streams[camera_id] = False
    return {"status": "deleted"}

@app.get("/video/{camera_id}")
def video_feed(camera_id: int, db: Session = Depends(database.get_db)):
    camera = crud.get_camera(db, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return StreamingResponse(
        get_video_stream(camera_id, camera.url),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

from typing import Optional

@app.get("/incidents/", response_model=List[schemas.Incident])
def read_incidents(
    skip: int = 0, 
    limit: int = 100, 
    status: Optional[str] = None, 
    camera_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(database.get_db)
):
    return crud.get_incidents(
        db, skip=skip, limit=limit, status=status, 
        camera_id=camera_id, start_date=start_date, end_date=end_date
    )

@app.put("/incidents/{incident_id}/status", response_model=schemas.Incident)
def update_status(
    incident_id: int, 
    status: str, 
    new_class: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    incident = crud.update_incident_status(db, incident_id, status, new_class)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@app.delete("/incidents/{incident_id}")
def delete_incident(incident_id: int, db: Session = Depends(database.get_db)):
    return {"status": "deleted"}

from backend import analytics

@app.get("/analytics/report")
def download_report(
    status: str = "confirmed",
    camera_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(database.get_db)
):
    incidents = crud.get_incidents(
        db, status=status, camera_id=camera_id, 
        start_date=start_date, end_date=end_date, limit=10000
    )
    pdf_buffer = analytics.generate_incidents_pdf(incidents)
    
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": "attachment; filename=incident_report.pdf"}
    )

