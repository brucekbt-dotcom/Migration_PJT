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
  FileUp,
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

/** -----------------------------
 * Types
 * ---------------------------- */
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
  portMap?: string;

  beforeRackId?: string;
  beforeStartU?: number;
  beforeEndU?: number;

  afterRackId?: string;
  afterStartU?: number;
  afterEndU?: number;

  migration: MigrationFlags;
};

type DeviceDraft = Omit<Device, "id" | "migration" | "beforeRackId" | "beforeStartU" | "beforeEndU" | "afterRackId" | "afterStartU" | "afterEndU">;

/** -----------------------------
 * Layout (你更正後版本)
 * ---------------------------- */
const BEFORE_LAYOUT: string[][] = [
  ["B10", "B9", "B8", "B7", "B6"],
  ["A5", "A4", "A3", "A2", "A1"],
  ["2F-A", "2F-B", "3F-A", "3F-B", "4F-A", "4F-B"],
  ["9F", "SmartHouseA", "SmartHouseB"],
];

const AFTER_LAYOUT: string[][] = [
  ["A1", "A2", "A3", "A4", "A5", "A6"],
  ["B1", "B2", "B3", "B4", "B5", "B6"],
  ["HUB 15L", "HUB 15R", "HUB 16L", "HUB 16R", "HUB 17L", "HUB 17R"],
  ["HUB 20F", "SmartHouse 20F", "不搬存放區A", "不搬存放區B", "不搬存放區C"],
];

const isNoMoveRack = (name: string) => name.startsWith("不搬存放區");

/** -----------------------------
 * Mock racks (覆蓋佈局用到的全部 rack)
 * ---------------------------- */
const mockRacks: Rack[] = [
  // before
  ...["B10","B9","B8","B7","B6"].map((n) => ({ id: n, name: n, units: 42 })),
  ...["A5","A4","A3","A2","A1"].map((n) => ({ id: n, name: n, units: 42 })),
  ...["2F-A","2F-B","3F-A","3F-B","4F-A","4F-B"].map((n) => ({ id: n, name: n, units: 42 })),
  ...["9F","SmartHouseA","SmartHouseB"].map((n) => ({ id: n, name: n, units: 42 })),

  // after
  ...["A1","A2","A3","A4","A5","A6"].map((n) => ({ id: n, name: n, units: 42 })),
  ...["B1","B2","B3","B4","B5","B6"].map((n) => ({ id: n, name: n, units: 42 })),
  ...["HUB 15L","HUB 15R","HUB 16L","HUB 16R","HUB 17L","HUB 17R"].map((n) => ({ id: n, name: n, units: 42 })),
  ...["HUB 20F","SmartHouse 20F","不搬存放區A","不搬存放區B","不搬存放區C"].map((n) => ({ id: n, name: n, units: 42 })),
];

/** -----------------------------
 * Mock devices
 * ---------------------------- */
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
    serial: "SN-CORE-001",
    portMap: "Gi1/0/1 -> FW WAN",
    beforeRackId: "B10",
    beforeStartU: 40,
    beforeEndU: 41,
    afterRackId: "HUB 15L",
    afterStartU: 40,
    afterEndU: 41,
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
    serial: "SN-STO-001",
    portMap: "e0a -> TOR A",
    beforeRackId: "B9",
    beforeStartU: 30,
    beforeEndU: 33,
    migration: { racked: false, cabled: false, powered: false, tested: false },
  },
];

/** -----------------------------
 * Utils
 * ---------------------------- */
const LS = {
  theme: "migrate.theme",
  themeStyle: "migrate.themeStyle",
  devices: "migrate.devices",
} as const;

const clampU = (u: number) => Math.max(1, Math.min(42, u));
const rangesOverlap = (aS: number, aE: number, bS: number, bE: number) =>
  Math.max(aS, bS) <= Math.min(aE, bE);
const isMigratedComplete = (m: MigrationFlags) => m.racked && m.cabled && m.powered && m.tested;

const catColorVar = (cat: DeviceCategory) => {
  switch (cat) {
    case "Network":
      return "var(--catNetwork)";
    case "Storage":
      return "var(--catStorage)";
    case "Server":
      return "var(--catServer)";
    default:
      return "var(--catOther)";
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
  } catch {}
};

const normalizeDevices = (raw: any[]): Device[] => {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((d: any) => {
    const mig = d?.migration ?? {};
    const sizeU = Math.max(1, Math.min(42, Number(d?.sizeU ?? 1)));
    const fixRange = (start: any, end: any) => {
      const s = start == null ? undefined : clampU(Number(start));
      const e = end == null ? undefined : clampU(Number(end));
      if (s == null || e == null) return { s: undefined, e: undefined };
      return { s: Math.min(s, e), e: Math.max(s, e) };
    };
    const b = fixRange(d?.beforeStartU, d?.beforeEndU);
    const a = fixRange(d?.afterStartU, d?.afterEndU);

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
      beforeStartU: b.s,
      beforeEndU: b.e,
      afterRackId: d?.afterRackId ?? undefined,
      afterStartU: a.s,
      afterEndU: a.e,
      migration: {
        racked: Boolean(mig?.racked ?? false),
        cabled: Boolean(mig?.cabled ?? false),
        powered: Boolean(mig?.powered ?? false),
        tested: Boolean(mig?.tested ?? false),
      },
    } as Device;
  });
};

/** -----------------------------
 * CSV (匯出/匯入)
 * ---------------------------- */
const CSV_HEADERS = [
  "id",
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

type CsvHeader = typeof CSV_HEADERS[number];

function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(devices: Device[]) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    const needs = s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
    return needs ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = devices.map((d) => {
    const m = d.migration ?? { racked: false, cabled: false, powered: false, tested: false };
    return [
      d.id,
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
      m.racked,
      m.cabled,
      m.powered,
      m.tested,
    ];
  });

  return `${CSV_HEADERS.join(",")}\n${rows.map((r) => r.map(esc).join(",")).join("\n")}`;
}

/** 簡單 CSV parser（支援雙引號與逗號） */
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    // ignore completely empty trailing line
    if (row.length === 1 && row[0] === "" && rows.length > 0) return;
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' ) {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      pushCell();
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      pushCell();
      pushRow();
      continue;
    }

    cur += ch;
  }

  // last
  pushCell();
  pushRow();

  const headers = rows.shift() || [];
  return { headers, rows };
}

function asBool(v: any) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}
function asNum(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/** 匯入策略：
 * - 以 deviceId 做唯一鍵：同 deviceId -> 更新（保留原 id）；沒有 -> 新增（使用 csv.id 或新 uuid）
 */
function mergeFromCSV(existing: Device[], csvText: string): { next: Device[]; added: number; updated: number } {
  const { headers, rows } = parseCSV(csvText);
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => (idx[h.trim()] = i));

  const get = (r: string[], key: string) => {
    const i = idx[key];
    return i == null ? "" : (r[i] ?? "");
  };

  const byDeviceId = new Map<string, Device>();
  existing.forEach((d) => byDeviceId.set(d.deviceId, d));

  let added = 0, updated = 0;
  const next = [...existing];

  for (const r of rows) {
    const deviceId = String(get(r, "deviceId")).trim();
    if (!deviceId) continue;

    const old = byDeviceId.get(deviceId);

    const category = (String(get(r, "category")).trim() as DeviceCategory) || "Other";
    const sizeU = Math.max(1, Math.min(42, asNum(get(r, "sizeU"), old?.sizeU ?? 1)));
    const ports = asNum(get(r, "ports"), old?.ports ?? 0);

    const beforeStartU = get(r, "beforeStartU") ? clampU(asNum(get(r, "beforeStartU"), 1)) : undefined;
    const beforeEndU = get(r, "beforeEndU") ? clampU(asNum(get(r, "beforeEndU"), beforeStartU ?? 1)) : undefined;
    const afterStartU = get(r, "afterStartU") ? clampU(asNum(get(r, "afterStartU"), 1)) : undefined;
    const afterEndU = get(r, "afterEndU") ? clampU(asNum(get(r, "afterEndU"), afterStartU ?? 1)) : undefined;

    const mig: MigrationFlags = {
      racked: asBool(get(r, "racked")),
      cabled: asBool(get(r, "cabled")),
      powered: asBool(get(r, "powered")),
      tested: asBool(get(r, "tested")),
    };

    const patch: Device = {
      id: old?.id ?? (String(get(r, "id")).trim() || crypto.randomUUID()),
      category: (["Network","Storage","Server","Other"] as DeviceCategory[]).includes(category) ? category : "Other",
      deviceId,
      name: String(get(r, "name") ?? old?.name ?? ""),
      brand: String(get(r, "brand") ?? old?.brand ?? ""),
      model: String(get(r, "model") ?? old?.model ?? ""),
      ports,
      sizeU,
      ip: String(get(r, "ip") ?? old?.ip ?? ""),
      serial: String(get(r, "serial") ?? old?.serial ?? ""),
      portMap: String(get(r, "portMap") ?? old?.portMap ?? ""),

      beforeRackId: String(get(r, "beforeRackId") ?? "").trim() || undefined,
      beforeStartU: beforeStartU == null ? undefined : Math.min(beforeStartU, beforeEndU ?? beforeStartU),
      beforeEndU: beforeEndU == null ? undefined : Math.max(beforeStartU ?? beforeEndU, beforeEndU),

      afterRackId: String(get(r, "afterRackId") ?? "").trim() || undefined,
      afterStartU: afterStartU == null ? undefined : Math.min(afterStartU, afterEndU ?? afterStartU),
      afterEndU: afterEndU == null ? undefined : Math.max(afterStartU ?? afterEndU, afterEndU),

      migration: mig,
    };

    if (old) {
      const i = next.findIndex((d) => d.id === old.id);
      if (i >= 0) next[i] = patch;
      updated++;
    } else {
      next.push(patch);
      added++;
    }
  }

  return { next: normalizeDevices(next), added, updated };
}

/** -----------------------------
 * Store
 * ---------------------------- */
interface Store {
  racks: Rack[];
  devices: Device[];
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  page: PageKey;

  selectedDeviceId: string | null; // for device detail modal

  setPage: (p: PageKey) => void;
  toggleTheme: () => void;
  setThemeStyle: (s: ThemeStyle) => void;

  addDevice: (draft: DeviceDraft) => void;
  updateDevice: (id: string, patch: Partial<DeviceDraft>) => void;
  deleteDevice: (id: string) => void;

  clearPlacement: (mode: PlacementMode, id: string) => void;
  place: (mode: PlacementMode, deviceId: string, rackId: string, startU: number) => { ok: boolean; message?: string };

  setMigrationFlag: (id: string, patch: Partial<MigrationFlags>) => void;

  importCSV: (csvText: string) => { added: number; updated: number };
  downloadTemplate: () => void;
}

const useStore = create<Store>((set, get) => ({
  racks: mockRacks,
  devices: normalizeDevices(readJson<Device[]>(LS.devices, mockDevices)),
  theme: (localStorage.getItem(LS.theme) as ThemeMode) || "dark",
  themeStyle: (localStorage.getItem(LS.themeStyle) as ThemeStyle) || "neon",
  page: "dashboard",
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

    if (collision) return { ok: false, message: `位置衝突: ${collision.deviceId} ${collision.name}` };

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

  importCSV: (csvText) => {
    const { devices } = get();
    const { next, added, updated } = mergeFromCSV(devices, csvText);
    writeJson(LS.devices, next);
    set({ devices: next });
    return { added, updated };
  },

  downloadTemplate: () => {
    const example = [
      CSV_HEADERS.join(","),
      [
        "",
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
        "B10",
        "40",
        "41",
        "HUB 15L",
        "40",
        "41",
        "true",
        "true",
        "false",
        "false",
      ].join(","),
    ].join("\n");
    downloadText("devices_template.csv", example, "text/csv;charset=utf-8");
  },
}));

/** -----------------------------
 * Theme tokens (安全寫法，不會再壞)
 * ---------------------------- */
const ThemeTokens = () => {
  const style = useStore((s) => s.themeStyle);

  const presets: Record<ThemeStyle, { light: string; dark: string }> = {
    neon: {
      light:
        ":root{--bg:#f8fafc;--panel:#ffffff;--panel2:#f1f5f9;--text:#0b1220;--muted:#475569;--border:#e2e8f0;--accent:#06b6d4;--accent2:#a855f7;--catNetwork:#22c55e;--catStorage:#67e8f9;--catServer:#3b82f6;--catOther:#facc15;--lampOn:#22c55e;--lampOff:#ef4444}",
      dark:
        "html.dark{--bg:#05070d;--panel:#0b1220;--panel2:#1a2235;--text:#e5e7eb;--muted:#94a3b8;--border:#1e293b;--accent:#22d3ee;--accent2:#c084fc;--catNetwork:#4ade80;--catStorage:#a5f3fc;--catServer:#60a5fa;--catOther:#fde047;--lampOn:#4ade80;--lampOff:#ef4444}",
    },
    graphite: {
      light:
        ":root{--bg:#f6f7fb;--panel:#ffffff;--panel2:#eef2f7;--text:#0a0e16;--muted:#6b7280;--border:#e5e7eb;--accent:#3b82f6;--accent2:#111827;--catNetwork:#16a34a;--catStorage:#06b6d4;--catServer:#2563eb;--catOther:#ca8a04;--lampOn:#16a34a;--lampOff:#ef4444}",
      dark:
        "html.dark{--bg:#070a0f;--panel:#0b0f18;--panel2:#0a0e16;--text:#f3f4f6;--muted:#9ca3af;--border:#1f2937;--accent:#38bdf8;--accent2:#94a3b8;--catNetwork:#22c55e;--catStorage:#22d3ee;--catServer:#60a5fa;--catOther:#fbbf24;--lampOn:#22c55e;--lampOff:#ef4444}",
    },
    aurora: {
      light:
        ":root{--bg:#f7fbff;--panel:#ffffff;--panel2:#eef6ff;--text:#081120;--muted:#64748b;--border:#e2e8f0;--accent:#14b8a6;--accent2:#6366f1;--catNetwork:#10b981;--catStorage:#22d3ee;--catServer:#4f46e5;--catOther:#f59e0b;--lampOn:#10b981;--lampOff:#ef4444}",
      dark:
        "html.dark{--bg:#050913;--panel:#0b1220;--panel2:#081225;--text:#f1f5f9;--muted:#94a3b8;--border:#334155;--accent:#2dd4bf;--accent2:#a5b4fc;--catNetwork:#34d399;--catStorage:#67e8f9;--catServer:#818cf8;--catOther:#fbbf24;--lampOn:#34d399;--lampOff:#ef4444}",
    },
    circuit: {
      light:
        ":root{--bg:#f7f9ff;--panel:#ffffff;--panel2:#edf0ff;--text:#0b1020;--muted:#6b7280;--border:#e2e8f0;--accent:#7c3aed;--accent2:#06b6d4;--catNetwork:#22c55e;--catStorage:#38bdf8;--catServer:#7c3aed;--catOther:#eab308;--lampOn:#22c55e;--lampOff:#ef4444}",
      dark:
        "html.dark{--bg:#060714;--panel:#0b0b1a;--panel2:#0b1220;--text:#f8fafc;--muted:#a1a1aa;--border:#27272a;--accent:#a78bfa;--accent2:#22d3ee;--catNetwork:#4ade80;--catStorage:#7dd3fc;--catServer:#c4b5fd;--catOther:#fde047;--lampOn:#4ade80;--lampOff:#ef4444}",
    },
  };

  const css = presets[style] || presets.neon;
  // ✅ 不用任何 " + \n "，避免貼上斷行壞掉
  return <style>{css.light + css.dark}</style>;
};

function useApplyTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
}

/** -----------------------------
 * Lamps (設備管理頁：大燈；機櫃內：小燈)
 * ---------------------------- */
const Lamp = ({ on, big }: { on: boolean; big?: boolean }) => (
  <span
    className="inline-block rounded-full"
    style={{
      width: big ? 10 : 6,
      height: big ? 10 : 6,
      backgroundColor: on ? "var(--lampOn)" : "var(--lampOff)",
      boxShadow: on
        ? `0 0 ${big ? 10 : 8}px var(--lampOn)`
        : `0 0 ${big ? 10 : 8}px rgba(239,68,68,0.35)`,
    }}
  />
);

const Lamps = ({ m }: { m: MigrationFlags }) => (
  <div className="flex items-center gap-2">
    <Lamp on={m.racked} big />
    <Lamp on={m.cabled} big />
    <Lamp on={m.powered} big />
    <Lamp on={m.tested} big />
  </div>
);

const RackLamps = ({ m }: { m: MigrationFlags }) => (
  <div className="flex items-center gap-1">
    <Lamp on={m.racked} />
    <Lamp on={m.cabled} />
    <Lamp on={m.powered} />
    <Lamp on={m.tested} />
  </div>
);

/** -----------------------------
 * Modal base
 * ---------------------------- */
function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-black text-[var(--text)]">{title}</div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5" aria-label="close">
              <X />
            </button>
          </div>
          <div className="mt-4">{children}</div>
          {footer ? <div className="mt-5 flex justify-end gap-3">{footer}</div> : null}
        </div>
      </motion.div>
    </div>
  );
}

/** -----------------------------
 * Device create/edit modal
 * ---------------------------- */
function DeviceEditModal({
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

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (!d.deviceId.trim() || !d.name.trim()) return alert("請填寫設備編號與設備名稱");
              onSave({
                ...d,
                ports: Number(d.ports) || 0,
                sizeU: Math.max(1, Math.min(42, Number(d.sizeU) || 1)),
              });
            }}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90"
          >
            儲存
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[var(--muted)]">類別</label>
          <select
            className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
            value={d.category}
            onChange={(e) => setD((p) => ({ ...p, category: e.target.value as DeviceCategory }))}
          >
            {(["Network", "Storage", "Server", "Other"] as DeviceCategory[]).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-[var(--muted)]">設備編號 (deviceId)</label>
          <input
            className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            value={d.deviceId}
            onChange={(e) => setD((p) => ({ ...p, deviceId: e.target.value }))}
            placeholder="EX: SW-01"
          />
        </div>

        <div>
          <label className="text-xs text-[var(--muted)]">設備名稱</label>
          <input
            className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
            value={d.name}
            onChange={(e) => setD((p) => ({ ...p, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-xs text-[var(--muted)]">廠牌</label>
          <input
            className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
            value={d.brand}
            onChange={(e) => setD((p) => ({ ...p, brand: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-xs text-[var(--muted)]">型號</label>
          <input
            className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
            value={d.model}
            onChange={(e) => setD((p) => ({ ...p, model: e.target.value }))}
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
            onChange={(e) => setD((p) => ({ ...p, ip: e.target.value }))}
            placeholder="10.0.0.10"
          />
        </div>

        <div>
          <label className="text-xs text-[var(--muted)]">序號</label>
          <input
            className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
            value={d.serial ?? ""}
            onChange={(e) => setD((p) => ({ ...p, serial: e.target.value }))}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-[var(--muted)]">Port對接備註</label>
          <input
            className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
            value={d.portMap ?? ""}
            onChange={(e) => setD((p) => ({ ...p, portMap: e.target.value }))}
            placeholder="EX: Gi1/0/1 -> Firewall WAN"
          />
        </div>
      </div>
    </Modal>
  );
}

/** -----------------------------
 * Device detail modal (搬遷後可即時切換狀態)
 * ---------------------------- */
function DeviceDetailModal({
  deviceId,
  onClose,
  allowToggleMigration,
}: {
  deviceId: string;
  onClose: () => void;
  allowToggleMigration: boolean;
}) {
  const dev = useStore((s) => s.devices.find((d) => d.id === deviceId));
  const setMigrationFlag = useStore((s) => s.setMigrationFlag);

  if (!dev) return null;

  const toggle = (k: keyof MigrationFlags) => {
    // ✅ 直接更新 store → 畫面立即變更
    setMigrationFlag(dev.id, { [k]: !dev.migration[k] });
  };

  const statusRow = (label: string, key: keyof MigrationFlags) => (
    <div className="flex items-center justify-between py-2">
      <div className="text-sm text-[var(--text)]">{label}</div>
      <button
        disabled={!allowToggleMigration}
        onClick={() => toggle(key)}
        className={`w-14 h-8 rounded-full border transition-all relative ${
          dev.migration[key] ? "bg-[var(--lampOn)]/20 border-[var(--lampOn)]/40" : "bg-black/20 border-[var(--border)]"
        } ${allowToggleMigration ? "hover:opacity-90" : "opacity-50 cursor-not-allowed"}`}
        aria-label={`toggle-${key}`}
      >
        <span
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full transition-all"
          style={{
            left: dev.migration[key] ? 28 : 4,
            backgroundColor: dev.migration[key] ? "var(--lampOn)" : "var(--lampOff)",
            boxShadow: dev.migration[key] ? "0 0 10px var(--lampOn)" : "0 0 10px rgba(239,68,68,0.35)",
          }}
        />
      </button>
    </div>
  );

  return (
    <Modal title={`設備資訊：${dev.deviceId}`} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
          <div className="text-xs text-[var(--muted)]">基本資訊</div>
          <div className="mt-2 space-y-1 text-sm">
            <div><span className="text-[var(--muted)]">名稱：</span>{dev.name}</div>
            <div><span className="text-[var(--muted)]">類別：</span>{dev.category}</div>
            <div><span className="text-[var(--muted)]">廠牌/型號：</span>{dev.brand} / {dev.model}</div>
            <div><span className="text-[var(--muted)]">Ports：</span>{dev.ports}</div>
            <div><span className="text-[var(--muted)]">高度：</span>{dev.sizeU}U</div>
            <div><span className="text-[var(--muted)]">IP：</span>{dev.ip || "-"}</div>
            <div><span className="text-[var(--muted)]">序號：</span>{dev.serial || "-"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
          <div className="text-xs text-[var(--muted)]">位置</div>
          <div className="mt-2 space-y-1 text-sm">
            <div>
              <span className="text-[var(--muted)]">搬遷前：</span>
              {dev.beforeRackId && dev.beforeStartU ? `${dev.beforeRackId} ${dev.beforeStartU}-${dev.beforeEndU}U` : "-"}
            </div>
            <div>
              <span className="text-[var(--muted)]">搬遷後：</span>
              {dev.afterRackId && dev.afterStartU ? `${dev.afterRackId} ${dev.afterStartU}-${dev.afterEndU}U` : "-"}
            </div>
            <div className="pt-2">
              <div className="text-xs text-[var(--muted)] mb-2">
                搬遷狀態 {allowToggleMigration ? "（可切換）" : "（僅搬遷後頁可切換）"}
              </div>
              {statusRow("已上架", "racked")}
              {statusRow("已接線", "cabled")}
              {statusRow("已開機", "powered")}
              {statusRow("已測試", "tested")}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
          <div className="text-xs text-[var(--muted)]">Port 對接備註</div>
          <div className="mt-2 text-sm text-[var(--text)] whitespace-pre-wrap">
            {dev.portMap || "-"}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** -----------------------------
 * Dashboard
 * ---------------------------- */
const Dashboard = () => {
  const devices = useStore((s) => s.devices);
  const placedAfter = devices.filter((d) => d.afterRackId).length;
  const completed = devices.filter((d) => isMigratedComplete(d.migration)).length;

  const chartData = [
    { name: "Network", count: devices.filter((d) => d.category === "Network").length, fill: "var(--catNetwork)" },
    { name: "Storage", count: devices.filter((d) => d.category === "Storage").length, fill: "var(--catStorage)" },
    { name: "Server", count: devices.filter((d) => d.category === "Server").length, fill: "var(--catServer)" },
    { name: "Other", count: devices.filter((d) => d.category === "Other").length, fill: "var(--catOther)" },
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
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
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
            <li>1) 到「設備管理」新增/編輯設備，或用 CSV 匯入。</li>
            <li>2) 在「搬遷前/後」把設備拖到機櫃（含 U 重疊檢查）。</li>
            <li>3) 點設備看詳細；在「搬遷後」可即時切換 4 個狀態燈。</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/** -----------------------------
 * CSV Import Modal
 * ---------------------------- */
function CsvImportModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const importCSV = useStore((s) => s.importCSV);
  const downloadTemplate = useStore((s) => s.downloadTemplate);
  const [dragOver, setDragOver] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const res = importCSV(text);
      setMsg(`匯入完成：新增 ${res.added} 筆、更新 ${res.updated} 筆`);
    } catch (e: any) {
      setMsg(`匯入失敗：${String(e?.message ?? e)}`);
    }
  };

  return (
    <Modal
      title="CSV 匯入"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
          >
            <Download size={16} /> 下載範本
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90 flex items-center gap-2"
          >
            <FileUp size={16} /> 選擇檔案
          </button>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.currentTarget.value = "";
        }}
      />

      <div
        className={`rounded-2xl border border-dashed p-6 text-center transition-all ${
          dragOver ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] bg-[var(--panel2)]"
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        <div className="flex items-center justify-center gap-2 text-[var(--text)] font-black">
          <Upload size={18} /> 拖曳 CSV 到這裡上傳
        </div>
        <div className="mt-2 text-sm text-[var(--muted)]">
          以 <b>deviceId</b> 當唯一鍵：同 deviceId → 更新；沒有 → 新增。支援 before/after 位置與 4 狀態。
        </div>
        {msg ? <div className="mt-4 text-sm text-[var(--accent)] font-black">{msg}</div> : null}
      </div>

      <div className="mt-4 text-xs text-[var(--muted)] leading-relaxed">
        欄位：{CSV_HEADERS.join(", ")}
      </div>
    </Modal>
  );
}

/** -----------------------------
 * Devices Page
 * ---------------------------- */
const DevicesPage = () => {
  const devices = useStore((s) => s.devices);
  const addDevice = useStore((s) => s.addDevice);
  const updateDevice = useStore((s) => s.updateDevice);
  const deleteDevice = useStore((s) => s.deleteDevice);
  const clearPlacement = useStore((s) => s.clearPlacement);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const editing = devices.find((d) => d.id === editingId) || null;

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">設備管理</h2>
          <p className="text-[var(--muted)] text-sm">
            支援 CSV 匯入/匯出（含 before/after 位置與 4 狀態）。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadText(`devices_${new Date().toISOString().slice(0,10)}.csv`, toCSV(devices), "text/csv;charset=utf-8")}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
          >
            <Download size={16} /> 匯出 CSV
          </button>

          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
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
                        borderColor: `${catColorVar(d.category)}44`,
                        backgroundColor: `${catColorVar(d.category)}11`,
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
                    <div className="text-[var(--text)]">{d.brand}</div>
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
                        onClick={() => setEditingId(d.id)}
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
                        className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-white/5"
                        title="清除位置"
                      >
                        清除位置
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

      {showImport && <CsvImportModal onClose={() => setShowImport(false)} />}

      {isAdding && (
        <DeviceEditModal
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

      {editing && (
        <DeviceEditModal
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
          onClose={() => setEditingId(null)}
          onSave={(d) => {
            updateDevice(editing.id, d);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
};

/** -----------------------------
 * Rack Planner
 * - 拖拉設備到 rack 的 U
 * - 點設備開詳細（搬遷後可切換狀態即時更新）
 * ---------------------------- */
type HoverInfo = { x: number; y: number; device: Device; mode: PlacementMode };

const RackPlanner = ({ mode }: { mode: PlacementMode }) => {
  const racks = useStore((s) => s.racks);
  const devices = useStore((s) => s.devices);
  const place = useStore((s) => s.place);
  const clearPlacement = useStore((s) => s.clearPlacement);
  const setSelectedDeviceId = useStore((s) => (id: string | null) => set({ selectedDeviceId: id }) as any); // unused in this simplified version

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const rackById = useMemo(() => {
    const m = new Map<string, Rack>();
    racks.forEach((r) => m.set(r.id, r));
    return m;
  }, [racks]);

  const rows = useMemo(() => {
    const layout = mode === "before" ? BEFORE_LAYOUT : AFTER_LAYOUT;
    return layout.map((ids) => ids.map((id) => rackById.get(id)).filter(Boolean) as Rack[]);
  }, [mode, rackById]);

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

  const U_H = 22;

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

  {/* Legend (右上角) */}
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
</div>

      <div className="space-y-6">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
          >
            {row.map((rack) => (
              <div key={rack.id} className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
                <div
                  className="bg-black/30 text-center py-2 font-mono text-sm border-b border-[var(--border)]"
                  style={{
                    color: isNoMoveRack(rack.name) ? "#fb7185" : "var(--accent)",
                    fontWeight: 900,
                  }}
                >
                  {rack.name}
                </div>

                <div className="p-3">
                  <div className="flex gap-2">
                    {/* Left scale 1~42 */}
                    <div className="relative">
                      <div
                        className="absolute inset-0 blur-xl"
                        style={{
                          background: "radial-gradient(circle at top, var(--accent), transparent 60%)",
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
                    <div className="relative flex-1 border border-[var(--border)] bg-black/20" style={{ height: 42 * U_H }}>
                      {/* grid cells */}
                      <div className="absolute inset-0 flex flex-col-reverse">
                        {Array.from({ length: 42 }).map((_, i) => {
                          const u = i + 1;
                          return (
                            <div
                              key={u}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => onDrop(e, rack.id, u)}
                              className="relative"
                              style={{ height: U_H }}
                            >
                              <div
  className="absolute inset-x-0 top-0"
  style={{
    height: u % 5 === 0 ? 2 : 1,
    backgroundColor: u % 5 === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.15)",
  }}
/>
                              <div className="absolute inset-0 hover:bg-white/[0.03]" />
                            </div>
                          );
                        })}
                      </div>

                      {/* device blocks */}
                      {listForRack(rack.id).map((d) => {
                        const { bottom, height } = getBlockStyle(d);
                        const catColor = catColorVar(d.category);

                        return (
<div
  key={d.id}
  draggable
  ...
  className="absolute left-1 right-1 border border-black/30 text-black cursor-pointer select-none"
  style={{
    bottom,
    height,
    backgroundColor: `${catColor}`,
  }}
>
                            }}
                            title={`${d.brand} ${d.model}`}
                          >
                            <div className="h-full w-full px-2 py-1 relative">
                              <div className="pr-12">
                                <div className="text-[13px] font-black truncate">{d.deviceId}</div>
                                <div className="text-[12px] font-extrabold truncate opacity-95">{d.name}</div>
                              </div>

                              {/* 小燈靠右下，避免跟 X 擠在一起 */}
                              <div className="absolute bottom-1 right-2">
                                <RackLamps m={d.migration} />
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearPlacement(mode, d.id);
                                }}
                                className="absolute top-1 right-1 p-1 rounded-md hover:bg-black/20"
                                title="移除"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>


                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* hover info */}
      {hover && (
        <div
          className="fixed z-50 w-72 rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl p-4 text-sm"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="font-black text-[var(--accent)]">{hover.device.deviceId}</div>
          <div className="text-[var(--text)] mt-1">{hover.device.name}</div>
          <div className="text-[var(--muted)] mt-2">
            {hover.device.brand} / {hover.device.model} · {hover.device.sizeU}U · {hover.device.ports} Ports
          </div>
          <div className="mt-3">
            <div className="text-xs text-[var(--muted)] mb-1">狀態</div>
            <RackLamps m={hover.device.migration} />
          </div>
        </div>
      )}

      {detailId && (
        <DeviceDetailModal
          deviceId={detailId}
          onClose={() => setDetailId(null)}
          allowToggleMigration={mode === "after"}
        />
      )}
    </div>
  );
};

/** -----------------------------
 * App Shell
 * ---------------------------- */
export default function App() {
  useApplyTheme();
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const themeStyle = useStore((s) => s.themeStyle);
  const setThemeStyle = useStore((s) => s.setThemeStyle);

  const navItems = [
    { id: "dashboard", label: "儀表板", icon: <LayoutDashboard size={20} /> },
    { id: "devices", label: "設備管理", icon: <Server size={20} /> },
    { id: "before", label: "搬遷前", icon: <ArrowLeftRight size={20} /> },
    { id: "after", label: "搬遷後", icon: <ArrowRightLeft size={20} /> },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      <ThemeTokens />

      {/* Header */}
      <header className="h-16 border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-black"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              boxShadow: "0 0 16px rgba(34,211,238,0.25)",
            }}
          >
            <Server size={18} />
          </div>
          <h1 className="text-xl font-black tracking-tight uppercase italic">
            Migrate<span className="text-[var(--accent)]">Pro</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={themeStyle}
            onChange={(e) => setThemeStyle(e.target.value as ThemeStyle)}
            className="bg-[var(--panel2)] border border-[var(--border)] rounded-lg text-xs px-2 py-1 outline-none hidden sm:block"
          >
            <option value="neon">Neon Blue</option>
            <option value="graphite">Graphite</option>
            <option value="aurora">Aurora</option>
            <option value="circuit">Circuit</option>
          </select>

          <button onClick={toggleTheme} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            {theme === "dark" ? "🌙" : "☀️"}
          </button>

          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-500 to-gray-700 border border-white/20" />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 border-r border-[var(--border)] h-[calc(100vh-64px)] sticky top-16 p-4 hidden lg:block bg-[var(--panel)]">
          <div className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id as PageKey)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  page === item.id
                    ? "bg-[var(--panel2)] text-[var(--accent)] border border-[var(--border)] shadow-[0_0_20px_rgba(34,211,238,0.10)] font-black"
                    : "text-[var(--muted)] hover:bg-white/[0.03]"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel2)]">
            <div className="text-xs font-black text-[var(--muted)] uppercase mb-2">狀態說明</div>
            <div className="text-sm text-[var(--muted)] leading-relaxed">
              綠燈 = 完成；紅燈 = 未完成。搬遷完成需 4 顆全綠。
            </div>
          </div>
        </nav>

        {/* Content */}
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

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-2 flex gap-6 shadow-2xl z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id as PageKey)}
            className={`p-2 rounded-lg ${page === item.id ? "text-[var(--accent)] bg-[var(--panel2)]" : "text-[var(--muted)]"}`}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
