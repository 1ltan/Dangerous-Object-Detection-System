import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getArchive, getCameras, getScreenshotUrl } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

function downloadCSV(rows, t) {
    const headers = t.archive.csvHeaders;
    const lines = [headers.join(",")];
    rows.forEach(d => {
        const effectiveClass = d.operator_correction || d.class_name;
        const statusLabel = d.status === "CONFIRMED"
            ? t.archive.statusConfirmed
            : d.status === "ARCHIVED"
                ? t.archive.statusArchived
                : d.status;
        lines.push([
            d.id,
            t.classLabels[effectiveClass] || effectiveClass,
            Math.round(d.confidence * 100),
            `"${d.camera_name || ""}"`,
            `"${d.camera_location || ""}"`,
            new Date(d.detected_at).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }),
            statusLabel,
        ].join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `archive_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
}

export default function Archive() {
    const { t } = useLanguage();
    const [view, setView] = useState("table");
    const [filters, setFilters] = useState({ date_from: "", date_to: "", camera_id: "", class_name: "" });
    const { data: camData } = useQuery({ queryKey: ["cameras"], queryFn: getCameras });
    const cameras = camData?.data || [];

    const CLASS_OPTIONS = [
        { value: "APC",   label: t.classLabels.APC },
        { value: "IFV",   label: t.classLabels.IFV },
        { value: "TANK",  label: t.classLabels.TANK },
        { value: "CAR",   label: t.classLabels.CAR },
        { value: "TRUCK", label: t.classLabels.TRUCK },
        { value: "ART",   label: t.classLabels.ART },
        { value: "MLRS",  label: t.classLabels.MLRS },
    ];

    const params = {};
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.camera_id) params.camera_id = Number(filters.camera_id);
    if (filters.class_name) params.class_name = filters.class_name;

    const { data, isLoading } = useQuery({
        queryKey: ["archive", params],
        queryFn: () => getArchive(params),
    });
    const rows = data?.data || [];

    const getStatusLabel = (status) => {
        if (status === "CONFIRMED") return t.archive.statusConfirmed;
        if (status === "ARCHIVED") return t.archive.statusArchived;
        return status;
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">{t.archive.pageTitle}</div>
                    <div className="page-subtitle">{t.archive.records(rows.length)}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button className={`btn btn-ghost btn-sm ${view === "table" ? "active" : ""}`}
                        style={view === "table" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
                        onClick={() => setView("table")}>{t.archive.tableView}</button>
                    <button className={`btn btn-ghost btn-sm ${view === "grid" ? "active" : ""}`}
                        style={view === "grid" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
                        onClick={() => setView("grid")}>{t.archive.gridView}</button>
                    <button className="btn btn-primary btn-sm" onClick={() => downloadCSV(rows, t)}>
                        {t.archive.exportCsv}
                    </button>
                </div>
            </div>

            <div className="filter-bar">
                <input type="datetime-local" className="input" style={{ maxWidth: 200 }}
                    value={filters.date_from}
                    onChange={e => setFilters({ ...filters, date_from: e.target.value })} />
                <span style={{ color: "var(--text-secondary)" }}>→</span>
                <input type="datetime-local" className="input" style={{ maxWidth: 200 }}
                    value={filters.date_to}
                    onChange={e => setFilters({ ...filters, date_to: e.target.value })} />
                <select className="select" style={{ maxWidth: 180 }}
                    value={filters.camera_id}
                    onChange={e => setFilters({ ...filters, camera_id: e.target.value })}>
                    <option value="">{t.archive.allCameras}</option>
                    {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="select" style={{ maxWidth: 160 }}
                    value={filters.class_name}
                    onChange={e => setFilters({ ...filters, class_name: e.target.value })}>
                    <option value="">{t.archive.allClasses}</option>
                    {CLASS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm"
                    onClick={() => setFilters({ date_from: "", date_to: "", camera_id: "", class_name: "" })}>
                    {t.archive.reset}
                </button>
            </div>

            {isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
            ) : rows.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"></div>
                    <h3>{t.archive.emptyTitle}</h3>
                    <p>{t.archive.emptyDesc}</p>
                </div>
            ) : view === "table" ? (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>{t.archive.colScreenshot}</th>
                                <th>{t.archive.colClass}</th>
                                <th>{t.archive.colConfidence}</th>
                                <th>{t.archive.colCamera}</th>
                                <th>{t.archive.colLocation}</th>
                                <th>{t.archive.colTime}</th>
                                <th>{t.archive.colStatus}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(d => (
                                <tr key={d.id}>
                                    <td>
                                        <img src={getScreenshotUrl(d.id)} className="screenshot-thumb"
                                            alt="" onError={e => { e.target.style.display = "none"; }} />
                                    </td>
                                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                                        {(() => {
                                            const effectiveClass = d.operator_correction || d.class_name;
                                            return t.classLabels[effectiveClass] || effectiveClass;
                                        })()}
                                    </td>
                                    <td style={{ color: d.confidence >= 0.7 ? "var(--success)" : "var(--warning)", fontFamily: "var(--font-mono)" }}>
                                        {Math.round(d.confidence * 100)}%
                                    </td>
                                    <td>{d.camera_name}</td>
                                    <td style={{ color: "var(--text-secondary)" }}>{d.camera_location}</td>
                                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                        {new Date(d.detected_at).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${d.status.toLowerCase()}`}>
                                            {getStatusLabel(d.status)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid-4">
                    {rows.map(d => (
                        <div key={d.id} className="card">
                            <img src={getScreenshotUrl(d.id)} alt=""
                                style={{ width: "100%", borderRadius: 6, marginBottom: 10, border: "1px solid var(--border)" }}
                                onError={e => { e.target.src = ""; e.target.style.display = "none"; }} />
                            <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                                {(() => {
                                    const effectiveClass = d.operator_correction || d.class_name;
                                    return t.classLabels[effectiveClass] || effectiveClass;
                                })()}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                                {d.camera_name} · {Math.round(d.confidence * 100)}%
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                {new Date(d.detected_at).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}
                            </div>
                            <span className={`badge badge-${d.status.toLowerCase()}`} style={{ marginTop: 8 }}>
                                {getStatusLabel(d.status)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
