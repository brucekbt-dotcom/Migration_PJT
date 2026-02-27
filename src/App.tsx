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
  ChevronsLeft,
  ChevronsRight,
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
  AlertCircle,
  LogOut,
  User,
  Upload,
  Expand,
  Minimize,
  Shield,
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

/* -----------------------------
  Types
----------------------------- */

type ThemeMode = "dark" | "light";
type ThemeStyle = "neon" | "graphite" | "aurora" | "circuit";
type PageKey = "dashboard" | "devices" | "before" | "after" | "admin";
type DeviceCategory = "Network" | "Storage" | "Server" | "Other";
type PlacementMode = "before" | "after";
type Role = "admin" | "vendor";

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

type UiState = {
  sideCollapsed: boolean;
  // 未放置設備面板收合（兩頁共用）
  unplacedCollapsedBefore: boolean;
  unplacedCollapsedAfter: boolean;
};

type LoginResult = { ok: boolean; message?: string };

/* -----------------------------
  Auth
----------------------------- */

const AUTH_USERS = [
  { user: "admin", pass: "migration123", role: "admin" as Role },
  { user: "SETVendor", pass: "migration666", role: "vendor" as Role },
] as const;

const roleOf = (u: string | null): Role => {
  if (u === "admin") return "admin";
  return "vendor";
};

const canManageAssets = (role: Role) => role === "admin"; // 新增/刪除/匯入/編輯
const canExportCSV = (_role: Role) => true; // admin & vendor 都可
const canToggleFlags = (_role: Role) => true; // admin & vendor 都可

/* -----------------------------
  LocalStorage Keys
----------------------------- */

const LS = {
  theme: "migrate.theme",
  themeStyle: "migrate.themeStyle",
  devices: "migrate.devices",
  ui: "migrate.ui",
  auth: "migrate.auth",
  user: "migrate.user",
} as const;

/* -----------------------------
  Rack Layouts（依你最新定義）
----------------------------- */

const BEFORE_RACKS: Rack[] = [
  ...["B10", "B9", "B8", "B7", "B6"].map((n) => ({ id: `BEF_${n}`, name: n, units: 42 })),
  ...["A5", "A4", "A3", "A2", "A1"].map((n) => ({ id: `BEF_${n}`, name: n, units: 42 })),
  ...["2F-A", "2F-B", "3F-A", "3F-B", "4F-A", "4F-B"].map((n) => ({ id: `BEF_${n}`, name: n, units: 42 })),
  ...["9F", "SmartHouseA", "SmartHouseB"].map((n) => ({ id: `BEF_${n}`, name: n, units: 42 })),
];

const AFTER_RACKS: Rack[] = [
  ...["A1", "A2", "A3", "A4", "A5", "A6"].map((n) => ({ id: `AFT_${n}`, name: n, units: 42 })),
  ...["B1", "B2", "B3", "B4", "B5", "B6"].map((n) => ({ id: `AFT_${n}`, name: n, units: 42 })),
  ...["HUB 15L", "HUB 15R", "HUB 16L", "HUB 16R", "HUB 17L", "HUB 17R"].map((n) => ({ id: `AFT_${n}`, name: n, units: 42 })),
  ...["HUB 20F", "SmartHouse 20F", "不搬存放區A", "不搬存放區B", "不搬存放區C"].map((n) => ({ id: `AFT_${n}`, name: n, units: 42 })),
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
    ip: "10.0.0.1",
    serial: "",
    portMap: "",
    beforeRackId: "BEF_A1",
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
    serial: "",
    portMap: "",
    beforeRackId: "BEF_A1",
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
    serial: "",
    portMap: "",
    migration: { racked: false, cabled: false, powered: false, tested: false },
  },
];

/* -----------------------------
  Utils
----------------------------- */

const clampU = (u: number) => Math.max(1, Math.min(42, u));
const rangesOverlap = (aS: number, aE: number, bS: number, bE: number) =>
  Math.max(aS, bS) <= Math.min(aE, bE);

const isMigratedComplete = (m: MigrationFlags) =>
  m.racked && m.cabled && m.powered && m.tested;

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

const isProbablyOldRackId = (v: string) => {
  // 舊資料可能是 "A1" / "B6" / "HUB 15A" / "SmartHouse 20F" / "9F" 等
  // 新資料我們要 BEF_/AFT_ 前綴
  if (!v) return false;
  return !v.startsWith("BEF_") && !v.startsWith("AFT_");
};

const toBeforeRackId = (nameOrId: string) => {
  const s = String(nameOrId || "").trim();
  if (!s) return undefined;
  if (s.startsWith("BEF_")) return s;
  if (s.startsWith("AFT_")) return `BEF_${s.slice(4)}`;
  return `BEF_${s}`;
};

const toAfterRackId = (nameOrId: string) => {
  const s = String(nameOrId || "").trim();
  if (!s) return undefined;
  if (s.startsWith("AFT_")) return s;
  if (s.startsWith("BEF_")) return `AFT_${s.slice(4)}`;
  return `AFT_${s}`;
};

const normalizeDevices = (raw: any[]): Device[] => {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((d: any) => {
    const sizeU = Math.max(1, Math.min(42, Number(d?.sizeU ?? 1)));
    const mig = d?.migration ?? {};

    let beforeRackId: string | undefined = d?.beforeRackId ?? undefined;
    let afterRackId: string | undefined = d?.afterRackId ?? undefined;

    // ✅ 修復舊資料：A1/B1 這種沒有前綴的 rackId
    if (beforeRackId && isProbablyOldRackId(beforeRackId)) beforeRackId = toBeforeRackId(beforeRackId);
    if (afterRackId && isProbablyOldRackId(afterRackId)) afterRackId = toAfterRackId(afterRackId);

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

      beforeRackId,
      beforeStartU: d?.beforeStartU ?? undefined,
      beforeEndU: d?.beforeEndU ?? undefined,

      afterRackId,
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

/* -----------------------------
  Category Colors（避開紅綠，跟燈號不打架）
----------------------------- */

const catColorVar = (cat: DeviceCategory) => {
  switch (cat) {
    case "Network":
      return "var(--catNetwork)"; // teal
    case "Storage":
      return "var(--catStorage)"; // cyan
    case "Server":
      return "var(--catServer)"; // indigo
    default:
      return "var(--catOther)"; // amber/brown
  }
};

/* -----------------------------
  Theme Tokens
----------------------------- */

const ThemeTokens = () => {
  const style = useStore((s) => s.themeStyle);

  const presets: Record<ThemeStyle, { light: string; dark: string }> = {
    neon: {
      light:
        ":root{--bg:#f7fafc;--panel:#ffffff;--panel2:#f1f5f9;--text:#0b1220;--muted:#475569;--border:#e2e8f0;--accent:#06b6d4;--accent2:#a855f7;--onColor:#f8fafc;--catNetwork:#0f766e;--catStorage:#0891b2;--catServer:#4338ca;--catOther:#b45309;--lampOn:#22c55e;--lampOff:#ef4444}",
      dark:
        "html.dark{--bg:#05070d;--panel:#0b1220;--panel2:#1a2235;--text:#e5e7eb;--muted:#94a3b8;--border:#1e293b;--accent:#22d3ee;--accent2:#c084fc;--onColor:#f8fafc;--catNetwork:#2dd4bf;--catStorage:#22d3ee;--catServer:#818cf8;--catOther:#f59e0b;--lampOn:#22c55e;--lampOff:#ef4444}",
    },
    graphite: {
      light:
        ":root{--bg:#f6f7fb;--panel:#ffffff;--panel2:#eef2f7;--text:#0a0e16;--muted:#6b7280;--border:#e5e7eb;--accent:#3b82f6;--accent2:#111827;--onColor:#f8fafc;--catNetwork:#0f766e;--catStorage:#0284c7;--catServer:#1d4ed8;--catOther:#a16207;--lampOn:#22c55e;--lampOff:#ef4444}",
      dark:
        "html.dark{--bg:#070a0f;--panel:#0b0f18;--panel2:#0a0e16;--text:#f3f4f6;--muted:#9ca3af;--border:#1f2937;--accent:#38bdf8;--accent2:#94a3b8;--onColor:#f8fafc;--catNetwork:#2dd4bf;--catStorage:#38bdf8;--catServer:#60a5fa;--catOther:#fbbf24;--lampOn:#22c55e;--lampOff:#ef4444}",
    },
    aurora: {
      light:
        ":root{--bg:#f7fbff;--panel:#ffffff;--panel2:#eef6ff;--text:#081120;--muted:#64748b;--border:#e2e8f0;--accent:#14b8a6;--accent2:#6366f1;--onColor:#f8fafc;--catNetwork:#0f766e;--catStorage:#0369a1;--catServer:#4f46e5;--catOther:#a16207;--lampOn:#22c55e;--lampOff:#ef4444}",
      dark:
        "html.dark{--bg:#050913;--panel:#0b1220;--panel2:#081225;--text:#f1f5f9;--muted:#94a3b8;--border:#334155;--accent:#2dd4bf;--accent2:#a5b4fc;--onColor:#f8fafc;--catNetwork:#34d399;--catStorage:#67e8f9;--catServer:#818cf8;--catOther:#fbbf24;--lampOn:#22c55e;--lampOff:#ef4444}",
    },
    circuit: {
      light:
        ":root{--bg:#f7f9ff;--panel:#ffffff;--panel2:#edf0ff;--text:#0b1020;--muted:#6b7280;--border:#e2e8f0;--accent:#7c3aed;--accent2:#06b6d4;--onColor:#f8fafc;--catNetwork:#0f766e;--catStorage:#0284c7;--catServer:#4338ca;--catOther:#a16207;--lampOn:#22c55e;--lampOff:#ef4444}",
      dark:
        "html.dark{--bg:#060714;--panel:#0b0b1a;--panel2:#0b1220;--text:#f8fafc;--muted:#a1a1aa;--border:#27272a;--accent:#a78bfa;--accent2:#22d3ee;--onColor:#f8fafc;--catNetwork:#2dd4bf;--catStorage:#7dd3fc;--catServer:#c4b5fd;--catOther:#fde047;--lampOn:#22c55e;--lampOff:#ef4444}",
    },
  };

  const css = presets[style] || presets.neon;
  return <style>{`${css.light}\n${css.dark}`}</style>;
};

function useApplyTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
}

/* -----------------------------
  Lamps
----------------------------- */

const Lamp = ({ on }: { on: boolean }) => (
  <span
    className="inline-block w-2.5 h-2.5 rounded-full"
    style={{
      backgroundColor: on ? "var(--lampOn)" : "var(--lampOff)",
      boxShadow: on ? "0 0 10px var(--lampOn)" : "0 0 10px rgba(239,68,68,0.35)",
    }}
  />
);

const LampsRow = ({ m }: { m: MigrationFlags }) => (
  <div className="flex items-center gap-2">
    <Lamp on={m.racked} />
    <Lamp on={m.cabled} />
    <Lamp on={m.powered} />
    <Lamp on={m.tested} />
  </div>
);

/* -----------------------------
  CSV Export / Import
----------------------------- */

function downloadCSV(devices: Device[]) {
  const headers = [
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
  ];

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
  ]);

  const csv = `${headers.join(",")}\n${rows.map((r) => r.map(esc).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devices_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSVTemplate() {
  const template = [
    "category,deviceId,name,brand,model,ports,sizeU,ip,serial,portMap",
    "Network,SW-01,核心交換機,Cisco,C9300,48,1,10.0.0.2,SN001,Gi1/0/1->FW",
  ].join("\n");
  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devices_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string) {
  const rows: string[][] = [];
  let cur = "";
  let inQ = false;
  const row: string[] = [];

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    rows.push([...row]);
    row.length = 0;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && ch === ",") {
      pushCell();
      continue;
    }
    if (!inQ && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      pushCell();
      pushRow();
      continue;
    }
    cur += ch;
  }

  pushCell();
  if (row.some((x) => x.trim().length > 0)) pushRow();

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/* -----------------------------
  Store
----------------------------- */

interface Store {
  beforeRacks: Rack[];
  afterRacks: Rack[];
  devices: Device[];
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  page: PageKey;
  selectedDeviceId: string | null;
  ui: UiState;

  // auth
  isAuthed: boolean;
  userName: string | null;
  role: Role;
  login: (u: string, p: string) => LoginResult;
  logout: () => void;

  // actions
  setPage: (p: PageKey) => void;
  toggleTheme: () => void;
  setThemeStyle: (s: ThemeStyle) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setUi: (patch: Partial<UiState>) => void;

  addDevice: (draft: DeviceDraft) => void;
  updateDevice: (id: string, patch: Partial<DeviceDraft>) => void;
  deleteDevice: (id: string) => void;

  importDevices: (drafts: DeviceDraft[]) => void;

  clearPlacement: (mode: PlacementMode, id: string) => void;
  place: (mode: PlacementMode, deviceId: string, rackId: string, startU: number) => { ok: boolean; message?: string };

  setMigrationFlag: (id: string, patch: Partial<MigrationFlags>) => void;

  // maintenance
  repairRackIds: () => void;
}

const DEFAULT_UI: UiState = {
  sideCollapsed: false,
  unplacedCollapsedBefore: false,
  unplacedCollapsedAfter: false,
};

const useStore = create<Store>((set, get) => ({
  beforeRacks: BEFORE_RACKS,
  afterRacks: AFTER_RACKS,
  devices: normalizeDevices(readJson<Device[]>(LS.devices, mockDevices)),

  theme: (localStorage.getItem(LS.theme) as ThemeMode) || "dark",
  themeStyle: (localStorage.getItem(LS.themeStyle) as ThemeStyle) || "neon",
  page: "dashboard",
  selectedDeviceId: null,
  ui: { ...DEFAULT_UI, ...readJson<UiState>(LS.ui, DEFAULT_UI) },

  isAuthed: localStorage.getItem(LS.auth) === "1",
  userName: localStorage.getItem(LS.user) || null,
  role: roleOf(localStorage.getItem(LS.user) || null),

  login: (u, p) => {
    const found = AUTH_USERS.find((a) => a.user === u && a.pass === p);
    if (!found) return { ok: false, message: "帳號或密碼錯誤" };
    localStorage.setItem(LS.auth, "1");
    localStorage.setItem(LS.user, u);
    set({ isAuthed: true, userName: u, role: found.role, page: "dashboard", selectedDeviceId: null });
    return { ok: true };
  },

  logout: () => {
    localStorage.removeItem(LS.auth);
    localStorage.removeItem(LS.user);
    set({ isAuthed: false, userName: null, role: "vendor", page: "dashboard", selectedDeviceId: null });
  },

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

  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),

  setUi: (patch) =>
    set((s) => {
      const next = { ...s.ui, ...patch };
      writeJson(LS.ui, next);
      return { ui: next };
    }),

  addDevice: (draft) =>
    set((s) => {
      const next: Device[] = [
        ...s.devices,
        { ...draft, id: crypto.randomUUID(), migration: { racked: false, cabled: false, powered: false, tested: false } } as Device,
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

  importDevices: (drafts) =>
    set((s) => {
      const next = [
        ...s.devices,
        ...drafts.map((d) => ({
          ...d,
          id: crypto.randomUUID(),
          migration: { racked: false, cabled: false, powered: false, tested: false },
        })),
      ] as Device[];
      writeJson(LS.devices, next);
      return { devices: next };
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
      const next = s.devices.map((d) => (d.id === id ? { ...d, migration: { ...d.migration, ...patch } } : d));
      writeJson(LS.devices, next);
      return { devices: next };
    }),

  repairRackIds: () =>
    set((s) => {
      const repaired = s.devices.map((d) => {
        let beforeRackId = d.beforeRackId;
        let afterRackId = d.afterRackId;

        if (beforeRackId && isProbablyOldRackId(beforeRackId)) beforeRackId = toBeforeRackId(beforeRackId);
        if (afterRackId && isProbablyOldRackId(afterRackId)) afterRackId = toAfterRackId(afterRackId);

        return { ...d, beforeRackId, afterRackId };
      });
      writeJson(LS.devices, repaired);
      return { devices: repaired };
    }),
}));

/* -----------------------------
  Login Page（提示帳密明顯顯示）
----------------------------- */

function LoginPage() {
  const login = useStore((s) => s.login);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <ThemeTokens />
      <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--border)] rounded-3xl shadow-2xl p-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-black"
            style={{
              background: "linear-gradient(135deg,var(--accent),var(--accent2))",
              boxShadow: "0 0 18px rgba(34,211,238,0.25)",
            }}
          >
            <Server size={18} />
          </div>
          <div>
            <div className="text-lg font-black">MigratePro</div>
            <div className="text-xs text-[var(--muted)]">機房搬遷專案管理</div>
          </div>
        </div>

        {/* ✅ 明顯的帳密提示 */}
        <div className="mt-5 p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel2)]">
          <div className="text-sm font-black mb-2">可用帳號 / 密碼</div>
          <div className="text-sm text-[var(--muted)] leading-6">
            <div><span className="font-bold text-[var(--text)]">admin</span> / <span className="font-bold text-[var(--text)]">migration123</span>（管理員）</div>
            <div><span className="font-bold text-[var(--text)]">SETVendor</span> / <span className="font-bold text-[var(--text)]">migration666</span>（只能查看/切換燈號）</div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs text-[var(--muted)]">帳號</label>
            <input
              className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              value={u}
              onChange={(e) => setU(e.target.value)}
              placeholder="admin 或 SETVendor"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)]">密碼</label>
            <input
              type="password"
              className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              value={p}
              onChange={(e) => setP(e.target.value)}
              placeholder="請輸入密碼"
              autoComplete="current-password"
            />
          </div>

          {err && <div className="text-sm text-red-400">{err}</div>}

          <button
            onClick={() => {
              setErr(null);
              const res = login(u.trim(), p);
              if (!res.ok) setErr(res.message || "登入失敗");
            }}
            className="w-full mt-2 bg-[var(--accent)] text-black font-extrabold py-3 rounded-xl hover:opacity-90"
          >
            登入
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
  Simple Switch
----------------------------- */

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full border transition-all ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${on ? "bg-[var(--lampOn)]/20 border-[var(--lampOn)]" : "bg-black/20 border-[var(--border)]"}`}
      style={{ boxShadow: on ? "0 0 16px rgba(34,197,94,0.25)" : "none" }}
    >
      <span
        className="block w-5 h-5 rounded-full bg-white transition-all"
        style={{ transform: `translateX(${on ? "20px" : "2px"})` }}
      />
    </button>
  );
}

/* -----------------------------
  Device Detail Modal（搬遷後可切換狀態：即時更新）
----------------------------- */

function DeviceDetailModal({ id, mode, onClose }: { id: string; mode: PlacementMode; onClose: () => void }) {
  const d = useStore((s) => s.devices.find((x) => x.id === id));
  const setFlag = useStore((s) => s.setMigrationFlag);
  const clearPlacement = useStore((s) => s.clearPlacement);
  const role = useStore((s) => s.role);

  if (!d) return null;

  const beforePos =
    d.beforeRackId && d.beforeStartU != null && d.beforeEndU != null
      ? `${d.beforeRackId.replace(/^BEF_/, "")} ${d.beforeStartU}-${d.beforeEndU}U`
      : "-";
  const afterPos =
    d.afterRackId && d.afterStartU != null && d.afterEndU != null
      ? `${d.afterRackId.replace(/^AFT_/, "")} ${d.afterStartU}-${d.afterEndU}U`
      : "-";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-[var(--muted)]">設備詳細</div>
              <div className="text-lg font-black">
                {d.deviceId} · {d.name}
              </div>
              <div className="text-sm text-[var(--muted)]">
                {d.brand} / {d.model} · {d.ports} ports · {d.sizeU}U
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
              <X />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--panel2)]">
              <div className="text-xs text-[var(--muted)]">搬遷前位置</div>
              <div className="font-bold mt-1">{beforePos}</div>
            </div>
            <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--panel2)]">
              <div className="text-xs text-[var(--muted)]">搬遷後位置</div>
              <div className="font-bold mt-1">{afterPos}</div>
            </div>

            <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--panel2)] md:col-span-2">
              <div className="text-xs text-[var(--muted)]">IP / 序號</div>
              <div className="mt-1 font-bold">
                {d.ip || "-"} / {d.serial || "-"}
              </div>
              <div className="text-xs text-[var(--muted)] mt-2">Port對接備註</div>
              <div className="mt-1">{d.portMap || "-"}</div>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel2)]">
            <div className="flex items-center justify-between">
              <div className="font-black">搬遷狀態</div>
              <LampsRow m={d.migration} />
            </div>

            {mode === "after" ? (
              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">已上架</div>
                  <Switch
                    on={d.migration.racked}
                    onChange={(v) => canToggleFlags(role) && setFlag(d.id, { racked: v })}
                    disabled={!canToggleFlags(role)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">已接線</div>
                  <Switch
                    on={d.migration.cabled}
                    onChange={(v) => canToggleFlags(role) && setFlag(d.id, { cabled: v })}
                    disabled={!canToggleFlags(role)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">已開機</div>
                  <Switch
                    on={d.migration.powered}
                    onChange={(v) => canToggleFlags(role) && setFlag(d.id, { powered: v })}
                    disabled={!canToggleFlags(role)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">已測試</div>
                  <Switch
                    on={d.migration.tested}
                    onChange={(v) => canToggleFlags(role) && setFlag(d.id, { tested: v })}
                    disabled={!canToggleFlags(role)}
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--muted)] mt-3">※ 僅在「搬遷後」頁面可切換狀態。</div>
            )}
          </div>

          <div className="mt-4 flex justify-between">
            <button
              onClick={() => {
                if (confirm("確定清除此設備在本頁面的位置？")) clearPlacement(mode, d.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5"
            >
              清除本頁位置
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90">
              關閉
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -----------------------------
  Dashboard
----------------------------- */

const Dashboard = () => {
  const devices = useStore((s) => s.devices);

  const racked = devices.filter((d) => d.migration.racked).length; // 已上架
  const completed = devices.filter((d) => isMigratedComplete(d.migration)).length;
  const pending = Math.max(0, devices.length - completed);

  const chartData = [
    { name: "Network", count: devices.filter((d) => d.category === "Network").length, fill: "var(--catNetwork)" },
    { name: "Storage", count: devices.filter((d) => d.category === "Storage").length, fill: "var(--catStorage)" },
    { name: "Server", count: devices.filter((d) => d.category === "Server").length, fill: "var(--catServer)" },
    { name: "Other", count: devices.filter((d) => d.category === "Other").length, fill: "var(--catOther)" },
  ];

  const stats = [
    { label: "總設備數", value: devices.length, icon: <Server size={20} />, tone: "accent" as const },
    { label: "已上架", value: racked, icon: <ArrowRightLeft size={20} />, tone: "accent" as const },
    { label: "搬遷完成", value: completed, icon: <CheckCircle2 size={20} />, tone: "green" as const },
    { label: "待處理", value: pending, icon: <AlertCircle size={20} />, tone: "red" as const },
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
            <div
              className="text-3xl font-black"
              style={{
                color: s.tone === "green" ? "var(--lampOn)" : s.tone === "red" ? "var(--lampOff)" : "var(--accent)",
              }}
            >
              {s.value}
            </div>
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
            <li>1) 到「設備管理」管理設備。</li>
            <li>2) 在「搬遷前/後」把設備拖到機櫃；已放置設備也可拖曳調整位置（含 U 重疊檢查）。</li>
            <li>3) 點機櫃內設備可看詳細；在「搬遷後」可即時切換 4 個狀態燈。</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------
  CSV Import Modal（Admin only）
----------------------------- */

function CSVImportModal({ onClose }: { onClose: () => void }) {
  const importDevices = useStore((s) => s.importDevices);
  const [drag, setDrag] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return alert("CSV 內容不足，至少需要標題列 + 一筆資料");

    const header = rows[0].map((x) => x.trim());
    const idx = (k: string) => header.findIndex((h) => h === k);

    const required = ["category", "deviceId", "name", "brand", "model", "ports", "sizeU"];
    for (const k of required) if (idx(k) === -1) return alert(`CSV 缺少欄位：${k}`);

    const drafts: DeviceDraft[] = rows.slice(1).map((r) => {
      const get = (k: string) => (idx(k) >= 0 ? String(r[idx(k)] ?? "").trim() : "");
      const category = (get("category") as DeviceCategory) || "Other";
      const ports = Number(get("ports") || 0);
      const sizeU = Math.max(1, Math.min(42, Number(get("sizeU") || 1)));
      return {
        category: ["Network", "Storage", "Server", "Other"].includes(category) ? category : "Other",
        deviceId: get("deviceId"),
        name: get("name"),
        brand: get("brand"),
        model: get("model"),
        ports,
        sizeU,
        ip: get("ip") || "",
        serial: get("serial") || "",
        portMap: get("portMap") || "",
      };
    });

    importDevices(drafts);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="text-xl font-black">CSV 匯入設備</div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
              <X />
            </button>
          </div>

          <div className="mt-3 text-sm text-[var(--muted)]">
            拖曳 CSV 到下方區域，或點擊選取檔案。也可先下載範本。
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={downloadCSVTemplate}
              className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
            >
              <Download size={16} /> 下載範本
            </button>
          </div>

          <label
            onDragEnter={() => setDrag(true)}
            onDragLeave={() => setDrag(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={`mt-4 block w-full rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
              drag ? "border-[var(--accent)] bg-white/5" : "border-[var(--border)] bg-black/10"
            }`}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,var(--accent),var(--accent2))" }}
              >
                <Upload className="text-black" />
              </div>
              <div className="font-black">拖曳 CSV 到這裡上傳</div>
              <div className="text-xs text-[var(--muted)]">或點擊選取檔案</div>
            </div>
          </label>
        </div>
      </motion.div>
    </div>
  );
}

/* -----------------------------
  Device Modal（Admin only）
----------------------------- */

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
  const input = (k: keyof DeviceDraft) => (e: any) => setD((p) => ({ ...p, [k]: e.target.value } as any));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
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
              <select className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none" value={d.category} onChange={input("category") as any}>
                {(["Network", "Storage", "Server", "Other"] as DeviceCategory[]).map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">設備編號</label>
              <input className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" value={d.deviceId} onChange={input("deviceId")} placeholder="EX: SW-01" />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">設備名稱</label>
              <input className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" value={d.name} onChange={input("name")} />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">廠牌</label>
              <input className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none" value={d.brand} onChange={input("brand")} />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">型號</label>
              <input className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none" value={d.model} onChange={input("model")} />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">Port數量</label>
              <select className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none" value={String(d.ports)} onChange={(e) => setD((p) => ({ ...p, ports: Number(e.target.value) }))}>
                {portsOptions.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">占用高度(U)</label>
              <input type="number" min={1} max={42} className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none" value={d.sizeU} onChange={(e) => setD((p) => ({ ...p, sizeU: Number(e.target.value) || 1 }))} />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">設備IP</label>
              <input className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none" value={d.ip ?? ""} onChange={input("ip")} placeholder="10.0.0.10" />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">序號</label>
              <input className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none" value={d.serial ?? ""} onChange={input("serial")} />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-[var(--muted)]">Port對接備註</label>
              <input className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none" value={d.portMap ?? ""} onChange={input("portMap")} placeholder="EX: Gi1/0/1 -> Firewall WAN" />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5">取消</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90">儲存</button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

/* -----------------------------
  Devices Page（權限控制）
----------------------------- */

const DevicesPage = () => {
  const devices = useStore((s) => s.devices);
  const addDevice = useStore((s) => s.addDevice);
  const updateDevice = useStore((s) => s.updateDevice);
  const deleteDevice = useStore((s) => s.deleteDevice);
  const clearPlacement = useStore((s) => s.clearPlacement);
  const setSelectedDeviceId = useStore((s) => s.setSelectedDeviceId);
  const role = useStore((s) => s.role);

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const allowManage = canManageAssets(role);

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">設備資產清單</h2>
          <p className="text-[var(--muted)] text-sm">
            {allowManage ? "新增/編輯/刪除設備；刪除會同步移除搬遷前與搬遷後機櫃配置。" : "你目前為 SETVendor 權限：可查看、可匯出 CSV、可切換搬遷後燈號。"}
          </p>
        </div>

        <div className="flex gap-2">
          {allowManage && (
            <button onClick={() => setImportOpen(true)} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2">
              <Upload size={16} /> CSV 匯入
            </button>
          )}

          <button onClick={() => canExportCSV(role) && downloadCSV(devices)} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2">
            <Download size={16} /> CSV 匯出
          </button>

          {allowManage && (
            <button onClick={() => setIsAdding(true)} className="bg-[var(--accent)] text-black px-4 py-2 rounded-xl font-extrabold flex items-center gap-2 hover:opacity-90">
              <Plus size={18} /> 新增設備
            </button>
          )}
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
                  ? `${d.beforeRackId.replace(/^BEF_/, "")} ${d.beforeStartU}-${d.beforeEndU}U`
                  : "-";
              const after =
                d.afterRackId && d.afterStartU != null
                  ? `${d.afterRackId.replace(/^AFT_/, "")} ${d.afterStartU}-${d.afterEndU}U`
                  : "-";

              return (
                <tr key={d.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <span
                      className="text-[10px] font-extrabold px-2 py-1 rounded-md border"
                      style={{ color: "var(--onColor)", borderColor: "rgba(255,255,255,0.35)", backgroundColor: catColorVar(d.category) }}
                    >
                      {d.category}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="font-black text-sm">{d.deviceId}</div>
                    <button onClick={() => setSelectedDeviceId(d.id)} className="text-xs text-[var(--muted)] hover:text-[var(--accent)]">
                      {d.name}
                    </button>
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
                    <LampsRow m={d.migration} />
                  </td>

                  <td className="px-6 py-4 text-right">
                    {canManageAssets(role) ? (
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditing(d)} className="p-2 hover:bg-white/10 rounded-lg text-[var(--accent)]" title="編輯">
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
                    ) : (
                      <div className="text-xs text-[var(--muted)]">只讀</div>
                    )}
                  </td>
                </tr>
              );
            })}

            {devices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-[var(--muted)]">
                  目前沒有設備
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {importOpen && <CSVImportModal onClose={() => setImportOpen(false)} />}

      {isAdding && (
        <DeviceModal
          title="新增設備"
          initial={{ category: "Other", deviceId: "", name: "", brand: "", model: "", ports: 8, sizeU: 1, ip: "", serial: "", portMap: "" }}
          onClose={() => setIsAdding(false)}
          onSave={(d) => {
            addDevice(d);
            setIsAdding(false);
          }}
        />
      )}

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
    </div>
  );
};

/* -----------------------------
  Rack Legend
----------------------------- */

const RackLegend = () => (
  <div className="flex items-center gap-3 text-xs">
    {(["Network", "Server", "Storage", "Other"] as DeviceCategory[]).map((c) => (
      <div key={c} className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm border border-white/30" style={{ background: catColorVar(c) }} />
        <span className="text-[var(--muted)]">{c}</span>
      </div>
    ))}
  </div>
);

const isNoMoveRack = (name: string) => name.startsWith("不搬存放區");

/* -----------------------------
  Rack Planner（修正：未放置清單可見 + 拖拉可用 + 變0自動收合）
----------------------------- */

const RackPlanner = ({ mode }: { mode: PlacementMode }) => {
  const racks = useStore((s) => (mode === "before" ? s.beforeRacks : s.afterRacks));
  const devices = useStore((s) => s.devices);
  const place = useStore((s) => s.place);
  const clearPlacement = useStore((s) => s.clearPlacement);
  const setSelectedDeviceId = useStore((s) => s.setSelectedDeviceId);
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  const repairRackIds = useStore((s) => s.repairRackIds);

  // ✅ 每次進來先修一次舊資料（很輕量）
  useEffect(() => {
    repairRackIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const rackIdSet = useMemo(() => new Set(racks.map((r) => r.id)), [racks]);

  const isPlaced = (d: Device) => {
    const rid = mode === "before" ? d.beforeRackId : d.afterRackId;
    const s = mode === "before" ? d.beforeStartU : d.afterStartU;
    const e = mode === "before" ? d.beforeEndU : d.afterEndU;
    // ✅ 必須：rackId 存在於目前頁的 racks 且位置完整
    return !!rid && rackIdSet.has(rid) && s != null && e != null;
  };

  const unplaced = useMemo(() => devices.filter((d) => !isPlaced(d)), [devices, rackIdSet, mode]);

  // ✅ 變成 0 => 自動收合
  useEffect(() => {
    if (unplaced.length === 0) {
      if (mode === "before" && !ui.unplacedCollapsedBefore) setUi({ unplacedCollapsedBefore: true });
      if (mode === "after" && !ui.unplacedCollapsedAfter) setUi({ unplacedCollapsedAfter: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unplaced.length, mode]);

  const collapsed = mode === "before" ? ui.unplacedCollapsedBefore : ui.unplacedCollapsedAfter;
  const setCollapsed = (v: boolean) =>
    setUi(mode === "before" ? { unplacedCollapsedBefore: v } : { unplacedCollapsedAfter: v });

  // rows: 每排最多6
  const rows = useMemo(() => {
    const out: Rack[][] = [];
    let cur: Rack[] = [];
    racks.forEach((r) => {
      cur.push(r);
      if (cur.length === 6) {
        out.push(cur);
        cur = [];
      }
    });
    if (cur.length) out.push(cur);
    return out;
  }, [racks]);

  const listForRack = (rackId: string) =>
    devices
      .filter((d) => {
        const rid = mode === "before" ? d.beforeRackId : d.afterRackId;
        return rid === rackId;
      })
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
    return { bottom, height };
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">
            {mode === "before" ? "搬遷前" : "搬遷後"} 機櫃佈局
          </h2>
          <p className="text-[var(--muted)] text-sm">
            拖拉設備到機櫃；已放置設備也可再拖拉調整位置（含 U 重疊檢查）
          </p>
        </div>

        <div className="flex items-center gap-3">
          <RackLegend />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2 text-sm"
            title="收合/展開未放置清單"
          >
            {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            未放置({unplaced.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        {/* Left racks */}
        <div className="space-y-6">
          {rows.map((row, idx) => (
            <div key={idx} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
              {row.map((rack) => (
                <div key={rack.id} className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
                  <div
                    className="bg-black/30 text-center py-2 font-mono text-sm border-b border-[var(--border)]"
                    style={{ color: mode === "after" && isNoMoveRack(rack.name) ? "var(--lampOff)" : "var(--accent)" }}
                  >
                    {rack.name}
                  </div>

                  <div className="p-3">
                    <div className="flex gap-2">
                      {/* scale */}
                      <div className="relative">
                        <div className="relative flex flex-col-reverse">
                          {Array.from({ length: 42 }).map((_, i) => {
                            const u = i + 1;
                            return (
                              <div key={u} className="w-8 pr-1 text-right text-[10px] leading-none text-[var(--muted)]" style={{ height: U_H }}>
                                {u}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* rack grid */}
                      <div className="relative flex-1 border border-[var(--border)] bg-black/20" style={{ height: 42 * U_H }}>
                        <div className="absolute inset-0 flex flex-col-reverse">
                          {Array.from({ length: 42 }).map((_, i) => {
                            const u = i + 1;
                            const thick = u % 5 === 0;
                            return (
                              <div key={u} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, rack.id, u)} className="relative" style={{ height: U_H }}>
                                <div className="absolute inset-x-0 top-0" style={{ height: thick ? 2 : 1, background: thick ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)" }} />
                                <div className="absolute inset-0 hover:bg-white/[0.03]" />
                              </div>
                            );
                          })}
                        </div>

                        {/* devices */}
                        {listForRack(rack.id).map((d) => {
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
                              onClick={() => setSelectedDeviceId(d.id)}
                              className="absolute left-1 right-1 border border-white/70 cursor-pointer select-none"
                              style={{ bottom, height, backgroundColor: catColor }}
                            >
                              <div className="h-full w-full px-2 py-1">
                                {/* Clear */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearPlacement(mode, d.id);
                                  }}
                                  className="absolute top-1 right-1 p-1 rounded-lg hover:bg-white/20"
                                  title="清除位置"
                                >
                                  <X size={14} className="text-white" />
                                </button>

                                {/* Text */}
                                <div className="pr-8">
                                  <div className="text-[13px] font-black truncate" style={{ color: "var(--onColor)" }}>
                                    {d.deviceId}
                                  </div>
                                  <div className="text-[12px] font-bold truncate" style={{ color: "var(--onColor)", opacity: 0.95 }}>
                                    {d.name}
                                  </div>
                                </div>

                                {/* Lamps right-bottom */}
                                <div className="absolute right-2 bottom-2">
                                  <LampsRow m={d.migration} />
                                </div>
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

        {/* Right panel: unplaced list */}
        <div className="relative">
          {collapsed ? (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-black">未放置設備</div>
                  <div className="text-xs text-[var(--muted)]">目前：{unplaced.length} 台</div>
                </div>
                <button onClick={() => setCollapsed(false)} className="px-3 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2 text-sm">
                  <PanelRightOpen size={16} /> 展開
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <div className="text-sm font-black">未放置設備</div>
                  <div className="text-xs text-[var(--muted)]">拖曳到左側機櫃（{unplaced.length} 台）</div>
                </div>
                <button onClick={() => setCollapsed(true)} className="p-2 rounded-xl hover:bg-white/5" title="收合">
                  <PanelRightClose />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-[calc(100vh-220px)] overflow-auto">
                {unplaced.length === 0 ? (
                  <div className="text-sm text-[var(--muted)]">✅ 全部設備都已放置（已自動收合）</div>
                ) : (
                  unplaced.map((d) => (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={(ev) => {
                        ev.dataTransfer.setData("text/plain", d.id);
                        ev.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => setSelectedDeviceId(d.id)}
                      className="p-3 rounded-2xl border border-[var(--border)] hover:bg-white/[0.03] cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-[var(--text)] truncate">{d.deviceId}</div>
                          <div className="text-xs text-[var(--muted)] truncate">{d.name}</div>
                          <div className="text-xs text-[var(--muted)] mt-1 truncate">{d.brand} · {d.model} · {d.sizeU}U</div>
                        </div>
                        <span className="text-[10px] font-extrabold px-2 py-1 rounded-md border" style={{ color: "var(--onColor)", borderColor: "rgba(255,255,255,0.35)", backgroundColor: catColorVar(d.category) }}>
                          {d.category}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* -----------------------------
  Admin Page（簡易管理後台）
----------------------------- */

const AdminPage = () => {
  const user = useStore((s) => s.userName);
  const role = useStore((s) => s.role);
  const repairRackIds = useStore((s) => s.repairRackIds);

  if (role !== "admin") {
    return (
      <div className="p-6">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-6">
          <div className="text-lg font-black text-[var(--accent)]">權限不足</div>
          <div className="text-sm text-[var(--muted)] mt-2">此頁僅提供 Admin 使用。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <Shield className="text-[var(--accent)]" />
          <div className="text-lg font-black">Admin 管理後台</div>
        </div>
        <div className="text-sm text-[var(--muted)] mt-2">登入者：<span className="text-[var(--text)] font-bold">{user}</span></div>

        <div className="mt-4 p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel2)]">
          <div className="font-black mb-2">帳號與權限</div>
          <ul className="text-sm text-[var(--muted)] space-y-1">
            <li><span className="font-bold text-[var(--text)]">admin</span>：新增/編輯/刪除/CSV 匯入/匯出</li>
            <li><span className="font-bold text-[var(--text)]">SETVendor</span>：只讀 + 可匯出 CSV + 可切換「搬遷後」4 燈號</li>
          </ul>
        </div>

        <div className="mt-4">
          <button
            onClick={() => {
              repairRackIds();
              alert("已執行資料修復：舊 rackId 會自動轉換成 BEF_/AFT_ 格式");
            }}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5"
          >
            執行資料修復（舊 RackId）
          </button>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------
  Fullscreen helper
----------------------------- */

function useFullscreen() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // ignore
    }
  };

  return { isFs, toggle };
}

/* -----------------------------
  Main App
----------------------------- */

export default function App() {
  useApplyTheme();

  const isAuthed = useStore((s) => s.isAuthed);
  const userName = useStore((s) => s.userName);
  const role = useStore((s) => s.role);
  const logout = useStore((s) => s.logout);

  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);

  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const themeStyle = useStore((s) => s.themeStyle);
  const setThemeStyle = useStore((s) => s.setThemeStyle);

  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);

  const selectedDeviceId = useStore((s) => s.selectedDeviceId);
  const setSelectedDeviceId = useStore((s) => s.setSelectedDeviceId);

  const { isFs, toggle: toggleFs } = useFullscreen();

  const navItems = useMemo(() => {
    const base = [
      { id: "dashboard" as const, label: "儀表板", icon: <LayoutDashboard size={20} /> },
      { id: "devices" as const, label: "設備管理", icon: <Server size={20} /> },
      { id: "before" as const, label: "搬遷前規劃", icon: <ArrowLeftRight size={20} /> },
      { id: "after" as const, label: "搬遷後規劃", icon: <ArrowRightLeft size={20} /> },
    ];
    if (role === "admin") {
      base.push({ id: "admin" as const, label: "管理後台", icon: <Shield size={20} /> });
    }
    return base;
  }, [role]);

  if (!isAuthed) return <LoginPage />;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-300">
      <ThemeTokens />

      {/* Top Header */}
      <header className="h-16 border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-black"
            style={{ background: "linear-gradient(135deg,var(--accent),var(--accent2))", boxShadow: "0 0 18px rgba(34,211,238,0.25)" }}
          >
            <Server size={18} />
          </div>
          <h1 className="text-lg md:text-xl font-black tracking-tighter uppercase italic">
            Migrate<span className="text-[var(--accent)]">Pro</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Fullscreen */}
          <button onClick={toggleFs} className="p-2 hover:bg-white/5 rounded-xl" title={isFs ? "離開全螢幕" : "全螢幕"}>
            {isFs ? <Minimize size={18} /> : <Expand size={18} />}
          </button>

          <select value={themeStyle} onChange={(e) => setThemeStyle(e.target.value as ThemeStyle)} className="bg-[var(--panel2)] border border-[var(--border)] rounded-lg text-xs px-2 py-1 outline-none hidden sm:block">
            <option value="neon">Neon</option>
            <option value="graphite">Graphite</option>
            <option value="aurora">Aurora</option>
            <option value="circuit">Circuit</option>
          </select>

          <button onClick={toggleTheme} className="p-2 hover:bg-white/5 rounded-xl" title="切換深/淺色">
            {theme === "dark" ? "🌙" : "☀️"}
          </button>

          {/* User badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-black/10">
            <User size={16} className="text-[var(--muted)]" />
            <span className="text-sm font-bold">{userName || "-"}</span>
            <span className="text-xs px-2 py-0.5 rounded-lg border border-[var(--border)] text-[var(--muted)]">
              {role === "admin" ? "Admin" : "SETVendor"}
            </span>
            <button onClick={logout} className="ml-1 p-1 rounded-lg hover:bg-white/10" title="登出">
              <LogOut size={16} className="text-[var(--muted)]" />
            </button>
          </div>

          <button onClick={logout} className="md:hidden p-2 hover:bg-white/5 rounded-xl" title="登出">
            <LogOut size={18} />
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
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setUi({ sideCollapsed: !ui.sideCollapsed })}
              className="p-2 rounded-xl hover:bg-white/5"
              title={ui.sideCollapsed ? "展開選單" : "收合選單"}
            >
              {ui.sideCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
            </button>
          </div>

          <div className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  page === item.id
                    ? "bg-[var(--panel2)] text-[var(--accent)] border border-[var(--border)] shadow-[0_0_20px_rgba(34,211,238,0.1)] font-black"
                    : "text-[var(--muted)] hover:bg-white/[0.03]"
                }`}
                title={item.label}
              >
                {item.icon}
                {!ui.sideCollapsed && item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              {page === "dashboard" && <Dashboard />}
              {page === "devices" && <DevicesPage />}
              {page === "before" && <RackPlanner mode="before" />}
              {page === "after" && <RackPlanner mode="after" />}
              {page === "admin" && <AdminPage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-2 flex gap-6 shadow-2xl z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`p-2 rounded-lg ${page === item.id ? "text-[var(--accent)] bg-[var(--panel2)]" : "text-[var(--muted)]"}`}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* Device detail */}
      {selectedDeviceId && (
        <DeviceDetailModal
          id={selectedDeviceId}
          mode={page === "after" ? "after" : "before"}
          onClose={() => setSelectedDeviceId(null)}
        />
      )}
    </div>
  );
}
