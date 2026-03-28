import React, { createContext, useContext, useState } from "react";
import translations from "../i18n/translations";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(() => {
        return localStorage.getItem("sevat_lang") || "uk";
    });

    const toggleLang = () => {
        setLang(prev => {
            const next = prev === "uk" ? "en" : "uk";
            localStorage.setItem("sevat_lang", next);
            return next;
        });
    };

    React.useEffect(() => {
        document.documentElement.lang = lang === "uk" ? "uk-UA" : "en-US";
    }, [lang]);

    const t = translations[lang];

    return (
        <LanguageContext.Provider value={{ lang, toggleLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
    return ctx;
}
