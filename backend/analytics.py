import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

def generate_incidents_pdf(incidents):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Title
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(colors.red)
    c.drawString(50, height - 50, "Dangerous Object Detection - Incident Report")

    # Metadata
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.black)
    c.drawString(50, height - 70, f"Generated exactly at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    c.drawString(50, height - 85, f"Total Incidents Recorded: {len(incidents)}")

    # Table Header
    y = height - 120
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y, "ID")
    c.drawString(90, y, "Time")
    c.drawString(210, y, "Camera")
    c.drawString(260, y, "Location")
    c.drawString(380, y, "Object Class")
    c.drawString(480, y, "Probability")

    c.line(50, y - 5, 550, y - 5)
    
    y -= 25
    c.setFont("Helvetica", 10)
    
    for inc in incidents:
        if y < 50:
            c.showPage()
            y = height - 50
            c.setFont("Helvetica", 10)
            
        loc = inc.camera.location if inc.camera else "Unknown"
        cam_name = inc.camera.name if inc.camera else str(inc.camera_id)

        c.drawString(50, y, str(inc.id))
        c.drawString(90, y, inc.timestamp.strftime("%Y-%m-%d %H:%M"))
        c.drawString(210, y, cam_name)
        c.drawString(260, y, str(loc))
        c.drawString(380, y, inc.class_name)
        c.drawString(480, y, f"{inc.probability}%")
        
        y -= 20

    c.save()
    buffer.seek(0)
    return buffer
