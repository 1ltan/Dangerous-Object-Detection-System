import React from "react";
import { NavLink } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export default function Navbar() {
    const { lang, toggleLang, t } = useLanguage();

    const NAV_ITEMS = [
        { to: "/live", label: t.nav.live, title: t.nav.liveTitle },
        { to: "/alerts", label: t.nav.alerts, title: t.nav.alertsTitle },
        { to: "/archive", label: t.nav.archive, title: t.nav.archiveTitle },
        { to: "/analytics", label: t.nav.analytics, title: t.nav.analyticsTitle },
        { to: "/agent", label: t.nav.agent, title: t.nav.agentTitle },
        { to: "/trash", label: t.nav.trash, title: t.nav.trashTitle, danger: true },
    ];

    return (
        <nav className="navbar">
            {/* Left: Brand */}
            <div className="navbar-brand" title="SYSTEM FOR ENEMY VEHICLE ACQUISITION AND TRACKING">
                <span>{t.nav.brand}</span>
            </div>

            {/* Center: Navigation links */}
            <div className="navbar-links">
                {NAV_ITEMS.map(({ to, label, title, danger }) => (
                    <NavLink
                        key={to}
                        to={to}
                        title={title}
                        className={({ isActive }) => `nav-link${isActive ? " active" : ""}${danger ? " nav-link-danger" : ""}`}
                    >
                        {label}
                    </NavLink>
                ))}
            </div>

            {/* Right: Language switcher */}
            <div className="navbar-end">
                <button
                    className="lang-switcher"
                    onClick={toggleLang}
                    title={lang === "uk" ? "Switch to English" : "Перейти на українську"}
                >
                    <span className="lang-code">{lang === "uk" ? "EN" : "UA"}</span>
                </button>
            </div>
        </nav>
    );
}
