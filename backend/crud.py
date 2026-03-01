from sqlalchemy.orm import Session
from datetime import datetime
from backend import models, schemas
import os

def get_camera(db: Session, camera_id: int):
    return db.query(models.Camera).filter(models.Camera.id == camera_id).first()

def get_cameras(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Camera).offset(skip).limit(limit).all()

def create_camera(db: Session, camera: schemas.CameraCreate):
    db_camera = models.Camera(**camera.model_dump())
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)
    return db_camera

def delete_camera(db: Session, camera_id: int):
    db_camera = db.query(models.Camera).filter(models.Camera.id == camera_id).first()
    if db_camera:
        db.delete(db_camera)
        db.commit()
    return db_camera

def get_incident(db: Session, incident_id: int):
    return db.query(models.Incident).filter(models.Incident.id == incident_id).first()

from typing import Optional

def get_incidents(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None, 
                  camera_id: Optional[int] = None, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None):
    query = db.query(models.Incident)
    if status is not None:
        query = query.filter(models.Incident.status == status)
    if camera_id is not None:
        query = query.filter(models.Incident.camera_id == camera_id)
    if start_date is not None:
        query = query.filter(models.Incident.timestamp >= start_date)
    if end_date is not None:
        query = query.filter(models.Incident.timestamp <= end_date)
        
    return query.order_by(models.Incident.timestamp.desc()).offset(skip).limit(limit).all()

def create_incident(db: Session, incident: schemas.IncidentCreate):
    db_incident = models.Incident(**incident.model_dump())
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    return db_incident

def update_incident_status(db: Session, incident_id: int, status: str, new_class: Optional[str] = None):
    db_incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if db_incident:
        db_incident.status = status
        if new_class:
            db_incident.class_name = new_class
        db.commit()
        db.refresh(db_incident)
    return db_incident

def delete_incident(db: Session, incident_id: int):
    db_incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if db_incident:
        # Optionally remove the image file too
        filepath = db_incident.image_path.lstrip('/')
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except:
                pass
        db.delete(db_incident)
        db.commit()
    return db_incident
