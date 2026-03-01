from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    url = Column(String)
    location = Column(String, default="Unknown")

    incidents = relationship("Incident", back_populates="camera")

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"))
    class_name = Column(String, index=True)
    probability = Column(Float)
    image_path = Column(String)
    status = Column(String, default="pending") 
    timestamp = Column(DateTime, default=datetime.utcnow)

    camera = relationship("Camera", back_populates="incidents")
