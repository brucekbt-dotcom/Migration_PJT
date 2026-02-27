import React, { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Server,
  ArrowLeftRight,
  ArrowRightLeft,
  Plus,
  Download,
  Trash2,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type ThemeMode = "dark" | "light";
type ThemeStyle = "neon" | "graphite" | "aurora" | "circuit";
type PageKey = "dashboard" | "devices" | "before" | "after";
type DeviceCategory = "Network" | "Storage" | "Server" | "Other";
type PlacementMode = "before" | "after";
type MigrationFlags = { racked: boolean; cabled: boolean; powered: boolean; tested: boolean };
type Rack = { id: string; name: string; units: number };

type Device = {
  id: string;
  category: DeviceCategory;
  deviceId: string;
  name: string;
  brand: string;
  model: string;
  ports: number;
  sizeU: number;
  ip?: string;
  serial?: string;
  beforeRackId?: string;
  beforeStartU?: number;
  beforeEndU?: number;
  afterRackId?: string;
  afterStartU?: number;
  afterEndU?: number;
  migration: MigrationFlags;
};

const mockRacks: Rack[] = [
  ...["A1","A2","A3","A4","A5","A6"].map((n) => ({ id: n, name: n, units: 42 })),
  ...["B1","B2","B3","B4","B5","B6"].map((n) => ({ id: n, name: n, units: 42 })),
  ...["HUB 15A","HUB 15B","HUB 16A","HUB 16B","HUB 17A","HUB 17B"].map((n) => ({ id: n, name: n, units: 42 })),
  { id: "SmartHouse 20F", name: "SmartHouse 20F", units: 42 },
];

const mockDevices: Device[] = [
  {
    id: "dev-1",
    category: "Network",
    deviceId: "SW-CORE-001",
    name: "Core Switch",
    brand: "Cisco",
    model: "Catalyst 9500",
    ports: 48,
    sizeU: 2,
    beforeRackId: "A1",
    beforeStartU: 40,
    beforeEndU: 41,
    migration: { racked: true, cabled: true, powered: true, tested: true },
  },
  {
    id: "dev-2",
    category: "Storage",
    deviceId: "STO-001",
    name: "Primary Storage",
    brand: "NetApp",
    model: "FAS8200",
    ports: 8,
    sizeU: 4,
    beforeRackId: "A1",
    beforeStartU: 30,
    beforeEndU: 33,
    migration: { racked: false, cabled: false, powered: false, tested: false },
  },
];

const clampU = (u: number) => Math.max(1, Math.min(42, u));
const rangesOverlap = (aS: number, aE: number, bS: number, bE: number) =>
  Math.max(aS, bS) <= Math.min(aE, bE);

const isMigratedComplete = (m: MigrationFlags) => m.racked && m.cabled && m.powered && m.tested;

const catColorVar = (cat: DeviceCategory) => {
  switch (cat) {
    case "Network": return "var(--catNetwork)";
    case "Storage": return "var(--catStorage)";
    case "Server": return "var(--catServer)";
    default: return "var(--catOther)";
  }
};

function downloadCSV(devices: Device[]) {
  const headers = ["category","deviceId","name","brand","model","ports","sizeU","beforeRackId","beforeStartU","beforeEndU","afterRackId","afterStartU","afterEndU","racked","cabled","powered","tested"];
  const esc = (v: any) => {
    const s = String(v ?? "");
    const needs = s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
    return needs ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = devices.map((d) => [
    d.category, d.deviceId, d.name, d.brand, d.model, d.ports, d.sizeU,
    d.beforeRackId ?? "", d.beforeStartU ?? "", d.beforeEndU ?? "",
    d.afterRackId ?? "", d.afterStartU ?? "", d.afterEndU ?? "",
    d.migration.racked, d.migration.cabled, d.migration.powered, d.migration.tested,
  ]);
  const csv = headers.join(",") + "\n" + rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devices_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Store {
  racks: Rack[];
  devices: Device[];
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  page: PageKey;
  selectedDeviceId: string | null;
  setPage: (p: PageKey) => void;
  toggleTheme: () => void;
  setThemeStyle: (s: ThemeStyle) => void;
  setSelectedDeviceId: (id: string | null) => void;
  place: (mode: PlacementMode, deviceId: string, rackId: string, startU: number) => { ok: boolean; message?: string };
  clearPlacement: (mode: PlacementMode, id: string) => void;
  deleteDevice: (id: string) => void;
  setMigrationFlag: (id: string, patch: Partial<MigrationFlags>) => void;
}

const useStore = create<Store>((set, get) => ({
  racks: mockRacks,
  devices: mockDevices,
  theme: "dark",
  themeStyle: "neon",
  page: "dashboard",
  selectedDeviceId: null,
  setPage: (page) => set({ page }),
  toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
  setThemeStyle: (themeStyle) => set({ themeStyle }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  deleteDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
  clearPlacement: (mode, id) =>
    set((s) => ({
      devices: s.devices.map((d) =>
        d.id !== id ? d : (mode === "before"
          ? { ...d, beforeRackId: undefined, beforeStartU: undefined, beforeEndU: undefined }
          : { ...d, afterRackId: undefined, afterStartU: undefined, afterEndU: undefined })
      ),
    })),
  place: (mode, deviceId, rackId, startU) => {
    const { devices } = get();
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) return { ok: false, message: "找不到設備" };

    const sU = clampU(startU);
    const eU = sU + dev.sizeU - 1;
    if (eU > 42) return { ok: false, message: "超出機櫃高度限制 (42U)" };

    const collision = devices.find((d) => {
      if (d.id === deviceId) return false;
      const rId = mode === "before" ? d.beforeRackId : d.afterRackId;
      const s = mode === "before" ? d.beforeStartU : d.afterStartU;
      const e = mode === "before" ? d.beforeEndU : d.afterEndU;
      return rId === rackId && s != null && e != null && rangesOverlap(sU, eU, s, e);
    });
    if (collision) return { ok: false, message: `位置衝突: ${collision.deviceId} ${collision.name}` };

    set((s) => ({
      devices: s.devices.map((d) =>
        d.id !== deviceId ? d : (mode === "before"
          ? { ...d, beforeRackId: rackId, beforeStartU: sU, beforeEndU: eU }
          : { ...d, afterRackId: rackId, afterStartU: sU, afterEndU: eU })
      ),
    }));
    return { ok: true };
  },
  setMigrationFlag: (id, patch) =>
    set((s) => ({
      devices: s.devices.map((d) =>
        d.id === id ? { ...d, migration: { ...d.migration, ...patch } } : d
      ),
    })),
}));

const ThemeTokens = () => {
  const style = useStore((s) => s.themeStyle);
  const presets: Record<ThemeStyle, { light: string; dark: string }> = {
    neon: {
      light: ":root{--bg:#f8fafc;--panel:#ffffff;--panel2:#f1f5f9;--text:#0b1220;--muted:#475569;--border:#e2e8f0;--accent:#06b6d4;--accent2:#a855f7;--catNetwork:#22c55e;--catStorage:#67e8f9;--catServer:#3b82f6;--catOther:#facc15;--lampOn:#22c55e;--lampOff:#ef4444}",
      dark: "html.dark{--bg:#05070d;--panel:#0b1220;--panel2:#1a2235;--text:#e5e7eb;--muted:#94a3b8;--border:#1e293b;--accent:#22d3ee;--accent2:#c084fc;--catNetwork:#4ade80;--catStorage:#a5f3fc;--catServer:#60a5fa;--catOther:#fde047;--lampOn:#4ade80;--lampOff:#ef4444}",
    },
    graphite: {
      light: ":root{--bg:#f6f7fb;--panel:#ffffff;--panel2:#eef2f7;--text:#0a0e16;--muted:#6b7280;--border:#e5e7eb;--accent:#3b82f6;--accent2:#111827;--catNetwork:#16a34a;--catStorage:#06b6d4;--catServer:#2563eb;--catOther:#ca8a04;--lampOn:#16a34a;--lampOff:#ef4444}",
      dark: "html.dark{--bg:#070a0f;--panel:#0b0f18;--panel2:#0a0e16;--text:#f3f4f6;--muted:#9ca3af;--border:#1f2937;--accent:#38bdf8;--accent2:#94a3b8;--catNetwork:#22c55e;--catStorage:#22d3ee;--catServer:#60a5fa;--catOther:#fbbf24;--lampOn:#22c55e;--lampOff:#ef4444}",
    },
    aurora: {
      light: ":root{--bg:#f7fbff;--panel:#ffffff;--panel2:#eef6ff;--text:#081120;--muted:#64748b;--border:#e2e8f0;--accent:#14b8a6;--accent2:#6366f1;--catNetwork:#10b981;--catStorage:#22d3ee;--catServer:#4f46e5;--catOther:#f59e0b;--lampOn:#10b981;--lampOff:#ef4444}",
      dark: "html.dark{--bg:#050913;--panel:#0b1220;--panel2:#081225;--text:#f1f5f9;--muted:#94a3b8;--border:#334155;--accent:#2dd4bf;--accent2:#a5b4fc;--catNetwork:#34d399;--catStorage:#67e8f9;--catServer:#818cf8;--catOther:#fbbf24;--lampOn:#34d399;--lampOff:#ef4444}",
    },
    circuit: {
      light: ":root{--bg:#f7f9ff;--panel:#ffffff;--panel2:#edf0ff;--text:#0b1020;--muted:#6b7280;--border:#e2e8f0;--accent:#7c3aed;--accent2:#06b6d4;--catNetwork:#22c55e;--catStorage:#38bdf8;--catServer:#7c3aed;--catOther:#eab308;--lampOn:#22c55e;--lampOff:#ef4444}",
      dark: "html.dark{--bg:#060714;--panel:#0b0b1a;--panel2:#0b1220;--text:#f8fafc;--muted:#a1a1aa;--border:#27272a;--accent:#a78bfa;--accent2:#22d3ee;--catNetwork:#4ade80;--catStorage:#7dd3fc;--catServer:#c4b5fd;--catOther:#fde047;--lampOn:#4ade80;--lampOff:#ef4444}",
    },
  };
  const css = presets[style] || presets.neon;
  return <style>{css.light + "\n" + css.dark}</style>;
};

const Lamp = ({ on }: { on: boolean }) => (
  <span
    className="inline-block w-1.5 h-1.5 rounded-full"
    style={{
      backgroundColor: on ? "var(--lampOn)" : "var(--lampOff)",
      boxShadow: on ? "0 0 8px var(--lampOn)" : "0 0 8px rgba(239,68,68,0.35)",
    }}
  />
);

const Lamps = ({ m }: { m: MigrationFlags }) => (
  <div className="grid grid-cols-2 gap-1 place-items-end">
    <Lamp on={m.racked} />
    <Lamp on={m.cabled} />
    <Lamp on={m.powered} />
    <Lamp on={m.tested} />
  </div>
);

const Dashboard = () => {
  const devices = useStore((s) => s.devices);

  const stats = [
    { label: "總設備數", value: devices.length, icon: <Server size={20} /> },
    { label: "已定位(搬遷後)", value: devices.filter((d) => d.afterRackId).length, icon: <ArrowRightLeft size={20} /> },
    { label: "搬遷完成", value: devices.filter((d) => isMigratedComplete(d.migration)).length, icon: <CheckCircle2 size={20} /> },
    { label: "待處理", value: Math.max(0, devices.length - devices.filter((d) => isMigratedComplete(d.migration)).length), icon: <AlertCircle size={20} /> },
  ];

  const chartData = [
    { name: "Network", count: devices.filter((d) => d.category === "Network").length, fill: "var(--catNetwork)" },
    { name: "Storage", count: devices.filter((d) => d.category === "Storage").length, fill: "var(--catStorage)" },
    { name: "Server", count: devices.filter((d) => d.category === "Server").length, fill: "var(--catServer)" },
    { name: "Other", count: devices.filter((d) => d.category === "Other").length, fill: "var(--catOther)" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-[var(--panel)] border border-[var(--border)] p-6 rounded-2xl shadow-xl"
          >
            <div className="text-[var(--muted)] flex items-center gap-2 mb-2">
              {s.icon} {s.label}
            </div>
            <div className="text-3xl font-black text-[var(--accent)]">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--panel)] border border-[var(--border)] p-6 rounded-2xl h-[380px]">
          <h3 className="text-lg font-black mb-4">設備類別分佈</h3>
          <ResponsiveContainer width="100%" height="88%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                contentStyle={{
                  backgroundColor: "var(--panel2)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  color: "var(--text)",
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--panel)] border border-[var(--border)] p-6 rounded-2xl">
          <h3 className="text-lg font-black mb-4">下一步</h3>
          <ul className="text-sm text-[var(--muted)] space-y-2">
            <li>✅ 你已完成 GitHub 專案骨架。</li>
            <li>✅ 接下來用 Vercel 直接匯入 repo 部署。</li>
            <li>🔧 部署成功後，我們再把完整 UI / 拖拉功能換上去。</li>
          </ul>
          <button
            onClick={() => downloadCSV(devices)}
            className="mt-4 px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 inline-flex items-center gap-2"
          >
            <Download size={16} /> 下載 CSV（測試）
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const themeStyle = useStore((s) => s.themeStyle);
  const setThemeStyle = useStore((s) => s.setThemeStyle);
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const navItems = [
    { id: "dashboard", label: "儀表板", icon: <LayoutDashboard size={20} /> },
    { id: "devices", label: "設備管理(先略)", icon: <Server size={20} /> },
    { id: "before", label: "搬遷前(先略)", icon: <ArrowLeftRight size={20} /> },
    { id: "after", label: "搬遷後(先略)", icon: <ArrowRightLeft size={20} /> },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-300">
      <ThemeTokens />

      <header className="h-16 border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] rounded-lg flex items-center justify-center text-black shadow-[0_0_15px_var(--accent)]">
            <Server size={18} />
          </div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic">
            Migrate<span className="text-[var(--accent)]">Pro</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={themeStyle}
            onChange={(e) => setThemeStyle(e.target.value as ThemeStyle)}
            className="bg-[var(--panel2)] border border-[var(--border)] rounded-lg text-xs px-2 py-1 outline-none hidden sm:block"
          >
            <option value="neon">Neon Blue</option>
            <option value="graphite">Graphite Gray</option>
            <option value="aurora">Aurora Green</option>
            <option value="circuit">Circuit Violet</option>
          </select>
          <button onClick={toggleTheme} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
        </div>
      </header>

      <div className="flex">
        <nav className="w-64 border-r border-[var(--border)] h-[calc(100vh-64px)] sticky top-16 p-4 hidden lg:block bg-[var(--panel)]">
          <div className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id as PageKey)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  page === item.id
                    ? "bg-[var(--panel2)] text-[var(--accent)] border border-[var(--border)] font-bold"
                    : "text-[var(--muted)] hover:bg-white/[0.03]"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {page === "dashboard" && <Dashboard />}
              {page !== "dashboard" && (
                <div className="p-6 text-[var(--muted)]">
                  這頁先留空，等部署成功後我們再把完整功能放回來。
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
