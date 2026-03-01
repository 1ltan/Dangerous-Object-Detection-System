from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class CameraBase(BaseModel):
    name: str
    url: str
    location: str

class CameraCreate(CameraBase):
    pass

class Camera(CameraBase):
    id: int

    class Config:
        from_attributes = True

class IncidentBase(BaseModel):
    camera_id: Optional[int] = None
    class_name: str
    probability: float
    image_path: str
    status: str

class IncidentCreate(IncidentBase):
    pass

class Incident(IncidentBase):
    id: int
    timestamp: datetime
    camera: Optional[Camera] = None

    class Config:
        from_attributes = True
