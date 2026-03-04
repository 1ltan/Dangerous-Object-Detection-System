const API_URL = "/api";
const WS_URL = `ws://${window.location.host}/api/ws`;

document.addEventListener("DOMContentLoaded", () => {
    loadCameras();
    loadPendingIncidents();
    setupWebSocket();
    setupModals();
});

async function loadCameras() {
    try {
        const response = await fetch(`${API_URL}/cameras/`);
        const cameras = await response.json();

        const cameraList = document.getElementById("camera-list");
        const videoGrid = document.getElementById("video-grid");

        cameraList.innerHTML = "";
        videoGrid.innerHTML = "";

        cameras.forEach(cam => {
            const item = document.createElement("div");
            item.className = "cam-item";
            item.innerHTML = `
                <span>${cam.name} (${cam.location})</span>
                <button onclick="deleteCamera(${cam.id})">X</button>
            `;
            cameraList.appendChild(item);

            const videoCard = document.createElement("div");
            videoCard.className = "video-card";
            videoCard.innerHTML = `
                <div class="title">${cam.name}</div>
                <img src="${API_URL}/video/${cam.id}" alt="Stream ${cam.name}" onerror="this.onerror=null; this.src=''; ">
            `;
            videoGrid.appendChild(videoCard);
        });
    } catch (e) {
        console.error("Failed to load cameras", e);
    }
}

async function addCamera(name, url, location) {
    if (!name || !url) return alert("Name and URL required.");
    try {
        await fetch(`${API_URL}/cameras/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, url, location: location || "Unknown" })
        });
        document.getElementById("add-camera-modal").style.display = "none";
        loadCameras();
    } catch (e) {
        alert("Error adding camera");
    }
}

async function deleteCamera(id) {
    if (!confirm("Remove camera?")) return;
    try {
        await fetch(`${API_URL}/cameras/${id}`, { method: "DELETE" });
        loadCameras();
    } catch (e) {
        alert("Error deleting camera");
    }
}

let pendingIncidentsCount = 0;
function setupWebSocket() {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "new_incident" && data.status === "pending") {
            addIncidentToSidebar(data);
        }
    };
    ws.onclose = () => {
        console.log("WS closed. Reconnecting...");
        setTimeout(setupWebSocket, 3000);
    };
}

let activeIncidentFixId = null;

async function loadPendingIncidents() {
    try {
        const response = await fetch(`${API_URL}/incidents/?status=pending`);
        const incidents = await response.json();
        incidents.reverse().forEach(inc => {
            addIncidentToSidebar(inc);
        });
    } catch (e) {
        console.error("Failed to load pending incidents", e);
    }
}

function addIncidentToSidebar(incident) {
    const list = document.getElementById("incidents-list");
    const countSpan = document.getElementById("alert-count");

    const id = incident.incident_id || incident.id;

    if (document.getElementById(`inc-${id}`)) return;

    pendingIncidentsCount++;
    countSpan.innerText = pendingIncidentsCount;
    const topCount = document.getElementById("alert-count-top");
    if (topCount) topCount.innerText = pendingIncidentsCount;

    const card = document.createElement("div");
    card.className = "incident-card";
    card.id = `inc-${id}`;

    card.innerHTML = `
        <img src="${API_URL}${incident.image_path}" alt="Detection" style="cursor: pointer;" onclick="window.open(this.src)" title="Click to enlarge">
        <div class="info">
            <strong>${incident.class_name}</strong> - ${incident.probability}%<br>
            Cam: ${incident.camera_id} | ${new Date(incident.timestamp).toLocaleTimeString()}
        </div>
        <div class="incident-actions">
            <button class="action-confirm" onclick="updateIncidentStatus(${id}, 'confirmed')">CONFIRM</button>
            <button class="action-reject" onclick="updateIncidentStatus(${id}, 'trash')">REJECT</button>
            <button onclick="openFixModal(${id})">FIX</button>
        </div>
    `;
    list.prepend(card);
}

async function updateIncidentStatus(id, status, newClass = null) {
    try {
        let url = `${API_URL}/incidents/${id}/status?status=${status}`;
        if (newClass) url += `&new_class=${newClass}`;

        await fetch(url, { method: "PUT" });

        const card = document.getElementById(`inc-${id}`);
        if (card) {
            card.remove();
            pendingIncidentsCount--;
            document.getElementById("alert-count").innerText = pendingIncidentsCount;
            const topCount = document.getElementById("alert-count-top");
            if (topCount) topCount.innerText = pendingIncidentsCount;
        }
    } catch (e) {
        alert("Could not update status.");
    }
}

function openFixModal(id) {
    activeIncidentFixId = id;
    document.getElementById("fix-type-modal").style.display = "block";
}

function setupModals() {
    const addCamModal = document.getElementById("add-camera-modal");
    document.getElementById("add-camera-btn").onclick = () => {
        addCamModal.style.display = "block";
    };

    document.querySelectorAll(".close-btn, .close-btn-fix").forEach(btn => {
        btn.onclick = function () {
            this.closest(".modal").style.display = "none";
        }
    });

    document.getElementById("submit-camera").onclick = () => {
        const name = document.getElementById("cam-name").value;
        const url = document.getElementById("cam-url").value;
        const loc = document.getElementById("cam-loc").value;
        addCamera(name, url, loc);
    };

    document.getElementById("submit-fix").onclick = () => {
        const newClass = document.getElementById("correct-type-select").value;
        if (activeIncidentFixId) {
            updateIncidentStatus(activeIncidentFixId, "confirmed", newClass);
            document.getElementById("fix-type-modal").style.display = "none";
            activeIncidentFixId = null;
        }
    };
}
