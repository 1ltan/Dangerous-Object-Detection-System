import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getCameras, addCamera, deleteCamera, startCamera, stopCamera,
} from "../api/client";
import { useLanguage } from "../context/LanguageContext";

const WS_BASE = window.location.protocol === "https:" ? "wss:" : "ws:";
const LAYOUTS = [1, 2, 4, 6, 9];

function AddCameraModal({ onClose }) {
    const { t } = useLanguage();
    const qc = useQueryClient();
    const [form, setForm] = useState({
        name: "", stream_url: "", location_name: "", latitude: "", longitude: "",
    });
    const [error, setError] = useState("");

    const mut = useMutation({
        mutationFn: addCamera,
        onSuccess: () => { qc.invalidateQueries(["cameras"]); onClose(); },
        onError: (e) => setError(e.message),
    });

    const submit = (e) => {
        e.preventDefault();
        mut.mutate({
            ...form,
            latitude: form.latitude ? parseFloat(form.latitude) : null,
            longitude: form.longitude ? parseFloat(form.longitude) : null,
        });
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">{t.live.modalTitle}</div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {error && <div style={{ color: "var(--accent)", fontSize: 12 }}>{error}</div>}
                    <div className="form-group">
                        <label className="form-label">{t.live.cameraName}</label>
                        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder={t.live.cameraNamePlaceholder} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t.live.streamUrl}</label>
                        <input className="input" value={form.stream_url} onChange={(e) => setForm({ ...form, stream_url: e.target.value })} required placeholder="http://192.168.1.100:8080/video" />
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                            IP WebCam (Android): <code>http://&lt;IP&gt;:8080/video</code> &nbsp;·&nbsp;
                            RTSP: <code>rtsp://&lt;IP&gt;:8080/h264_ulaw.sdp</code>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t.live.locationLabel}</label>
                        <input className="input" value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} placeholder={t.live.locationPlaceholder} />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t.live.latitude}</label>
                            <input className="input" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="50.4501" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t.live.longitude}</label>
                            <input className="input" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="30.5234" />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>{t.live.cancel}</button>
                        <button type="submit" className="btn btn-primary" disabled={mut.isPending}>
                            {mut.isPending ? t.live.adding : t.live.add}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CameraPanel({ camera }) {
    const { t } = useLanguage();
    const qc = useQueryClient();
    const imgRef = useRef(null);
    const wsRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [hasFrame, setHasFrame] = useState(false);
    const [running, setRunning] = useState(camera.is_running);

    const connect = useCallback(() => {
        if (wsRef.current) wsRef.current.close();
        const ws = new WebSocket(`${WS_BASE}//${window.location.host}/ws/stream/${camera.id}`);
        ws.binaryType = "arraybuffer";
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
            setConnected(false);
            setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (ev) => {
            if (typeof ev.data === "string") return;
            const blob = new Blob([ev.data], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);
            if (imgRef.current) {
                const old = imgRef.current.src;
                imgRef.current.src = url;
                if (old && old.startsWith("blob:")) URL.revokeObjectURL(old);
            }
            setHasFrame(true);
        };
        wsRef.current = ws;
    }, [camera.id]);

    useEffect(() => {
        connect();
        return () => { if (wsRef.current) wsRef.current.close(); };
    }, [connect]);

    const startMut = useMutation({
        mutationFn: () => startCamera(camera.id),
        onSuccess: () => { setRunning(true); qc.invalidateQueries(["cameras"]); },
    });
    const stopMut = useMutation({
        mutationFn: () => stopCamera(camera.id),
        onSuccess: () => { setRunning(false); qc.invalidateQueries(["cameras"]); },
    });
    const delMut = useMutation({
        mutationFn: () => deleteCamera(camera.id),
        onSuccess: () => qc.invalidateQueries(["cameras"]),
    });

    return (
        <div className="camera-panel">
            {running && <div className="scan-line" />}
            <img
                ref={imgRef}
                className="camera-stream-img"
                alt={camera.name}
                style={{ background: "#000", display: hasFrame ? "block" : "none" }}
            />
            {!hasFrame && (
                <div style={{
                    position: "absolute", inset: 0, display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center",
                    background: "#0a0a0a", color: "var(--text-secondary)", fontSize: 12, gap: 8
                }}>
                    <div className="spinner" style={{ width: 24, height: 24 }} />
                    <span>{connected ? t.live.waitingStream : t.live.connecting}</span>
                </div>
            )}
            <div className="camera-controls">
                {running ? (
                    <button className="btn btn-danger btn-sm" onClick={() => stopMut.mutate()} title={t.live.stopTitle}>◼</button>
                ) : (
                    <button className="btn btn-success btn-sm" onClick={() => startMut.mutate()} title={t.live.startTitle}>▶</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm(t.live.deleteConfirm)) delMut.mutate(); }} title={t.live.deleteTitle}>✕</button>
            </div>
            <div className="camera-overlay">
                <div style={{ fontWeight: 600, fontSize: 12 }}>{camera.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {camera.location_name || t.live.unknownLocation}
                    {" · "}
                    <span style={{ color: connected ? "var(--success)" : "var(--accent)" }}>
                        {connected ? "●" : "○"} {connected ? t.live.connected : t.live.disconnected}
                    </span>
                </div>
                {running && (
                    <span className="badge badge-confirmed" style={{ marginTop: 4, fontSize: 10 }}>{t.live.active}</span>
                )}
            </div>
        </div>
    );
}

export default function Live() {
    const { t } = useLanguage();
    const [layout, setLayout] = useState(4);
    const [showAdd, setShowAdd] = useState(false);
    const { data, isLoading } = useQuery({ queryKey: ["cameras"], queryFn: getCameras, refetchInterval: 10000 });
    const cameras = data?.data || [];

    const gridClass = {
        1: "grid-1", 2: "grid-2", 4: "grid-4", 6: "grid-6", 9: "grid-9"
    }[layout] || "grid-4";

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">{t.live.pageTitle}</div>
                    <div className="page-subtitle">{t.live.camerasRegistered(cameras.length)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                        {LAYOUTS.map(l => (
                            <button
                                key={l}
                                className={`btn btn-ghost btn-sm ${layout === l ? "active" : ""}`}
                                style={layout === l ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
                                onClick={() => setLayout(l)}
                            >{l} ⊞</button>
                        ))}
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{t.live.addCamera}</button>
                </div>
            </div>

            {isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                    <div className="spinner" />
                </div>
            ) : cameras.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">◉</div>
                    <h3>{t.live.noCamerasTitle}</h3>
                    <p>{t.live.noCamerasDesc}</p>
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{t.live.addCamera}</button>
                </div>
            ) : (
                <div className={gridClass}>
                    {cameras.map(cam => <CameraPanel key={cam.id} camera={cam} />)}
                </div>
            )}

            {showAdd && <AddCameraModal onClose={() => setShowAdd(false)} />}
        </div>
    );
}
