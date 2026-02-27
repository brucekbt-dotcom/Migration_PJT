import React, { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Server,
  ArrowLeftRight,
  ArrowRightLeft,
  Plus,
  Download,
  Upload,
  Trash2,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronsLeft,
  ChevronsRight,
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

// -----------------------------
// Types
// -----------------------------
type ThemeMode = "dark" | "light";
type ThemeStyle = "neon" | "graphite" | "aurora" | "circuit";
type PageKey = "dashboard" | "devices" | "before" | "after";
type DeviceCategory = "Network" | "Storage" | "Server" | "Other";
type PlacementMode = "before" | "after";
type MigrationFlags = {
  racked: boolean;
  cabled: boolean;
  powered: boolean;
  tested: boolean;
};

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
  portMap?: string;

  beforeRackId?: string;
  beforeStartU?: number;
  beforeEndU?: number;

  afterRackId?: string;
  afterStartU?: number;
  afterEndU?: number;

  migration: MigrationFlags;
};

type DeviceDraft = {
  category: DeviceCategory;
  deviceId: string;
  name: string;
  brand: string;
  model: string;
  ports: number;
  sizeU: number;
  ip?: string;
  serial?: string;
  portMap?: string;
};

// -----------------------------
// Constants / Layouts
// -----------------------------
const LS = {
  theme: "migrate.theme",
  themeStyle: "migrate.themeStyle",
  devices: "migrate.devices",
  ui: "migrate.ui",
} as const;

type UiState = { sideCollapsed: boolean };
const DEFAULT_UI: UiState = { sideCollapsed: false };

// ✅ 你最新更正的佈局（搬遷前）
const BEFORE_LAYOUT: string[][] = [
  ["B10", "B9", "B8", "B7", "B6"],
  ["A5", "A4", "A3", "A2", "A1"],
  ["2F-A", "2F-B", "3F-A", "3F-B", "4F-A", "4F-B"],
  ["9F", "SmartHouseA", "SmartHouseB"],
];

// ✅ 你最新更正的佈局（搬遷後）
const AFTER_LAYOUT: string[][] = [
  ["A1", "A2", "A3", "A4", "A5", "A6"],
  ["B1", "B2", "B3", "B4", "B5", "B6"],
  ["HUB 15L", "HUB 15R", "HUB 16L", "HUB 16R", "HUB 17L", "HUB 17R"],
  ["HUB 20F", "SmartHouse 20F", "不搬存放區A", "不搬存放區B", "不搬存放區C"],
];

const isNoMoveRack = (name: string) => name.startsWith("不搬存放區");

// -----------------------------
// Mock devices (fallback)
// -----------------------------
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
    ip: "10.0.0.1",
    serial: "CS-001",
    portMap: "",
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
    ip: "10.0.0.21",
    serial: "NA-8200",
    portMap: "",
    beforeRackId: "A1",
    beforeStartU: 30,
    beforeEndU: 33,
    migration: { racked: false, cabled: false, powered: false, tested: false },
  },
  {
    id: "dev-3",
    category: "Server",
    deviceId: "SRV-APP-012",
    name: "App Server",
    brand: "Dell",
    model: "R740",
    ports: 24,
    sizeU: 2,
    ip: "10.0.1.12",
    serial: "DL-740",
    portMap: "",
    migration: { racked: false, cabled: false, powered: false, tested: false },
  },
];

// -----------------------------
// Utils
// -----------------------------
const clampU = (u: number) => Math.max(1, Math.min(42, u));
const rangesOverlap = (aS: number, aE: number, bS: number, bE: number) =>
  Math.max(aS, bS) <= Math.min(aE, bE);

const isMigratedComplete = (m: MigrationFlags) =>
  m.racked && m.cabled && m.powered && m.tested;

// ✅ 類別配色：避免與燈號紅綠衝突（設計感 + 反差）
const catColorVar = (cat: DeviceCategory) => {
  switch (cat) {
    case "Network":
      return "var(--catNetwork)"; // Teal
    case "Server":
      return "var(--catServer)"; // Indigo
    case "Storage":
      return "var(--catStorage)"; // Sky
    default:
      return "var(--catOther)"; // Amber
  }
};

const readJson = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (k: string, v: any) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // ignore
  }
};

const normalizeDevices = (raw: any[]): Device[] => {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((d: any) => {
    const sizeU = Math.max(1, Math.min(42, Number(d?.sizeU ?? 1)));
    const mig = d?.migration ?? {};
    return {
      id: String(d?.id ?? crypto.randomUUID()),
      category: (d?.category as DeviceCategory) || "Other",
      deviceId: String(d?.deviceId ?? ""),
      name: String(d?.name ?? ""),
      brand: String(d?.brand ?? ""),
      model: String(d?.model ?? ""),
      ports: Number(d?.ports ?? 0),
      sizeU,
      ip: String(d?.ip ?? ""),
      serial: String(d?.serial ?? ""),
      portMap: String(d?.portMap ?? ""),
      beforeRackId: d?.beforeRackId ?? undefined,
      beforeStartU: d?.beforeStartU ?? undefined,
      beforeEndU: d?.beforeEndU ?? undefined,
      afterRackId: d?.afterRackId ?? undefined,
      afterStartU: d?.afterStartU ?? undefined,
      afterEndU: d?.afterEndU ?? undefined,
      migration: {
        racked: Boolean(mig?.racked ?? false),
        cabled: Boolean(mig?.cabled ?? false),
        powered: Boolean(mig?.powered ?? false),
        tested: Boolean(mig?.tested ?? false),
      },
    } as Device;
  });
};

// -----------------------------
// CSV helpers
// -----------------------------
const CSV_HEADERS = [
  "category",
  "deviceId",
  "name",
  "brand",
  "model",
  "ports",
  "sizeU",
  "ip",
  "serial",
  "portMap",
  "beforeRackId",
  "beforeStartU",
  "beforeEndU",
  "afterRackId",
  "afterStartU",
  "afterEndU",
  "racked",
  "cabled",
  "powered",
  "tested",
] as const;

function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSVTemplate() {
  const example = [
    CSV_HEADERS.join(","),
    [
      "Network",
      "SW-01",
      "Core Switch",
      "Cisco",
      "C9500",
      "48",
      "2",
      "10.0.0.1",
      "SN-001",
      "Gi1/0/1 -> FW WAN",
      "A1",
      "40",
      "41",
      "",
      "",
      "",
      "true",
      "true",
      "true",
      "true",
    ].join(","),
  ].join("\n");
  downloadTextFile("devices_template.csv", example, "text/csv");
}

function exportDevicesCSV(devices: Device[]) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    const needs = s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
    return needs ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = devices.map((d) => [
    d.category,
    d.deviceId,
    d.name,
    d.brand,
    d.model,
    d.ports,
    d.sizeU,
    d.ip ?? "",
    d.serial ?? "",
    d.portMap ?? "",
    d.beforeRackId ?? "",
    d.beforeStartU ?? "",
    d.beforeEndU ?? "",
    d.afterRackId ?? "",
    d.afterStartU ?? "",
    d.afterEndU ?? "",
    d.migration.racked,
    d.migration.cabled,
    d.migration.powered,
    d.migration.tested,
  ]);

  const csv = [CSV_HEADERS.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  downloadTextFile(`devices_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
}

// very small CSV parser (handles quotes)
function parseCSV(text: string) {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    // ignore empty last row
    if (row.length === 1 && row[0].trim() === "") return;
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") pushCell();
      else if (ch === "\n") {
        pushCell();
        pushRow();
      } else if (ch === "\r") {
        // ignore
      } else cur += ch;
    }
  }
  pushCell();
  pushRow();
  return rows;
}

// -----------------------------
// Store
// -----------------------------
interface Store {
  devices: Device[];
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  page: PageKey;
  ui: UiState;
  selectedDeviceId: string | null;

  setPage: (p: PageKey) => void;
  toggleTheme: () => void;
  setThemeStyle: (s: ThemeStyle) => void;
  setUi: (patch: Partial<UiState>) => void;

  setSelectedDeviceId: (id: string | null) => void;

  addDevice: (draft: DeviceDraft) => void;
  updateDevice: (id: string, patch: Partial<DeviceDraft>) => void;
  deleteDevice: (id: string) => void;

  clearPlacement: (mode: PlacementMode, id: string) => void;
  place: (mode: PlacementMode, deviceId: string, rackId: string, startU: number) => {
    ok: boolean;
    message?: string;
  };

  setMigrationFlag: (id: string, patch: Partial<MigrationFlags>) => void;
  importDevicesCSV: (csvText: string) => { ok: boolean; message?: string };
}

const useStore = create<Store>((set, get) => ({
  devices: normalizeDevices(readJson<Device[]>(LS.devices, mockDevices)),
  theme: (localStorage.getItem(LS.theme) as ThemeMode) || "dark",
  themeStyle: (localStorage.getItem(LS.themeStyle) as ThemeStyle) || "neon",
  page: "dashboard",
  ui: { ...DEFAULT_UI, ...readJson<UiState>(LS.ui, DEFAULT_UI) },
  selectedDeviceId: null,

  setPage: (page) => set({ page }),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      localStorage.setItem(LS.theme, next);
      return { theme: next };
    }),

  setThemeStyle: (themeStyle) => {
    localStorage.setItem(LS.themeStyle, themeStyle);
    set({ themeStyle });
  },

  setUi: (patch) =>
    set((s) => {
      const next = { ...s.ui, ...patch };
      writeJson(LS.ui, next);
      return { ui: next };
    }),

  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),

  addDevice: (draft) =>
    set((s) => {
      const next: Device[] = [
        ...s.devices,
        {
          ...draft,
          id: crypto.randomUUID(),
          migration: { racked: false, cabled: false, powered: false, tested: false },
        } as Device,
      ];
      writeJson(LS.devices, next);
      return { devices: next };
    }),

  updateDevice: (id, patch) =>
    set((s) => {
      const next = s.devices.map((d) => (d.id === id ? ({ ...d, ...patch } as Device) : d));
      writeJson(LS.devices, next);
      return { devices: next };
    }),

  deleteDevice: (id) =>
    set((s) => {
      const next = s.devices.filter((d) => d.id !== id);
      writeJson(LS.devices, next);
      return { devices: next, selectedDeviceId: s.selectedDeviceId === id ? null : s.selectedDeviceId };
    }),

  clearPlacement: (mode, id) =>
    set((s) => {
      const next = s.devices.map((d) => {
        if (d.id !== id) return d;
        return mode === "before"
          ? { ...d, beforeRackId: undefined, beforeStartU: undefined, beforeEndU: undefined }
          : { ...d, afterRackId: undefined, afterStartU: undefined, afterEndU: undefined };
      });
      writeJson(LS.devices, next);
      return { devices: next };
    }),

  place: (mode, deviceId, rackId, startU) => {
    const { devices } = get();
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) return { ok: false, message: "找不到設備" };

    const sU = clampU(startU);
    const eU = sU + Math.max(1, Math.min(42, dev.sizeU)) - 1;
    if (eU > 42) return { ok: false, message: "超出機櫃高度限制 (42U)" };

    const collision = devices.find((d) => {
      if (d.id === deviceId) return false;
      const rId = mode === "before" ? d.beforeRackId : d.afterRackId;
      const s = mode === "before" ? d.beforeStartU : d.afterStartU;
      const e = mode === "before" ? d.beforeEndU : d.afterEndU;
      return rId === rackId && s != null && e != null && rangesOverlap(sU, eU, s, e);
    });

    if (collision) return { ok: false, message: `位置衝突：${collision.deviceId} ${collision.name}` };

    const next = devices.map((d) =>
      d.id === deviceId
        ? mode === "before"
          ? { ...d, beforeRackId: rackId, beforeStartU: sU, beforeEndU: eU }
          : { ...d, afterRackId: rackId, afterStartU: sU, afterEndU: eU }
        : d
    );

    writeJson(LS.devices, next);
    set({ devices: next });
    return { ok: true };
  },

  setMigrationFlag: (id, patch) =>
    set((s) => {
      const next = s.devices.map((d) =>
        d.id === id ? { ...d, migration: { ...d.migration, ...patch } } : d
      );
      writeJson(LS.devices, next);
      return { devices: next };
    }),

  importDevicesCSV: (csvText) => {
    try {
      const rows = parseCSV(csvText);
      if (rows.length < 2) return { ok: false, message: "CSV 內容不足（至少要有標題列 + 1 筆資料）" };

      const header = rows[0].map((h) => h.trim());
      const idx = (name: string) => header.findIndex((h) => h === name);

      const required = ["category", "deviceId", "name", "brand", "model", "ports", "sizeU"];
      for (const r of required) {
        if (idx(r) === -1) return { ok: false, message: `缺少欄位：${r}` };
      }

      const toBool = (v: string) => String(v).trim().toLowerCase() === "true";

      const parsed: Device[] = rows.slice(1).map((r) => {
        const get = (k: string) => r[idx(k)] ?? "";
        const category = (get("category") as DeviceCategory) || "Other";
        const sizeU = Math.max(1, Math.min(42, Number(get("sizeU")) || 1));
        const ports = Number(get("ports")) || 0;

        const beforeRackId = get("beforeRackId") || undefined;
        const beforeStartU = get("beforeStartU") ? Number(get("beforeStartU")) : undefined;
        const beforeEndU = get("beforeEndU") ? Number(get("beforeEndU")) : undefined;

        const afterRackId = get("afterRackId") || undefined;
        const afterStartU = get("afterStartU") ? Number(get("afterStartU")) : undefined;
        const afterEndU = get("afterEndU") ? Number(get("afterEndU")) : undefined;

        return {
          id: crypto.randomUUID(),
          category,
          deviceId: get("deviceId"),
          name: get("name"),
          brand: get("brand"),
          model: get("model"),
          ports,
          sizeU,
          ip: get("ip") || "",
          serial: get("serial") || "",
          portMap: get("portMap") || "",
          beforeRackId,
          beforeStartU: beforeStartU ? clampU(beforeStartU) : undefined,
          beforeEndU: beforeEndU ? clampU(beforeEndU) : beforeStartU ? clampU(beforeStartU + sizeU - 1) : undefined,
          afterRackId,
          afterStartU: afterStartU ? clampU(afterStartU) : undefined,
          afterEndU: afterEndU ? clampU(afterEndU) : afterStartU ? clampU(afterStartU + sizeU - 1) : undefined,
          migration: {
            racked: toBool(get("racked")),
            cabled: toBool(get("cabled")),
            powered: toBool(get("powered")),
            tested: toBool(get("tested")),
          },
        };
      });

      const merged = [...get().devices, ...parsed];
      writeJson(LS.devices, merged);
      set({ devices: merged });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: `匯入失敗：${String(e?.message ?? e)}` };
    }
  },
}));

// -----------------------------
// Theme tokens (SAFE: no broken string)
// -----------------------------
const ThemeTokens = () => {
  const style = useStore((s) => s.themeStyle);

  // ✅ 統一類別色（避免跟燈號紅綠打架）
  const CAT = {
    catNetwork: "#14b8a6", // teal
    catServer: "#6366f1",  // indigo
    catStorage: "#38bdf8", // sky
    catOther: "#f59e0b",   // amber
  };

  const presets: Record<ThemeStyle, { light: string; dark: string }> = {
    neon: {
      light: `:root{--bg:#f8fafc;--panel:#ffffff;--panel2:#f1f5f9;--text:#0b1220;--muted:#475569;--border:#e2e8f0;--accent:#06b6d4;--accent2:#a855f7;--lampOn:#22c55e;--lampOff:#ef4444;--catNetwork:${CAT.catNetwork};--catServer:${CAT.catServer};--catStorage:${CAT.catStorage};--catOther:${CAT.catOther}}`,
      dark: `html.dark{--bg:#05070d;--panel:#0b1220;--panel2:#1a2235;--text:#e5e7eb;--muted:#94a3b8;--border:#1e293b;--accent:#22d3ee;--accent2:#c084fc;--lampOn:#22c55e;--lampOff:#ef4444;--catNetwork:${CAT.catNetwork};--catServer:${CAT.catServer};--catStorage:${CAT.catStorage};--catOther:${CAT.catOther}}`,
    },
    graphite: {
      light: `:root{--bg:#f6f7fb;--panel:#ffffff;--panel2:#eef2f7;--text:#0a0e16;--muted:#6b7280;--border:#e5e7eb;--accent:#3b82f6;--accent2:#111827;--lampOn:#22c55e;--lampOff:#ef4444;--catNetwork:${CAT.catNetwork};--catServer:${CAT.catServer};--catStorage:${CAT.catStorage};--catOther:${CAT.catOther}}`,
      dark: `html.dark{--bg:#070a0f;--panel:#0b0f18;--panel2:#0a0e16;--text:#f3f4f6;--muted:#9ca3af;--border:#1f2937;--accent:#38bdf8;--accent2:#94a3b8;--lampOn:#22c55e;--lampOff:#ef4444;--catNetwork:${CAT.catNetwork};--catServer:${CAT.catServer};--catStorage:${CAT.catStorage};--catOther:${CAT.catOther}}`,
    },
    aurora: {
      light: `:root{--bg:#f7fbff;--panel:#ffffff;--panel2:#eef6ff;--text:#081120;--muted:#64748b;--border:#e2e8f0;--accent:#14b8a6;--accent2:#6366f1;--lampOn:#22c55e;--lampOff:#ef4444;--catNetwork:${CAT.catNetwork};--catServer:${CAT.catServer};--catStorage:${CAT.catStorage};--catOther:${CAT.catOther}}`,
      dark: `html.dark{--bg:#050913;--panel:#0b1220;--panel2:#081225;--text:#f1f5f9;--muted:#94a3b8;--border:#334155;--accent:#2dd4bf;--accent2:#a5b4fc;--lampOn:#22c55e;--lampOff:#ef4444;--catNetwork:${CAT.catNetwork};--catServer:${CAT.catServer};--catStorage:${CAT.catStorage};--catOther:${CAT.catOther}}`,
    },
    circuit: {
      light: `:root{--bg:#f7f9ff;--panel:#ffffff;--panel2:#edf0ff;--text:#0b1020;--muted:#6b7280;--border:#e2e8f0;--accent:#7c3aed;--accent2:#06b6d4;--lampOn:#22c55e;--lampOff:#ef4444;--catNetwork:${CAT.catNetwork};--catServer:${CAT.catServer};--catStorage:${CAT.catStorage};--catOther:${CAT.catOther}}`,
      dark: `html.dark{--bg:#060714;--panel:#0b0b1a;--panel2:#0b1220;--text:#f8fafc;--muted:#a1a1aa;--border:#27272a;--accent:#a78bfa;--accent2:#22d3ee;--lampOn:#22c55e;--lampOff:#ef4444;--catNetwork:${CAT.catNetwork};--catServer:${CAT.catServer};--catStorage:${CAT.catStorage};--catOther:${CAT.catOther}}`,
    },
  };

  const css = presets[style] || presets.neon;

  // ✅ 絕對安全的換行
  return <style>{`${css.light}\n${css.dark}\nhtml,body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}`}</style>;
};

function useApplyTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
}

// -----------------------------
// Lamps (四顆橫向、放大)
// -----------------------------
const Lamp = ({ on }: { on: boolean }) => (
  <span
    className="inline-block w-2.5 h-2.5 rounded-full"
    style={{
      backgroundColor: on ? "var(--lampOn)" : "var(--lampOff)",
      boxShadow: on ? "0 0 10px var(--lampOn)" : "0 0 10px rgba(239,68,68,0.35)",
    }}
  />
);

const Lamps = ({ m }: { m: MigrationFlags }) => (
  <div className="flex items-center gap-1.5">
    <Lamp on={m.racked} />
    <Lamp on={m.cabled} />
    <Lamp on={m.powered} />
    <Lamp on={m.tested} />
  </div>
);

// -----------------------------
// Device Modal (detail + edit + after status live update)
// -----------------------------
function DeviceDetailModal({
  deviceId,
  mode,
  onClose,
}: {
  deviceId: string;
  mode: PlacementMode;
  onClose: () => void;
}) {
  const device = useStore((s) => s.devices.find((d) => d.id === deviceId));
  const setMigrationFlag = useStore((s) => s.setMigrationFlag);

  if (!device) return null;

  const posText =
    mode === "before"
      ? device.beforeRackId
        ? `${device.beforeRackId} ${device.beforeStartU}-${device.beforeEndU}U`
        : "-"
      : device.afterRackId
      ? `${device.afterRackId} ${device.afterStartU}-${device.afterEndU}U`
      : "-";

  const toggle = (k: keyof MigrationFlags) =>
    setMigrationFlag(device.id, { [k]: !device.migration[k] });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[var(--muted)] font-bold">設備詳細資訊</div>
              <div className="text-xl font-black text-[var(--text)]">
                {device.deviceId} · {device.name}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5" aria-label="close">
              <X />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
              <div className="text-xs text-[var(--muted)] font-bold">類別</div>
              <div className="mt-1 font-extrabold" style={{ color: catColorVar(device.category) }}>
                {device.category}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
              <div className="text-xs text-[var(--muted)] font-bold">
                {mode === "before" ? "搬遷前位置" : "搬遷後位置"}
              </div>
              <div className="mt-1 font-extrabold">{posText}</div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
              <div className="text-xs text-[var(--muted)] font-bold">廠牌 / 型號</div>
              <div className="mt-1 font-extrabold">{device.brand}</div>
              <div className="text-xs text-[var(--muted)]">{device.model}</div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
              <div className="text-xs text-[var(--muted)] font-bold">Ports / 高度</div>
              <div className="mt-1 font-extrabold">
                {device.ports} ports · {device.sizeU}U
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
              <div className="text-xs text-[var(--muted)] font-bold">IP / 序號</div>
              <div className="mt-1 font-semibold">{device.ip || "-"}</div>
              <div className="text-xs text-[var(--muted)]">{device.serial || "-"}</div>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
              <div className="text-xs text-[var(--muted)] font-bold">Port 對接備註</div>
              <div className="mt-1 font-semibold whitespace-pre-wrap break-words">
                {device.portMap || "-"}
              </div>
            </div>
          </div>

          {/* ✅ 只在搬遷後頁可切換，且即時更新 */}
          {mode === "after" && (
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-black">搬遷狀態（即時更新）</div>
                  <div className="text-xs text-[var(--muted)]">
                    四顆燈全綠 = 搬遷完成
                  </div>
                </div>
                <Lamps m={device.migration} />
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ["racked", "已上架"],
                  ["cabled", "已接線"],
                  ["powered", "已開機"],
                  ["tested", "已測試"],
                ] as [keyof MigrationFlags, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => toggle(k)}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 hover:bg-white/5"
                  >
                    <div className="font-bold">{label}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted)]">
                        {device.migration[k] ? "ON" : "OFF"}
                      </span>
                      <div
                        className="w-11 h-6 rounded-full p-1 transition-colors"
                        style={{
                          backgroundColor: device.migration[k]
                            ? "rgba(34,197,94,0.35)"
                            : "rgba(239,68,68,0.25)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded-full transition-transform"
                          style={{
                            background: "var(--text)",
                            transform: device.migration[k] ? "translateX(20px)" : "translateX(0px)",
                          }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 font-bold"
            >
              關閉
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// -----------------------------
// Dashboard
// -----------------------------
const Dashboard = () => {
  const devices = useStore((s) => s.devices);
  const placedAfter = devices.filter((d) => d.afterRackId).length;
  const completed = devices.filter((d) => isMigratedComplete(d.migration)).length;

  const chartData = [
    { name: "Network", count: devices.filter((d) => d.category === "Network").length, fill: catColorVar("Network") },
    { name: "Server", count: devices.filter((d) => d.category === "Server").length, fill: catColorVar("Server") },
    { name: "Storage", count: devices.filter((d) => d.category === "Storage").length, fill: catColorVar("Storage") },
    { name: "Other", count: devices.filter((d) => d.category === "Other").length, fill: catColorVar("Other") },
  ];

  const stats = [
    { label: "總設備數", value: devices.length, icon: <Server size={20} /> },
    { label: "已定位(搬遷後)", value: placedAfter, icon: <ArrowRightLeft size={20} /> },
    { label: "搬遷完成", value: completed, icon: <CheckCircle2 size={20} /> },
    { label: "待處理", value: Math.max(0, devices.length - completed), icon: <AlertCircle size={20} /> },
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
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--panel)] border border-[var(--border)] p-6 rounded-2xl">
          <h3 className="text-lg font-black mb-4">操作提示</h3>
          <ul className="text-sm text-[var(--muted)] space-y-2">
            <li>1) 到「設備管理」新增/編輯設備（含 Ports、IP、序號、占用 U）。</li>
            <li>2) 在「搬遷前/後」把設備從清單拖到機櫃（或拖已放置設備重新調整）。</li>
            <li>3) 點機櫃內設備可看詳細資訊；在「搬遷後」可即時切換 4 個狀態。</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// -----------------------------
// Devices Page (CSV import + template download)
// -----------------------------
function DeviceModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial: DeviceDraft;
  onClose: () => void;
  onSave: (d: DeviceDraft) => void;
}) {
  const [d, setD] = useState<DeviceDraft>(initial);
  const portsOptions = [8, 16, 24, 48, 72];

  const input = (k: keyof DeviceDraft) => (e: any) =>
    setD((p) => ({ ...p, [k]: e.target.value } as any));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-black text-[var(--text)]">{title}</div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5" aria-label="close">
              <X />
            </button>
          </div>

          <form
            className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!d.deviceId.trim() || !d.name.trim()) return alert("請填寫設備編號與設備名稱");
              onSave({
                ...d,
                ports: Number(d.ports) || 0,
                sizeU: Math.max(1, Math.min(42, Number(d.sizeU) || 1)),
              });
            }}
          >
            <div>
              <label className="text-xs text-[var(--muted)]">類別</label>
              <select
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                value={d.category}
                onChange={input("category") as any}
              >
                {(["Network", "Server", "Storage", "Other"] as DeviceCategory[]).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">設備編號</label>
              <input
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                value={d.deviceId}
                onChange={input("deviceId")}
                placeholder="EX: SW-01"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">設備名稱</label>
              <input
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                value={d.name}
                onChange={input("name")}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">廠牌</label>
              <input
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                value={d.brand}
                onChange={input("brand")}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">型號</label>
              <input
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                value={d.model}
                onChange={input("model")}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">Port數量</label>
              <select
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                value={String(d.ports)}
                onChange={(e) => setD((p) => ({ ...p, ports: Number(e.target.value) }))}
              >
                {portsOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">占用高度(U)</label>
              <input
                type="number"
                min={1}
                max={42}
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                value={d.sizeU}
                onChange={(e) => setD((p) => ({ ...p, sizeU: Number(e.target.value) || 1 }))}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">設備IP</label>
              <input
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                value={d.ip ?? ""}
                onChange={input("ip")}
                placeholder="10.0.0.10"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">序號</label>
              <input
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                value={d.serial ?? ""}
                onChange={input("serial")}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-[var(--muted)]">Port對接備註</label>
              <input
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                value={d.portMap ?? ""}
                onChange={input("portMap")}
                placeholder="EX: Gi1/0/1 -> Firewall WAN"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90"
              >
                儲存
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

const DevicesPage = () => {
  const devices = useStore((s) => s.devices);
  const addDevice = useStore((s) => s.addDevice);
  const updateDevice = useStore((s) => s.updateDevice);
  const deleteDevice = useStore((s) => s.deleteDevice);
  const clearPlacement = useStore((s) => s.clearPlacement);
  const importDevicesCSV = useStore((s) => s.importDevicesCSV);

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCSVFile = async (file: File) => {
    const text = await file.text();
    const res = importDevicesCSV(text);
    if (!res.ok) alert(res.message);
    else alert("匯入完成！");
    setImportOpen(false);
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">設備管理</h2>
          <p className="text-[var(--muted)] text-sm">
            新增/編輯/刪除設備；刪除會同步移除搬遷前與搬遷後機櫃配置。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportDevicesCSV(devices)}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2 font-bold"
          >
            <Download size={16} /> 匯出 CSV
          </button>

          <button
            onClick={() => setImportOpen(true)}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2 font-bold"
          >
            <Upload size={16} /> 匯入 CSV
          </button>

          <button
            onClick={() => setIsAdding(true)}
            className="bg-[var(--accent)] text-black px-4 py-2 rounded-xl font-extrabold flex items-center gap-2 hover:opacity-90"
          >
            <Plus size={18} /> 新增設備
          </button>
        </div>
      </div>

      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-black/20 text-[var(--muted)] text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">分類</th>
              <th className="px-6 py-4 font-semibold">編號 / 名稱</th>
              <th className="px-6 py-4 font-semibold">廠牌 / 型號</th>
              <th className="px-6 py-4 font-semibold">Ports / U</th>
              <th className="px-6 py-4 font-semibold">搬遷前</th>
              <th className="px-6 py-4 font-semibold">搬遷後</th>
              <th className="px-6 py-4 font-semibold">狀態</th>
              <th className="px-6 py-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {devices.map((d) => {
              const before =
                d.beforeRackId && d.beforeStartU != null
                  ? `${d.beforeRackId} ${d.beforeStartU}-${d.beforeEndU}U`
                  : "-";
              const after =
                d.afterRackId && d.afterStartU != null
                  ? `${d.afterRackId} ${d.afterStartU}-${d.afterEndU}U`
                  : "-";
              return (
                <tr key={d.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <span
                      className="text-[10px] font-extrabold px-2 py-1 rounded-md border"
                      style={{
                        color: catColorVar(d.category),
                        borderColor: `${catColorVar(d.category)}66`,
                        backgroundColor: `${catColorVar(d.category)}14`,
                      }}
                    >
                      {d.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-black text-sm">{d.deviceId}</div>
                    <div className="text-xs text-[var(--muted)]">{d.name}</div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="text-[var(--text)] font-semibold">{d.brand}</div>
                    <div className="text-[var(--muted)]">{d.model}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-[var(--muted)]">
                    {d.ports} / {d.sizeU}U
                  </td>
                  <td className="px-6 py-4 text-xs text-[var(--muted)]">{before}</td>
                  <td className="px-6 py-4 text-xs text-[var(--muted)]">{after}</td>
                  <td className="px-6 py-4">
                    <Lamps m={d.migration} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditing(d)}
                        className="p-2 hover:bg-white/10 rounded-lg text-[var(--accent)]"
                        title="編輯"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          clearPlacement("before", d.id);
                          clearPlacement("after", d.id);
                        }}
                        className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-white/5 font-bold"
                        title="清除位置"
                      >
                        清除
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`確定刪除 ${d.deviceId} - ${d.name}？`)) deleteDevice(d.id);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                        title="刪除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {devices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-[var(--muted)]">
                  目前沒有設備，請先新增或匯入 CSV。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 新增 */}
      {isAdding && (
        <DeviceModal
          title="新增設備"
          initial={{
            category: "Other",
            deviceId: "",
            name: "",
            brand: "",
            model: "",
            ports: 8,
            sizeU: 1,
            ip: "",
            serial: "",
            portMap: "",
          }}
          onClose={() => setIsAdding(false)}
          onSave={(d) => {
            addDevice(d);
            setIsAdding(false);
          }}
        />
      )}

      {/* 編輯 */}
      {editing && (
        <DeviceModal
          title="編輯設備"
          initial={{
            category: editing.category,
            deviceId: editing.deviceId,
            name: editing.name,
            brand: editing.brand,
            model: editing.model,
            ports: editing.ports,
            sizeU: editing.sizeU,
            ip: editing.ip ?? "",
            serial: editing.serial ?? "",
            portMap: editing.portMap ?? "",
          }}
          onClose={() => setEditing(null)}
          onSave={(d) => {
            updateDevice(editing.id, d);
            setEditing(null);
          }}
        />
      )}

      {/* CSV 匯入 */}
      {importOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-black">CSV 匯入</div>
                  <div className="text-xs text-[var(--muted)]">
                    可拖曳上傳 .csv；也可下載範本
                  </div>
                </div>
                <button onClick={() => setImportOpen(false)} className="p-2 rounded-xl hover:bg-white/5">
                  <X />
                </button>
              </div>

              <div
                className={`mt-5 rounded-3xl border border-dashed p-6 text-center transition-colors ${
                  dragOver ? "border-[var(--accent)] bg-white/5" : "border-[var(--border)]"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleCSVFile(f);
                }}
              >
                <div className="text-sm font-bold">拖曳 CSV 檔案到這裡</div>
                <div className="text-xs text-[var(--muted)] mt-1">或點下面按鈕選擇檔案</div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCSVFile(f);
                  }}
                />

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 font-bold"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    選擇檔案
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90"
                    onClick={downloadCSVTemplate}
                  >
                    下載範本
                  </button>
                </div>
              </div>

              <div className="mt-5 text-xs text-[var(--muted)]">
                需求欄位：{["category", "deviceId", "name", "brand", "model", "ports", "sizeU"].join(", ")}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// -----------------------------
// Rack Planner
// -----------------------------
type HoverInfo = {
  x: number;
  y: number;
  device: Device;
};

const RackPlanner = ({ mode }: { mode: PlacementMode }) => {
  const devices = useStore((s) => s.devices);
  const place = useStore((s) => s.place);
  const clearPlacement = useStore((s) => s.clearPlacement);
  const selectedDeviceId = useStore((s) => s.selectedDeviceId);
  const setSelectedDeviceId = useStore((s) => s.setSelectedDeviceId);

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // ✅ 每一 U 高度
  const U_H = 24;

  // ✅ 佈局
  const rows = useMemo(() => (mode === "before" ? BEFORE_LAYOUT : AFTER_LAYOUT), [mode]);

  // 清單（左側拖拉）
  const unplaced = useMemo(() => {
    return devices.filter((d) => {
      const r = mode === "before" ? d.beforeRackId : d.afterRackId;
      const s = mode === "before" ? d.beforeStartU : d.afterStartU;
      const e = mode === "before" ? d.beforeEndU : d.afterEndU;
      return !(r && s != null && e != null);
    });
  }, [devices, mode]);

  const listForRack = (rackId: string) =>
    devices
      .filter((d) => (mode === "before" ? d.beforeRackId === rackId : d.afterRackId === rackId))
      .filter((d) => {
        const s = mode === "before" ? d.beforeStartU : d.afterStartU;
        const e = mode === "before" ? d.beforeEndU : d.afterEndU;
        return s != null && e != null;
      })
      .sort((a, b) => {
        const as = (mode === "before" ? a.beforeStartU : a.afterStartU) ?? 999;
        const bs = (mode === "before" ? b.beforeStartU : b.afterStartU) ?? 999;
        return as - bs;
      });

  const getBlockStyle = (d: Device) => {
    const sU = (mode === "before" ? d.beforeStartU : d.afterStartU) ?? 1;
    const eU = (mode === "before" ? d.beforeEndU : d.afterEndU) ?? sU;
    const start = clampU(Math.min(sU, eU));
    const end = clampU(Math.max(sU, eU));
    const height = (end - start + 1) * U_H;
    const bottom = (start - 1) * U_H;
    return { bottom, height, start, end };
  };

  const onDrop = (e: React.DragEvent, rackId: string, u: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const res = place(mode, id, rackId, u);
    if (!res.ok) alert(res.message);
  };

  const Legend = (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-3 shadow-xl">
      <div className="text-xs font-black text-[var(--muted)] mb-2">設備類別顏色</div>
      <div className="flex flex-wrap gap-3 text-xs font-bold">
        {([
          ["Network", "Network"],
          ["Server", "Server"],
          ["Storage", "Storage"],
          ["Other", "Other"],
        ] as [string, DeviceCategory][]).map(([label, cat]) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="inline-block w-3.5 h-3.5 rounded-md border border-black/20"
              style={{ backgroundColor: catColorVar(cat) }}
            />
            <span className="text-[var(--text)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">
            {mode === "before" ? "搬遷前" : "搬遷後"} 機櫃佈局
          </h2>
          <p className="text-[var(--muted)] text-sm">
            拖拉設備到機櫃；點設備可看詳細資訊{mode === "after" ? "（可即時切換狀態）" : ""}
          </p>
        </div>
        {Legend}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        {/* 左側：設備清單 */}
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div className="font-black">未放置設備</div>
            {selectedDeviceId && (
              <button
                className="text-xs px-3 py-1 rounded-lg border border-[var(--border)] hover:bg-white/5 font-bold"
                onClick={() => setSelectedDeviceId(null)}
              >
                取消選取
              </button>
            )}
          </div>
          <div className="p-3 space-y-2 max-h-[70vh] overflow-auto">
            {unplaced.map((d) => (
              <div
                key={d.id}
                draggable
                onDragStart={(ev) => {
                  ev.dataTransfer.setData("text/plain", d.id);
                  ev.dataTransfer.effectAllowed = "move";
                }}
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-3 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-black truncate">{d.deviceId}</div>
                    <div className="text-[12px] font-extrabold truncate text-[var(--text)]">
                      {d.name}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate">
                      {d.brand} · {d.model} · {d.sizeU}U
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-extrabold px-2 py-1 rounded-md border"
                    style={{
                      color: catColorVar(d.category),
                      borderColor: `${catColorVar(d.category)}66`,
                      backgroundColor: `${catColorVar(d.category)}14`,
                    }}
                  >
                    {d.category}
                  </span>
                </div>
              </div>
            ))}
            {unplaced.length === 0 && (
              <div className="text-sm text-[var(--muted)] text-center py-6">
                全部設備都已放置
              </div>
            )}
          </div>
        </div>

        {/* 右側：機櫃 */}
        <div className="space-y-6">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
            >
              {row.map((rackName) => (
                <div
                  key={rackName}
                  className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
                >
                  <div
                    className="bg-black/30 text-center py-2 font-mono text-sm border-b border-[var(--border)]"
                    style={{
                      color: isNoMoveRack(rackName) ? "#ef4444" : "var(--accent)",
                      fontWeight: 900,
                    }}
                  >
                    {rackName}
                  </div>

                  <div className="p-3">
                    <div className="flex gap-2">
                      {/* 左刻度 1~42 */}
                      <div className="relative">
                        <div
                          className="absolute inset-0 blur-xl"
                          style={{
                            background:
                              "radial-gradient(circle at top, var(--accent), transparent 60%)",
                            opacity: 0.15,
                          }}
                        />
                        <div className="relative flex flex-col-reverse">
                          {Array.from({ length: 42 }).map((_, i) => {
                            const u = i + 1;
                            return (
                              <div
                                key={u}
                                className="w-8 pr-1 text-right text-[10px] leading-none text-[var(--muted)]"
                                style={{ height: U_H }}
                              >
                                {u}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Rack grid */}
                      <div
                        className="relative flex-1 border border-[var(--border)] bg-black/20"
                        style={{ height: 42 * U_H }}
                      >
                        {/* grid cells */}
                        <div className="absolute inset-0 flex flex-col-reverse">
                          {Array.from({ length: 42 }).map((_, i) => {
                            const u = i + 1;
                            return (
                              <div
                                key={u}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => onDrop(e, rackName, u)}
                                className="relative"
                                style={{ height: U_H }}
                              >
                                {/* ✅ 每 5U 粗線 */}
                                <div
                                  className="absolute inset-x-0 top-0"
                                  style={{
                                    height: u % 5 === 0 ? 2 : 1,
                                    backgroundColor:
                                      u % 5 === 0
                                        ? "rgba(255,255,255,0.28)"
                                        : "rgba(255,255,255,0.15)",
                                  }}
                                />
                                <div className="absolute inset-0 hover:bg-white/[0.03]" />
                              </div>
                            );
                          })}
                        </div>

                        {/* device blocks */}
                        {listForRack(rackName).map((d) => {
                          const { bottom, height } = getBlockStyle(d);
                          const catColor = catColorVar(d.category);

                          return (
                            <div
                              key={d.id}
                              draggable
                              onDragStart={(ev) => {
                                ev.dataTransfer.setData("text/plain", d.id);
                                ev.dataTransfer.effectAllowed = "move";
                              }}
                              onMouseEnter={(ev) => {
                                const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                                setHover({ x: rect.right + 10, y: rect.top, device: d });
                              }}
                              onMouseLeave={() => setHover(null)}
                              onClick={() => setDetailId(d.id)}
                              className="absolute left-1 right-1 border border-black/30 text-black cursor-pointer select-none"
                              style={{
                                bottom,
                                height,
                                backgroundColor: `${catColor}`,
                              }}
                            >
                              {/* 內容 */}
                              <div className="h-full w-full px-2 py-1 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[13px] font-black truncate">
                                    {d.deviceId}
                                  </div>
                                  <div className="text-[12px] font-extrabold truncate opacity-95">
                                    {d.name}
                                  </div>
                                </div>

                                {/* 右上 X：清除位置 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearPlacement(mode, d.id);
                                  }}
                                  className="p-1 rounded-lg hover:bg-black/10"
                                  title="移除"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              {/* ✅ 右下燈號（橫式，不與 X 重疊） */}
                              <div className="absolute right-2 bottom-2">
                                <Lamps m={d.migration} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ✅ 不再在每個機櫃下重複提示（已移除） */}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Hover card */}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl p-4 w-[280px]">
            <div className="text-xs text-[var(--muted)] font-bold">設備資訊</div>
            <div className="mt-1 font-black text-[var(--text)]">
              {hover.device.deviceId} · {hover.device.name}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              {hover.device.brand} · {hover.device.model} · {hover.device.sizeU}U
            </div>
          </div>
        </div>
      )}

      {/* ✅ 左下工作列（只顯示一次） */}
      <div className="fixed left-6 bottom-24 lg:bottom-6 z-40">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-3 shadow-2xl max-w-[520px]">
          <div className="text-xs font-black text-[var(--muted)] mb-1">提示</div>
          <div className="text-sm text-[var(--text)] font-semibold">
            拖拉設備到機櫃可配置位置；放置時會自動檢查 U 位重疊。
          </div>
        </div>
      </div>

      {/* 詳細資訊 */}
      {detailId && (
        <DeviceDetailModal deviceId={detailId} mode={mode} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
};

// -----------------------------
// Main App Shell
// -----------------------------
export default function App() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const themeStyle = useStore((s) => s.themeStyle);
  const setThemeStyle = useStore((s) => s.setThemeStyle);
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);

  useApplyTheme();

  const navItems = [
    { id: "dashboard", label: "儀表板", icon: <LayoutDashboard size={20} /> },
    { id: "devices", label: "設備管理", icon: <Server size={20} /> },
    { id: "before", label: "搬遷前", icon: <ArrowLeftRight size={20} /> },
    { id: "after", label: "搬遷後", icon: <ArrowRightLeft size={20} /> },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-300">
      <ThemeTokens />

      {/* Top Header */}
      <header className="h-16 border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] rounded-lg flex items-center justify-center text-black shadow-[0_0_15px_var(--accent)]">
            <Server size={18} />
          </div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic">
            Migrate<span className="text-[var(--accent)]">Pro</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={themeStyle}
            onChange={(e) => setThemeStyle(e.target.value as ThemeStyle)}
            className="bg-[var(--panel2)] border border-[var(--border)] rounded-lg text-xs px-2 py-1 outline-none hidden sm:block"
          >
            <option value="neon">Neon</option>
            <option value="graphite">Graphite</option>
            <option value="aurora">Aurora</option>
            <option value="circuit">Circuit</option>
          </select>

          <button onClick={toggleTheme} className="p-2 hover:bg-white/5 rounded-full transition-colors" title="深色/淺色">
            {theme === "dark" ? "🌙" : "☀️"}
          </button>

          <button
            className="p-2 hover:bg-white/5 rounded-full transition-colors hidden lg:block"
            onClick={() => setUi({ sideCollapsed: !ui.sideCollapsed })}
            title="收合選單"
          >
            {ui.sideCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav
          className={`border-r border-[var(--border)] h-[calc(100vh-64px)] sticky top-16 p-4 bg-[var(--panel)] hidden lg:block transition-all ${
            ui.sideCollapsed ? "w-20" : "w-64"
          }`}
        >
          <div className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id as PageKey)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  page === item.id
                    ? "bg-[var(--panel2)] text-[var(--accent)] border border-[var(--border)] shadow-[0_0_20px_rgba(34,211,238,0.12)] font-black"
                    : "text-[var(--muted)] hover:bg-white/[0.03]"
                }`}
              >
                {item.icon}
                {!ui.sideCollapsed && item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content Area */}
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
              {page === "devices" && <DevicesPage />}
              {page === "before" && <RackPlanner mode="before" />}
              {page === "after" && <RackPlanner mode="after" />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-2 flex gap-6 shadow-2xl z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id as PageKey)}
            className={`p-2 rounded-lg ${
              page === item.id ? "text-[var(--accent)] bg-[var(--panel2)]" : "text-[var(--muted)]"
            }`}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
