import cv2
import time
import os
import numpy as np
import asyncio
from datetime import datetime
from ultralytics import YOLO
from sqlalchemy.orm import Session
from backend.crud import create_incident, update_incident_status
from backend.schemas import IncidentCreate
from backend.database import SessionLocal

# Load the YOLO model
MODEL_PATH = os.getenv("YOLO_MODEL_PATH", r"c:/Users/user/Desktop/Project/Dangerous-Object-Detection-System/runs/detect/military_vehicles_detection/weights/best.pt")
try:
    model = YOLO(MODEL_PATH)
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

active_streams = {}

def get_yolo_class_name(class_id):
    if model:
        return model.names[class_id]
    return "Unknown"

cooldowns = {}
COOLDOWN_SECONDS = 5

def process_frame_for_incidents(frame, results, camera_id: int):
    global cooldowns
    
    if camera_id not in cooldowns:
        cooldowns[camera_id] = {}
        
    current_time = time.time()
    
    for r in results:
        boxes = r.boxes
        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            class_name = get_yolo_class_name(cls_id)
            probability = round(conf * 100, 2)
            last_time = cooldowns[camera_id].get(class_name, 0)
            if current_time - last_time < COOLDOWN_SECONDS:
                continue
                
            cooldowns[camera_id][class_name] = current_time
            save_frame = frame.copy()
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cv2.rectangle(save_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
            text = f"Probability {probability}% this {class_name}"
            cv2.putText(save_frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"cam_{camera_id}_{class_name}_{timestamp_str}.jpg"
            filepath = os.path.join("backend", "captures", filename)
            
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            cv2.imwrite(filepath, save_frame)
            status = "pending"
            if probability >= 85:
                status = "confirmed"
            elif probability < 40:
                status = "trash"
                
            db_image_path = "/" + filepath.replace("\\", "/")
            db = SessionLocal()
            incident_data = IncidentCreate(
                camera_id=camera_id,
                class_name=class_name,
                probability=probability,
                image_path=db_image_path,
                status=status
            )
            db_incident = create_incident(db, incident_data)
            db.close()
    
            if status in ["pending", "confirmed"]:
                alert = {
                    "type": "new_incident",
                    "incident_id": db_incident.id,
                    "camera_id": camera_id,
                    "class_name": class_name,
                    "probability": probability,
                    "image_path": db_image_path,
                    "status": status,
                    "timestamp": db_incident.timestamp.isoformat()
                }
                from backend.main import add_to_alert_queue
                add_to_alert_queue(alert)

def get_video_stream(camera_id: int, url: str):
    global active_streams
    active_streams[camera_id] = True
    
    if ":8080" in url and not url.endswith("/video"):
        url = url.rstrip("/") + "/video"
        
    cap = None

    def create_message_frame(message):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(frame, message, (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        ret, buffer = cv2.imencode('.jpg', frame)
        return buffer.tobytes()

    while active_streams.get(camera_id, False):
        if cap is None or not cap.isOpened():
            print(f"Attempting to connect to camera {camera_id}: {url}")
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "timeout;5000"
            cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
            
            if not cap.isOpened():
                print(f"Failed to connect. Retrying in 5 seconds...")
                yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + create_message_frame("Connecting...") + b'\r\n')
                time.sleep(5)
                continue

        ret, frame = cap.read()
        if not ret:
            print(f"Failed to grab frame for camera {camera_id}. Reconnecting...")
            cap.release()
            cap = None
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + create_message_frame("Stream Lost. Reconnecting...") + b'\r\n')
            time.sleep(2)
            continue

        if model:
            # Run YOLO
            results = model.predict(frame, verbose=False) 
            # Run incident processing synchronously
            try:
                process_frame_for_incidents(frame, results, camera_id)
            except Exception as e:
                print(f"Error triggering incident check: {e}")
            # Draw standard boxes for the live feed itself
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    class_name = get_yolo_class_name(cls_id)
                    probability = round(conf * 100, 2)
                    
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    text = f"{class_name} {probability}%"
                    cv2.putText(frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        # Encode frame
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        # Yield for StreamingResponse
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        # Small sleep to limit frame rate processing
        time.sleep(0.05)
        
    cap.release()
