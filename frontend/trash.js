const API_URL = "/api";

document.addEventListener("DOMContentLoaded", () => {
    loadCameras();
    loadTrash();

    document.getElementById("apply-filters").addEventListener("click", () => {
        loadTrash();
    });
});

async function loadCameras() {
    try {
        const response = await fetch(`${API_URL}/cameras/`);
        const cameras = await response.json();
        const select = document.getElementById("cam-filter");

        cameras.forEach(cam => {
            const opt = document.createElement("option");
            opt.value = cam.id;
            opt.innerText = `${cam.name} (${cam.location})`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Failed to load cameras for filter", e);
    }
}

async function loadTrash() {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;
    const camId = document.getElementById("cam-filter").value;

    let url = `${API_URL}/incidents/?status=trash`;
    if (startDate) url += `&start_date=${startDate}T00:00:00`;
    if (endDate) url += `&end_date=${endDate}T23:59:59`;
    if (camId) url += `&camera_id=${camId}`;

    try {
        const response = await fetch(url);
        const incidents = await response.json();

        const tbody = document.querySelector("#trash-table tbody");
        tbody.innerHTML = "";

        incidents.forEach(inc => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${new Date(inc.timestamp).toLocaleString()}</td>
                <td>${inc.camera_id}</td>
                <td>${inc.class_name}</td>
                <td>${inc.probability}%</td>
                <td><img class="thumbnail" src="${API_URL}${inc.image_path}" alt="Snapshot" onclick="window.open(this.src)"></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Failed to load trash", e);
    }
}
