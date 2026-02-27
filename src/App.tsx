// DEPLOY_MARKER_20260228_0059
// ✅ CLEAN SAFE VERSION – no broken string literals
import React, { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { motion, AnimatePresence } from "framer-motion";
import { Server, LayoutDashboard } from "lucide-react";

// ---------------- TYPES ----------------

type ThemeMode = "dark" | "light";

type Device = {
  id: string;
  name: string;
};

// ---------------- STORE ----------------

interface Store {
  theme: ThemeMode;
  devices: Device[];
  toggleTheme: () => void;
}

const useStore = create<Store>((set) => ({
  theme: "dark",
  devices: [{ id: "1", name: "Core Switch" }],
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
}));

// ---------------- THEME ----------------

const ThemeTokens = () => {
  const theme = useStore((s) => s.theme);

  const light = `
    :root{
      --bg:#ffffff;
      --text:#111827;
      --panel:#f3f4f6;
      --accent:#2563eb;
    }
  `;

  const dark = `
    html.dark{
      --bg:#0b1220;
      --text:#f3f4f6;
      --panel:#1f2937;
      --accent:#38bdf8;
    }
  `;

  return <style>{light + dark}</style>;
};

// ---------------- APP ----------------

export default function App() {
  const { theme, toggleTheme, devices } = useStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
        padding: "40px",
        fontFamily: "sans-serif",
      }}
    >
      <ThemeTokens />

      <h1 style={{ fontSize: "28px", fontWeight: 900 }}>
        <Server size={28} style={{ marginRight: 10 }} />
        Migration Project
      </h1>

      <button
        onClick={toggleTheme}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: "var(--accent)",
          border: "none",
          color: "white",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        Toggle Theme
      </button>

      <div
        style={{
          marginTop: 40,
          padding: 20,
          background: "var(--panel)",
          borderRadius: 12,
        }}
      >
        <h2>Device List</h2>
        {devices.map((d) => (
          <div key={d.id}>{d.name}</div>
        ))}
      </div>
    </div>
  );
}
