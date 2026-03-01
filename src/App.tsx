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
  KeyRound,
  Save,
  Sparkles,
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
type ThemeStyle = "neon" | "horizon" | "nebula" | "matrix";
type PageKey = "dashboard" | "devices" | "before" | "after" | "admin";
type DeviceCategory = "Network" | "Storage" | "Server" | "Other";
type PlacementMode = "before" | "after";
type Role = "admin" | "vendor";

type MigrationFlags = {
  racked: boolean;
  cabled: boolean;
  powered: boolean;
  tested: boolean;
};

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
  unplacedCollapsedBefore: boolean;
  unplacedCollapsedAfter: boolean;
};

type LoginResult = { ok: boolean; message?: string };

type Account = {
  username: string;
  password: string;
  role: Role;
};

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
  accounts: "migrate.accounts",
} as const;

/* -----------------------------
  Fixed Colors
----------------------------- */

const FIXED_COLORS = {
  Network: "#22c55e", // 綠色
  Server: "#3b82f6",  // 藍色
  Storage: "#64748b", // 灰色
  Other: "#fb923c",   // 橘色
  rackText: "#0b1220",
  rackTextDark: "#f8fafc",
};

/* -----------------------------
  Rack Layouts
----------------------------- */

const BEFORE_RACKS: Rack[] = [
  ...["10", "09", "08", "07", "06"].map((n) => ({
    id: `BEF_${n}`,
    name: n,
    units: 42,
  })),
  ...["05", "04", "03", "02", "01"].map((n) => ({
    id: `BEF_${n}`,
    name: n,
    units: 42,
  })),
  ...["2F-A", "2F-B", "3F-A", "3F-B", "4F-A", "4F-B"].map((n) => ({
    id: `BEF_${n}`,
    name: n,
    units: 42,
  })),
  ...["9F", "SmartHouseA", "SmartHouseB"].map((n) => ({
    id: `BEF_${n}`,
    name: n,
    units: 42,
  })),
];

const AFTER_RACKS: Rack[] = [
  ...["A1", "A2", "A3", "A4", "A5", "A6"].map((n) => ({
    id: `AFT_${n}`,
    name: n,
    units: 42,
  })),
  ...["B1", "B2", "B3", "B4", "B5", "B6"].map((n) => ({
    id: `AFT_${n}`,
    name: n,
    units: 42,
  })),
  ...["HUB 15L", "HUB 15R", "HUB 16L", "HUB 16R", "HUB 17L", "HUB 17R"].map(
    (n) => ({
      id: `AFT_${n}`,
      name: n,
      units: 42,
    })
  ),
  ...["HUB 20F", "SmartHouse 20F", "不搬存放區A", "不搬存放區B", "不搬存放區C"].map(
    (n) => ({
      id: `AFT_${n}`,
      name: n,
      units: 42,
    })
  ),
];

/* -----------------------------
  Mock Devices
----------------------------- */

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
    portMap: "A1/40-41U | Gi1/0/1 -> FW\nA1/40-41U | Gi1/0/2 -> Core-RTR",
    beforeRackId: "BEF_01",
    beforeStartU: 40,
    beforeEndU: 41,
    afterRackId: "AFT_A1",
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
    serial: "",
    portMap: "",
    beforeRackId: "BEF_01",
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
    beforeRackId: "BEF_01",
    beforeStartU: 10,
    beforeEndU: 11,
    migration: { racked: false, cabled: false, powered: false, tested: false },
  },
];

/* -----------------------------
  Default accounts
----------------------------- */

const DEFAULT_ACCOUNTS: Account[] = [
  { username: "admin", password: "migration123", role: "admin" },
  { username: "Vendor", password: "migration666", role: "vendor" },
];

/* -----------------------------
  Permissions
----------------------------- */

const canManageAssets = (role: Role) => role === "admin";
const canExportCSV = (_role: Role) => true;
const canToggleFlags = (_role: Role) => true;

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

    if (beforeRackId && isProbablyOldRackId(beforeRackId))
      beforeRackId = toBeforeRackId(beforeRackId);
    if (afterRackId && isProbablyOldRackId(afterRackId))
      afterRackId = toAfterRackId(afterRackId);

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
  Theme Tokens
----------------------------- */

const ThemeTokens = () => {
  const style = useStore((s) => s.themeStyle);

  const presets: Record<ThemeStyle, { light: string; dark: string }> = {
    neon: {
      light:
        ":root{--bg:#f8fafc;--panel:#ffffff;--panel2:#f1f5f9;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--accent:#0ea5e9;--accent2:#8b5cf6;--rack-bg:#1e293b;--onColor:#ffffff;}",
      dark:
        "html.dark{--bg:#020617;--panel:#0f172a;--panel2:#1e293b;--text:#f1f5f9;--muted:#94a3b8;--border:#334155;--accent:#38bdf8;--accent2:#a78bfa;--rack-bg:#000000;--onColor:#ffffff;}",
    },
    horizon: {
      light:
        ":root{--bg:#f6f9ff;--panel:#ffffff;--panel2:#eef3ff;--text:#0a1020;--muted:#5b6478;--border:#e6ebff;--accent:#2563eb;--accent2:#14b8a6;--rack-bg:#1e293b;--onColor:#ffffff;}",
      dark:
        "html.dark{--bg:#070a14;--panel:#0b1020;--panel2:#101a33;--text:#f1f5f9;--muted:#9aa4b2;--border:#1a2550;--accent:#60a5fa;--accent2:#2dd4bf;--rack-bg:#000000;--onColor:#ffffff;}",
    },
    nebula: {
      light:
        ":root{--bg:#fbf7ff;--panel:#ffffff;--panel2:#f6edff;--text:#140a20;--muted:#6b5b7a;--border:#f0e1ff;--accent:#7c3aed;--accent2:#ec4899;--rack-bg:#1e293b;--onColor:#ffffff;}",
      dark:
        "html.dark{--bg:#080614;--panel:#0f0b1f;--panel2:#1a1233;--text:#f8fafc;--muted:#a7a1b2;--border:#2a1f4d;--accent:#a78bfa;--accent2:#fb7185;--rack-bg:#000000;--onColor:#ffffff;}",
    },
    matrix: {
      light:
        ":root{--bg:#f7fbf9;--panel:#ffffff;--panel2:#edf7f2;--text:#07140f;--muted:#5a6b63;--border:#dff2e8;--accent:#10b981;--accent2:#06b6d4;--rack-bg:#1e293b;--onColor:#ffffff;}",
      dark:
        "html.dark{--bg:#050c09;--panel:#0a1410;--panel2:#0f1f18;--text:#eafff6;--muted:#9bb7ab;--border:#153026;--accent:#34d399;--accent2:#22d3ee;--rack-bg:#000000;--onColor:#ffffff;}",
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

const catColor = (cat: DeviceCategory) => {
  switch (cat) {
    case "Network":
      return FIXED_COLORS.Network;
    case "Server":
      return FIXED_COLORS.Server;
    case "Storage":
      return FIXED_COLORS.Storage;
    default:
      return FIXED_COLORS.Other;
  }
};

/* -----------------------------
  Lamps (pure RGB + glow)
----------------------------- */

const Lamp = ({ on }: { on: boolean }) => (
  <span
    className="inline-block w-1.5 h-1.5 rounded-full"
    style={{
      backgroundColor: on ? "rgb(0,255,0)" : "rgb(255,0,0)",
      boxShadow: on
        ? "0 0 8px rgba(0,255,0,0.9)"
        : "0 0 8px rgba(255,0,0,0.8)",
    }}
  />
);

const LampsRow = ({ m }: { m: MigrationFlags }) => (
  <div className="flex items-center gap-1">
    <Lamp on={m.racked} />
    <Lamp on={m.cabled} />
    <Lamp on={m.powered} />
    <Lamp on={m.tested} />
  </div>
);

/* -----------------------------
  CSV Export / Import
----------------------------- */

const FULL_HEADERS = [
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
  "m_racked",
  "m_cabled",
  "m_powered",
  "m_tested",
];

function escCSV(v: any) {
  const s = String(v ?? "");
  const needs =
    s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
  return needs ? `"${s.replace(/"/g, '""')}"` : s;
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

function downloadFullCSV(devices: Device[]) {
  const rows = devices.map((d) => [
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
    d.migration.racked ? 1 : 0,
    d.migration.cabled ? 1 : 0,
    d.migration.powered ? 1 : 0,
    d.migration.tested ? 1 : 0,
  ]);

  const csv = `${FULL_HEADERS.join(",")}\n${rows
    .map((r) => r.map(escCSV).join(","))
    .join("\n")}`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `migratepro_full_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadFullCSVTemplate() {
  const templateRow = [
    "dev-001",
    "Network",
    "SW-01",
    "核心交換機",
    "Cisco",
    "C9300",
    "48",
    "1",
    "10.0.0.2",
    "SN001",
    "01/40U | Gi1/0/1 -> FW\nA1/20U | ETH1 -> TOR",
    "BEF_01",
    "40",
    "40",
    "AFT_A1",
    "20",
    "20",
    "1",
    "1",
    "0",
    "0",
  ];
  const csv = `${FULL_HEADERS.join(",")}\n${templateRow
    .map(escCSV)
    .join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `migratepro_full_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

  accounts: Account[];
  upsertAccount: (a: Account) => { ok: boolean; message?: string };
  deleteAccount: (username: string) => { ok: boolean; message?: string };

  isAuthed: boolean;
  userName: string | null;
  role: Role;
  login: (u: string, p: string) => LoginResult;
  logout: () => void;

  setPage: (p: PageKey) => void;
  toggleTheme: () => void;
  setThemeStyle: (s: ThemeStyle) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setUi: (patch: Partial<UiState>) => void;

  addDevice: (draft: DeviceDraft) => string;
  updateDevice: (id: string, patch: Partial<DeviceDraft>) => void;
  deleteDeviceById: (id: string) => void;

  importFullCSV: (fileText: string) => { ok: boolean; message?: string };

  clearPlacement: (mode: PlacementMode, id: string) => void;
  place: (
    mode: PlacementMode,
    deviceId: string,
    rackId: string,
    startU: number
  ) => { ok: boolean; message?: string };

  setMigrationFlag: (id: string, patch: Partial<MigrationFlags>) => void;

  repairRackIds: () => void;
}

const DEFAULT_UI: UiState = {
  sideCollapsed: false,
  unplacedCollapsedBefore: false,
  unplacedCollapsedAfter: false,
};

function loadAccounts(): Account[] {
  const stored = readJson<Account[]>(LS.accounts, []);
  const valid = Array.isArray(stored) ? stored : [];
  if (valid.length === 0) {
    writeJson(LS.accounts, DEFAULT_ACCOUNTS);
    return DEFAULT_ACCOUNTS;
  }
  const hasAdmin = valid.some((a) => a.username === "admin");
  const patched = hasAdmin
    ? valid
    : [{ username: "admin", password: "migration123", role: "admin" }, ...valid];
  const fixedAdmin = patched.map((a) =>
    a.username === "admin" ? { ...a, role: "admin" } : a
  );
  writeJson(LS.accounts, fixedAdmin);
  return fixedAdmin;
}

const useStore = create<Store>((set, get) => ({
  beforeRacks: BEFORE_RACKS,
  afterRacks: AFTER_RACKS,
  devices: normalizeDevices(readJson<Device[]>(LS.devices, mockDevices)),

  theme: (localStorage.getItem(LS.theme) as ThemeMode) || "dark",
  themeStyle: (localStorage.getItem(LS.themeStyle) as ThemeStyle) || "neon",
  page: "dashboard",
  selectedDeviceId: null,
  ui: { ...DEFAULT_UI, ...readJson<UiState>(LS.ui, DEFAULT_UI) },

  accounts: loadAccounts(),

  upsertAccount: (a) => {
    const username = a.username.trim();
    if (!username) return { ok: false, message: "帳號不可為空" };
    if (username.includes(" ")) return { ok: false, message: "帳號不可包含空白" };
    if (!a.password) return { ok: false, message: "密碼不可為空" };
    if (a.username === "admin" && a.role !== "admin")
      return { ok: false, message: "admin 必須是 Admin 權限" };

    const accounts = get().accounts;
    const exists = accounts.some((x) => x.username === username);
    const next = exists
      ? accounts.map((x) => (x.username === username ? { ...a, username } : x))
      : [...accounts, { ...a, username }];
    writeJson(LS.accounts, next);
    set({ accounts: next });
    return { ok: true };
  },

  deleteAccount: (username) => {
    if (username === "admin") return { ok: false, message: "admin 不能刪除" };
    const accounts = get().accounts;
    const next = accounts.filter((a) => a.username !== username);
    writeJson(LS.accounts, next);
    set({ accounts: next });
    return { ok: true };
  },

  isAuthed: localStorage.getItem(LS.auth) === "1",
  userName: localStorage.getItem(LS.user) || null,
  role: (() => {
    const u = localStorage.getItem(LS.user);
    if (u === "admin") return "admin" as Role;
    const accounts = loadAccounts();
    const found = accounts.find((a) => a.username === u);
    return found?.role ?? ("vendor" as Role);
  })(),

  login: (u, p) => {
    const username = u.trim();
    const accounts = get().accounts;
    const found = accounts.find(
      (a) => a.username === username && a.password === p
    );
    if (!found) return { ok: false, message: "帳號或密碼錯誤" };
    localStorage.setItem(LS.auth, "1");
    localStorage.setItem(LS.user, username);
    set({
      isAuthed: true,
      userName: username,
      role: found.role,
      page: "dashboard",
      selectedDeviceId: null,
    });
    return { ok: true };
  },

  logout: () => {
    localStorage.removeItem(LS.auth);
    localStorage.removeItem(LS.user);
    set({
      isAuthed: false,
      userName: null,
      role: "vendor",
      page: "dashboard",
      selectedDeviceId: null,
    });
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

  addDevice: (draft) => {
    const id = crypto.randomUUID();
    set((s) => {
      const next: Device[] = [
        ...s.devices,
        {
          ...draft,
          id,
          migration: { racked: false, cabled: false, powered: false, tested: false },
        } as Device,
      ];
      writeJson(LS.devices, next);
      return { devices: next };
    });
    return id;
  },

  updateDevice: (id, patch) =>
    set((s) => {
      const next = s.devices.map((d) =>
        d.id === id ? ({ ...d, ...patch } as Device) : d
      );
      writeJson(LS.devices, next);
      return { devices: next };
    }),

  deleteDeviceById: (id) =>
    set((s) => {
      const next = s.devices.filter((d) => d.id !== id);
      writeJson(LS.devices, next);
      return {
        devices: next,
        selectedDeviceId: s.selectedDeviceId === id ? null : s.selectedDeviceId,
      };
    }),

  importFullCSV: (fileText) => {
    try {
      const rows = parseCSV(fileText);
      if (rows.length < 2) return { ok: false, message: "CSV 內容不足" };
      const header = rows[0].map((x) => x.trim());
      const idx = (k: string) => header.findIndex((h) => h === k);

      for (const k of FULL_HEADERS) {
        if (idx(k) === -1) return { ok: false, message: `CSV 缺少欄位：${k}` };
      }

      const getv = (r: string[], k: string) =>
        String(r[idx(k)] ?? "").trim();

      const devices: Device[] = rows.slice(1).map((r) => {
        const sizeU = Math.max(1, Math.min(42, Number(getv(r, "sizeU") || 1)));
        const beforeRackId = getv(r, "beforeRackId") || undefined;
        const afterRackId = getv(r, "afterRackId") || undefined;

        const beforeStartU = getv(r, "beforeStartU");
        const beforeEndU = getv(r, "beforeEndU");
        const afterStartU = getv(r, "afterStartU");
        const afterEndU = getv(r, "afterEndU");

        return {
          id: getv(r, "id") || crypto.randomUUID(),
          category: (getv(r, "category") as DeviceCategory) || "Other",
          deviceId: getv(r, "deviceId"),
          name: getv(r, "name"),
          brand: getv(r, "brand"),
          model: getv(r, "model"),
          ports: Number(getv(r, "ports") || 0),
          sizeU,
          ip: getv(r, "ip") || "",
          serial: getv(r, "serial") || "",
          portMap: getv(r, "portMap") || "",
          beforeRackId: beforeRackId
            ? isProbablyOldRackId(beforeRackId)
              ? toBeforeRackId(beforeRackId)
              : beforeRackId
            : undefined,
          beforeStartU: beforeStartU ? Number(beforeStartU) : undefined,
          beforeEndU: beforeEndU ? Number(beforeEndU) : undefined,
          afterRackId: afterRackId
            ? isProbablyOldRackId(afterRackId)
              ? toAfterRackId(afterRackId)
              : afterRackId
            : undefined,
          afterStartU: afterStartU ? Number(afterStartU) : undefined,
          afterEndU: afterEndU ? Number(afterEndU) : undefined,
          migration: {
            racked: getv(r, "m_racked") === "1",
            cabled: getv(r, "m_cabled") === "1",
            powered: getv(r, "m_powered") === "1",
            tested: getv(r, "m_tested") === "1",
          },
        };
      });

      writeJson(LS.devices, devices);
      set({ devices });

      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.message || "匯入失敗" };
    }
  },

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

  repairRackIds: () =>
    set((s) => {
      const repaired = s.devices.map((d) => {
        let beforeRackId = d.beforeRackId;
        let afterRackId = d.afterRackId;

        if (beforeRackId && isProbablyOldRackId(beforeRackId))
          beforeRackId = toBeforeRackId(beforeRackId);
        if (afterRackId && isProbablyOldRackId(afterRackId))
          afterRackId = toAfterRackId(afterRackId);

        return { ...d, beforeRackId, afterRackId };
      });
      writeJson(LS.devices, repaired);
      return { devices: repaired };
    }),
}));

/* -----------------------------
  Login Page
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

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs text-[var(--muted)]">帳號</label>
            <input
              className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              value={u}
              onChange={(e) => setU(e.target.value)}
              placeholder="請輸入帳號"
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

function Switch({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full border transition-all ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${
        on
          ? "bg-[rgba(0,255,0,0.12)] border-[rgba(0,255,0,0.7)]"
          : "bg-black/20 border-[var(--border)]"
      }`}
      style={{
        boxShadow: on ? "0 0 16px rgba(0,255,0,0.25)" : "none",
      }}
    >
      <span
        className="block w-5 h-5 rounded-full bg-white transition-all"
        style={{ transform: `translateX(${on ? "20px" : "2px"})` }}
      />
    </button>
  );
}

/* -----------------------------
  Device Detail Modal
----------------------------- */

function DeviceDetailModal({
  id,
  mode,
  onClose,
}: {
  id: string;
  mode: PlacementMode;
  onClose: () => void;
}) {
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

  const allowLayout = canManageAssets(role);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-[var(--muted)]">設備詳細</div>
              <div className="text-lg font-black truncate">
                {d.deviceId} · {d.name}
              </div>
              <div className="text-sm text-[var(--muted)] truncate">
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
              <div className="mt-1 whitespace-pre-wrap break-words">
                {d.portMap || "-"}
              </div>
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
              <div className="text-xs text-[var(--muted)] mt-3">
                ※ 僅在「搬遷後」頁面可切換狀態。
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between">
            {allowLayout ? (
              <button
                onClick={() => {
                  if (confirm("確定清除此設備在本頁面的位置？")) clearPlacement(mode, d.id);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5"
              >
                清除本頁位置
              </button>
            ) : (
              <div className="text-xs text-[var(--muted)]">
                Vendor：只能查看/切換燈號，不能調整機櫃佈局
              </div>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90"
            >
              關閉
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -----------------------------
  Device Modal（新增/編輯）
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

  const input = (k: keyof DeviceDraft) => (e: any) =>
    setD((p) => ({ ...p, [k]: e.target.value } as any));

  const portLines = (d.portMap ?? "").split(/\r?\n/);

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
              if (!d.deviceId.trim() || !d.name.trim())
                return alert("請填寫設備編號與設備名稱");

              const lines = (d.portMap ?? "").split(/\r?\n/);
              if (lines.length > 48) return alert("Port對接備註最多 48 行");

              onSave({
                ...d,
                ports: Number(d.ports) || 0,
                sizeU: Math.max(1, Math.min(42, Number(d.sizeU) || 1)),
                portMap: (d.portMap ?? "").trimEnd(),
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
                {(["Network", "Storage", "Server", "Other"] as DeviceCategory[]).map((x) => (
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
              <div className="flex items-end justify-between gap-3">
                <label className="text-xs text-[var(--muted)]">
                  Port對接備註（格式建議：櫃/U/Port）
                </label>
                <div className="text-[11px] text-[var(--muted)]">
                  行數：{portLines.filter((x) => x.trim().length > 0).length}/48
                </div>
              </div>

              <textarea
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none min-h-[140px] whitespace-pre"
                value={d.portMap ?? ""}
                onChange={(e) => {
                  const next = e.target.value;
                  const lines = next.split(/\r?\n/);
                  if (lines.length > 48) return;
                  setD((p) => ({ ...p, portMap: next }));
                }}
                placeholder={"例：\n01/40U | Gi1/0/1 -> FW\nA1/20U | ETH1 -> TOR"}
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5">
                取消
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90">
                儲存
              </button>
            </div>
          </form>
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

  const racked = devices.filter((d) => d.migration.racked).length;
  const completed = devices.filter((d) => isMigratedComplete(d.migration)).length;
  const pending = Math.max(0, devices.length - completed);

  const chartData = [
    { name: "Network", count: devices.filter((d) => d.category === "Network").length, fill: FIXED_COLORS.Network },
    { name: "Storage", count: devices.filter((d) => d.category === "Storage").length, fill: FIXED_COLORS.Storage },
    { name: "Server", count: devices.filter((d) => d.category === "Server").length, fill: FIXED_COLORS.Server },
    { name: "Other", count: devices.filter((d) => d.category === "Other").length, fill: FIXED_COLORS.Other },
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
                color:
                  s.tone === "green"
                    ? "rgb(0,255,0)"
                    : s.tone === "red"
                    ? "rgb(255,0,0)"
                    : "var(--accent)",
                textShadow:
                  s.tone === "green"
                    ? "0 0 18px rgba(0,255,0,0.25)"
                    : s.tone === "red"
                    ? "0 0 18px rgba(255,0,0,0.2)"
                    : "none",
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
            <li>4) 建議定期用「完整 CSV」做備份/還原（不同電腦同步用）。</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------
  CSV Import Modal (Full)
----------------------------- */

function FullCSVImportModal({ onClose }: { onClose: () => void }) {
  const importFullCSV = useStore((s) => s.importFullCSV);
  const [drag, setDrag] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const res = importFullCSV(text);
    if (!res.ok) alert(res.message || "匯入失敗");
    else onClose();
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
            <div className="text-xl font-black">完整 CSV 還原（含佈局/燈號）</div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
              <X />
            </button>
          </div>

          <div className="mt-3 text-sm text-[var(--muted)]">
            拖曳 CSV 到下方區域，或點擊選取檔案。此功能會以 CSV 內容覆蓋現有資料。
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <button
              onClick={downloadFullCSVTemplate}
              className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
            >
              <Download size={16} /> 下載完整範本
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
              <div className="font-black">拖曳完整 CSV 到這裡上傳</div>
              <div className="text-xs text-[var(--muted)]">或點擊選取檔案</div>
            </div>
          </label>
        </div>
      </motion.div>
    </div>
  );
}

/* -----------------------------
  Devices Page (sorting + completion + no wrap)
----------------------------- */

type SortKey =
  | "category"
  | "deviceId"
  | "name"
  | "brand"
  | "model"
  | "ports"
  | "sizeU"
  | "before"
  | "after"
  | "migration"
  | "complete";

type SortDir = "asc" | "desc";

const DevicesPage = () => {
  const devices = useStore((s) => s.devices);
  const addDevice = useStore((s) => s.addDevice);
  const updateDevice = useStore((s) => s.updateDevice);
  const deleteDeviceById = useStore((s) => s.deleteDeviceById);
  const clearPlacement = useStore((s) => s.clearPlacement);
  const setSelectedDeviceId = useStore((s) => s.setSelectedDeviceId);
  const role = useStore((s) => s.role);

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("deviceId");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allowManage = canManageAssets(role);

  const sortToggle = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const getBefore = (d: Device) =>
      d.beforeRackId && d.beforeStartU != null
        ? `${d.beforeRackId.replace(/^BEF_/, "")}-${d.beforeStartU}`
        : "";
    const getAfter = (d: Device) =>
      d.afterRackId && d.afterStartU != null
        ? `${d.afterRackId.replace(/^AFT_/, "")}-${d.afterStartU}`
        : "";
    const getMigScore = (d: Device) =>
      (d.migration.racked ? 1 : 0) +
      (d.migration.cabled ? 1 : 0) +
      (d.migration.powered ? 1 : 0) +
      (d.migration.tested ? 1 : 0);
    const getComplete = (d: Device) => (isMigratedComplete(d.migration) ? 1 : 0);

    const cmp = (a: any, b: any) => {
      if (a === b) return 0;
      if (a == null) return -1;
      if (b == null) return 1;
      if (typeof a === "number" && typeof b === "number") return a - b;
      return String(a).localeCompare(String(b));
    };

    const arr = [...devices].sort((a, b) => {
      let va: any;
      let vb: any;
      switch (sortKey) {
        case "category":
          va = a.category;
          vb = b.category;
          break;
        case "deviceId":
          va = a.deviceId;
          vb = b.deviceId;
          break;
        case "name":
          va = a.name;
          vb = b.name;
          break;
        case "brand":
          va = a.brand;
          vb = b.brand;
          break;
        case "model":
          va = a.model;
          vb = b.model;
          break;
        case "ports":
          va = a.ports;
          vb = b.ports;
          break;
        case "sizeU":
          va = a.sizeU;
          vb = b.sizeU;
          break;
        case "before":
          va = getBefore(a);
          vb = getBefore(b);
          break;
        case "after":
          va = getAfter(a);
          vb = getAfter(b);
          break;
        case "migration":
          va = getMigScore(a);
          vb = getMigScore(b);
          break;
        case "complete":
          va = getComplete(a);
          vb = getComplete(b);
          break;
        default:
          va = a.deviceId;
          vb = b.deviceId;
      }
      const c = cmp(va, vb);
      return sortDir === "asc" ? c : -c;
    });
    return arr;
  }, [devices, sortKey, sortDir]);

  const Th = ({
    k,
    children,
    right,
  }: {
    k: SortKey;
    children: React.ReactNode;
    right?: boolean;
  }) => (
    <th className={`px-4 py-4 font-semibold ${right ? "text-right" : ""}`}>
      <button
        onClick={() => sortToggle(k)}
        className="inline-flex items-center gap-2 hover:text-[var(--accent)] whitespace-nowrap"
        title="排序"
      >
        {children}
        <span className="text-[10px] opacity-70">
          {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">設備資產清單</h2>
          <p className="text-[var(--muted)] text-sm">
            {allowManage
              ? "新增/編輯/刪除設備；刪除會同步移除搬遷前與搬遷後機櫃配置。"
              : "Vendor 權限：可查看、可匯出完整 CSV、可切換搬遷後燈號，但不能調整機櫃佈局/新增/刪除/匯入。"}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {allowManage && (
            <button
              onClick={() => setImportOpen(true)}
              className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
            >
              <Upload size={16} /> 完整CSV還原
            </button>
          )}

          <button
            onClick={() => canExportCSV(role) && downloadFullCSV(devices)}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
          >
            <Download size={16} /> 完整CSV備份
          </button>

          {allowManage && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-[var(--accent)] text-black px-4 py-2 rounded-xl font-extrabold flex items-center gap-2 hover:opacity-90"
            >
              <Plus size={18} /> 新增設備
            </button>
          )}
        </div>
      </div>

      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-black/20 text-[var(--muted)] text-xs uppercase tracking-wider">
            <tr>
              <Th k="category">分類</Th>
              <Th k="deviceId">編號</Th>
              <Th k="name">名稱</Th>
              <Th k="brand">廠牌</Th>
              <Th k="model">型號</Th>
              <Th k="ports">Ports</Th>
              <Th k="sizeU">U</Th>
              <Th k="before">搬遷前</Th>
              <Th k="after">搬遷後</Th>
              <Th k="migration">搬遷狀態</Th>
              <Th k="complete">完成/未完成</Th>
              <th className="px-4 py-4 font-semibold text-right whitespace-nowrap">操作</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {sorted.map((d) => {
              const before =
                d.beforeRackId && d.beforeStartU != null
                  ? `${d.beforeRackId.replace(/^BEF_/, "")} ${d.beforeStartU}-${d.beforeEndU}U`
                  : "-";
              const after =
                d.afterRackId && d.afterStartU != null
                  ? `${d.afterRackId.replace(/^AFT_/, "")} ${d.afterStartU}-${d.afterEndU}U`
                  : "-";
              const done = isMigratedComplete(d.migration);

              return (
                <tr key={d.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span
                      className="text-[10px] font-extrabold px-2 py-1 rounded-md border whitespace-nowrap"
                      style={{
                        color: "var(--onColor)",
                        borderColor: "rgba(255,255,255,0.35)",
                        backgroundColor: catColor(d.category),
                      }}
                    >
                      {d.category}
                    </span>
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-black text-sm whitespace-nowrap">{d.deviceId}</div>
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => useStore.getState().setSelectedDeviceId(d.id)}
                      className="text-sm text-[var(--muted)] hover:text-[var(--accent)] font-semibold whitespace-nowrap"
                      title="查看詳細"
                    >
                      {d.name}
                    </button>
                  </td>

                  <td className="px-4 py-4 text-xs text-[var(--text)] whitespace-nowrap">{d.brand}</td>
                  <td className="px-4 py-4 text-xs text-[var(--muted)] whitespace-nowrap">{d.model}</td>

                  <td className="px-4 py-4 text-xs text-[var(--muted)] whitespace-nowrap">{d.ports}</td>
                  <td className="px-4 py-4 text-xs text-[var(--muted)] whitespace-nowrap">{d.sizeU}U</td>

                  <td className="px-4 py-4 text-xs text-[var(--muted)] whitespace-nowrap">{before}</td>
                  <td className="px-4 py-4 text-xs text-[var(--muted)] whitespace-nowrap">{after}</td>

                  <td className="px-4 py-4 whitespace-nowrap">
                    <LampsRow m={d.migration} />
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">
                    <span
                      className="text-xs font-extrabold px-2 py-1 rounded-lg border"
                      style={{
                        borderColor: done ? "rgba(0,255,0,0.45)" : "rgba(255,0,0,0.45)",
                        color: done ? "rgb(0,255,0)" : "rgb(255,0,0)",
                        background: done ? "rgba(0,255,0,0.06)" : "rgba(255,0,0,0.06)",
                      }}
                    >
                      {done ? "完成" : "未完成"}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    {allowManage ? (
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
                          className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-white/5 whitespace-nowrap"
                          title="清除位置"
                        >
                          清除
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`確定刪除 ${d.deviceId} - ${d.name}？`)) deleteDeviceById(d.id);
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

            {sorted.length === 0 && (
              <tr>
                <td colSpan={12} className="px-6 py-10 text-center text-[var(--muted)]">
                  目前沒有設備
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {importOpen && <FullCSVImportModal onClose={() => setImportOpen(false)} />}

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
  Hover Card (tooltip) - Glassmorphism
----------------------------- */

function HoverCard({
  x,
  y,
  d,
  beforePos,
  afterPos,
}: {
  x: number;
  y: number;
  d: Device;
  beforePos: string;
  afterPos: string;
}) {
  return (
    <div className="fixed z-[9999] pointer-events-none" style={{ left: x + 16, top: y + 16 }}>
      {/* 玻璃模糊特效 (Glassmorphism) 卡片 */}
      <div className="rounded-2xl border border-white/20 bg-slate-900/60 dark:bg-black/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-[320px] p-4 text-left text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] text-gray-300 font-medium">設備資訊</div>
            <div className="font-black text-sm truncate text-white">{d.deviceId} · {d.name}</div>
            <div className="text-[11px] text-gray-300 truncate mt-0.5">
              {d.brand} / {d.model} · {d.sizeU}U · {d.ports} ports
            </div>
          </div>
          <div className="pt-1">
            <LampsRow m={d.migration} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/10 p-2">
            <div className="text-[10px] text-gray-400">搬遷前</div>
            <div className="font-bold truncate text-white">{beforePos}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/10 p-2">
            <div className="text-[10px] text-gray-400">搬遷後</div>
            <div className="font-bold truncate text-white">{afterPos}</div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-gray-400 truncate">
          IP：{d.ip || "-"}　SN：{d.serial || "-"}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
  Unplaced Panel
----------------------------- */

function UnplacedPanel({
  mode,
  unplaced,
  collapsed,
  setCollapsed,
  allowLayout,
}: {
  mode: PlacementMode;
  unplaced: Device[];
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  allowLayout: boolean;
}) {
  useEffect(() => {
    if (unplaced.length === 0 && !collapsed) setCollapsed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unplaced.length]);

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden mb-6">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-black">未放置設備</div>
          <div className="text-xs text-[var(--muted)]">
            {unplaced.length === 0 ? "全部已放置（已自動收合）" : `${unplaced.length} 台`}
          </div>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2 text-sm"
          title="收合/展開"
        >
          {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          {collapsed ? "展開" : "收合"}
        </button>
      </div>

      {!collapsed && (
        <div className="p-4">
          {unplaced.length === 0 ? (
            <div className="text-sm text-[var(--muted)]">✅ 沒有未放置設備</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {unplaced.map((d) => (
                <div
                  key={d.id}
                  draggable={allowLayout}
                  onDragStart={(ev) => {
                    if (!allowLayout) return;
                    ev.dataTransfer.setData("text/plain", d.id);
                    ev.dataTransfer.effectAllowed = "move";
                  }}
                  className={`min-w-[240px] p-3 rounded-xl shadow-md border border-white/10 transition-all ${
                    allowLayout ? "cursor-grab active:cursor-grabbing hover:brightness-110 hover:scale-[1.02]" : "cursor-not-allowed opacity-90"
                  }`}
                  style={{
                    backgroundColor: catColor(d.category),
                    backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.15) 100%)",
                    color: "white"
                  }}
                  title={allowLayout ? "拖曳到機櫃" : "Vendor 不允許拖放"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black truncate drop-shadow-md">{d.deviceId}</div>
                      <div className="text-xs font-semibold opacity-90 truncate drop-shadow-sm mt-0.5">{d.name}</div>
                      <div className="text-[10px] opacity-80 mt-1.5 truncate drop-shadow-sm">
                        {d.brand} · {d.model} · {d.sizeU}U
                      </div>
                    </div>
                    <div className="pt-1 bg-black/20 p-1 rounded-md shadow-inner">
                      <LampsRow m={d.migration} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 text-xs text-[var(--muted)]">
            {allowLayout
              ? `提示：把設備拖到機櫃（${mode === "before" ? "搬遷前" : "搬遷後"}）`
              : "Vendor：只能查看/切換搬遷後燈號，不能拖放"}
          </div>
        </div>
      )}
    </div>
  );
}

/* -----------------------------
  Add & Place Modal (Admin)
----------------------------- */

function AddAndPlaceModal({
  mode,
  rackId,
  u,
  onClose,
}: {
  mode: PlacementMode;
  rackId: string;
  u: number;
  onClose: () => void;
}) {
  const role = useStore((s) => s.role);
  const addDevice = useStore((s) => s.addDevice);
  const place = useStore((s) => s.place);

  if (role !== "admin") return null;

  const initial: DeviceDraft = {
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
  };

  return (
    <DeviceModal
      title={`新增設備並放置：${rackId.replace(/^(BEF_|AFT_)/, "")} / ${u}U`}
      initial={initial}
      onClose={onClose}
      onSave={(d) => {
        const id = addDevice(d);
        const res = place(mode, id, rackId, u);
        if (!res.ok) alert(res.message);
        onClose();
      }}
    />
  );
}

/* -----------------------------
  Rack Planner (NEW REDESIGN)
----------------------------- */

const isNoMoveRack = (name: string) => name.startsWith("不搬存放區");

const RackPlanner = ({ mode }: { mode: PlacementMode }) => {
  const racks = useStore((s) => (mode === "before" ? s.beforeRacks : s.afterRacks));
  const devices = useStore((s) => s.devices);
  const place = useStore((s) => s.place);
  const clearPlacement = useStore((s) => s.clearPlacement);
  const setSelectedDeviceId = useStore((s) => s.setSelectedDeviceId);
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  const repairRackIds = useStore((s) => s.repairRackIds);
  const role = useStore((s) => s.role);

  const allowLayout = canManageAssets(role);

  // 用於毛玻璃卡片的全局狀態
  type HoverInfo = { x: number; y: number; d: Device; beforePos: string; afterPos: string };
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  
  const [addPlace, setAddPlace] = useState<{ rackId: string; u: number } | null>(null);

  useEffect(() => {
    repairRackIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const rackIdSet = useMemo(() => new Set(racks.map((r) => r.id)), [racks]);

  const isPlaced = (d: Device) => {
    const rid = mode === "before" ? d.beforeRackId : d.afterRackId;
    const s = mode === "before" ? d.beforeStartU : d.afterStartU;
    const e = mode === "before" ? d.beforeEndU : d.afterEndU;
    return !!rid && rackIdSet.has(rid) && s != null && e != null;
  };

  const unplaced = useMemo(() => devices.filter((d) => !isPlaced(d)), [devices, rackIdSet, mode]);

  const collapsed = mode === "before" ? ui.unplacedCollapsedBefore : ui.unplacedCollapsedAfter;
  const setCollapsed = (v: boolean) =>
    setUi(mode === "before" ? { unplacedCollapsedBefore: v } : { unplacedCollapsedAfter: v });

  const rackRows = useMemo(() => {
    if (mode === "before") {
      const map = new Map(racks.map((r) => [r.name, r]));
      const spec: string[][] = [
        ["10", "09", "08", "07", "06"],
        ["05", "04", "03", "02", "01"],
        ["2F-A", "2F-B", "3F-A", "3F-B", "4F-A", "4F-B"],
        ["9F", "SmartHouseA", "SmartHouseB"],
      ];
      return spec.map((row) => row.map((name) => map.get(name)!).filter(Boolean));
    }

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
  }, [racks, mode]);

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

  // 縮小 1~42U 的間距，讓機櫃在畫面中不要太高
  const U_H = 20;

  const getBlockStyle = (d: Device) => {
    const sU = (mode === "before" ? d.beforeStartU : d.afterStartU) ?? 1;
    const eU = (mode === "before" ? d.beforeEndU : d.afterEndU) ?? sU;
    const start = clampU(Math.min(sU, eU));
    const end = clampU(Math.max(sU, eU));
    
    // 嚴格依照網格線高計算位置
    const height = (end - start + 1) * U_H;
    const bottom = (start - 1) * U_H;
    return { bottom, height, start, end };
  };

  const findDeviceAtU = (rackId: string, u: number) => {
    return devices.find((d) => {
      const rId = mode === "before" ? d.beforeRackId : d.afterRackId;
      const s = mode === "before" ? d.beforeStartU : d.afterStartU;
      const e = mode === "before" ? d.beforeEndU : d.afterEndU;
      if (rId !== rackId || s == null || e == null) return false;
      return u >= Math.min(s, e) && u <= Math.max(s, e);
    });
  };

  const onDrop = (e: React.DragEvent, rackId: string, u: number) => {
    e.preventDefault();
    if (!allowLayout) return;
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const res = place(mode, id, rackId, u);
    if (!res.ok) alert(res.message);
  };

  const onCellClick = (rackId: string, u: number) => {
    const found = findDeviceAtU(rackId, u);
    if (found) {
      setSelectedDeviceId(found.id);
      return;
    }
    if (role === "admin") setAddPlace({ rackId, u });
  };

  const title = mode === "before" ? "搬遷前 機櫃佈局" : "搬遷後 機櫃佈局";

  return (
    <div className="p-6 relative">
      <div className="flex flex-wrap items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-3 text-[var(--text)]">
            <ArrowRightLeft className="text-[var(--accent)]" />
            {title}
          </h2>
          <p className="text-[var(--muted)] text-sm font-medium mt-1">
            {allowLayout
              ? "拖拉設備到機櫃；已放置設備也可再拖拉調整位置（含 U 重疊檢查）"
              : "Vendor：只能查看（不可拖放/不可調整機櫃佈局），但可在搬遷後切換燈號"}
          </p>
        </div>
        
        {/* 類別顏色圖例 */}
        <div className="flex gap-3 bg-[var(--panel)] p-2.5 rounded-xl border border-[var(--border)] shadow-sm text-xs font-bold shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-sm shadow-inner" style={{ backgroundColor: FIXED_COLORS.Network }}></div> Network</div>
          <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-sm shadow-inner" style={{ backgroundColor: FIXED_COLORS.Server }}></div> Server</div>
          <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-sm shadow-inner" style={{ backgroundColor: FIXED_COLORS.Storage }}></div> Storage</div>
          <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-sm shadow-inner" style={{ backgroundColor: FIXED_COLORS.Other }}></div> Other</div>
        </div>
      </div>

      <UnplacedPanel
        mode={mode}
        unplaced={unplaced}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        allowLayout={allowLayout}
      />

      <div className="space-y-8 overflow-hidden">
        {rackRows.map((row, idx) => (
          <div
            key={idx}
            className="flex gap-6 overflow-x-auto pb-4 items-start snap-x"
          >
            {row.map((rack) => (
              <div
                key={rack.id}
                className="flex flex-col bg-[var(--panel)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden flex-shrink-0 snap-center w-[340px]"
              >
                {/* 機櫃標題列：動態變色 */}
                <div
                  className={`p-4 ${
                    mode === "after" && isNoMoveRack(rack.name)
                      ? "bg-red-800"
                      : mode === "after"
                      ? "bg-emerald-600"
                      : "bg-slate-800"
                  } text-white flex justify-between items-center`}
                >
                  <h2 className="font-bold text-base flex items-center gap-2 truncate text-white">
                    <Server size={18} />
                    {rack.name}
                  </h2>
                  <span className="text-[10px] bg-white/20 px-2 py-1 rounded whitespace-nowrap text-white">
                    42U
                  </span>
                </div>

                {/* 機櫃本體與刻度區域 */}
                <div className="flex-1 overflow-y-hidden p-4 bg-slate-100 dark:bg-black/20 flex justify-center">
                  
                  {/* Rack Frame 容器，固定高度，對齊精準 */}
                  <div
                    className="relative w-full border-x-[12px] border-t-[12px] border-slate-400 dark:border-slate-600 bg-slate-900 rounded-t-lg shadow-inner mb-4"
                    style={{ height: 42 * U_H }} 
                  >
                    
                    {/* 左側 U 數刻度列 (Yellow) */}
                    <div className="absolute left-0 top-0 bottom-0 w-7 sm:w-8 bg-yellow-400/90 flex flex-col-reverse border-r border-slate-800 z-0">
                      {Array.from({ length: 42 }).map((_, i) => (
                        <div 
                          key={i + 1} 
                          className="w-full flex items-center justify-center text-slate-900 text-[8px] font-bold" 
                          style={{ height: U_H }}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>

                    {/* 右側 空槽格線區 */}
                    <div className="absolute left-7 sm:left-8 right-0 top-0 bottom-0 flex flex-col-reverse z-0">
                      {Array.from({ length: 42 }).map((_, i) => {
                        const u = i + 1;
                        // 每 5U 加粗上方格線 (flex-col-reverse中，畫在上緣)
                        const isThick = u % 5 === 0;
                        return (
                          <div
                            key={u}
                            className={`w-full group relative box-border border-t ${
                              isThick ? 'border-slate-500 border-t-[2px]' : 'border-slate-700/60'
                            }`}
                            style={{ height: U_H }}
                            onDragOver={(e) => allowLayout && e.preventDefault()}
                            onDrop={(e) => onDrop(e, rack.id, u)}
                            onClick={() => onCellClick(rack.id, u)}
                          >
                            {/* Hover 特效 */}
                            <div className="absolute inset-0 hover:bg-white/[0.05] transition-colors cursor-pointer" />
                          </div>
                        );
                      })}
                    </div>

                    {/* 設備絕對定位層 (Overlay) - 完全精準對齊格線 */}
                    <div className="absolute left-7 sm:left-8 right-0 top-0 bottom-0 pointer-events-none z-10">
                      {listForRack(rack.id).map((d) => {
                        const { bottom, height } = getBlockStyle(d);
                        const isHovered = hoverId === d.id;
                        
                        const beforePos =
                          d.beforeRackId && d.beforeStartU != null && d.beforeEndU != null
                            ? `${d.beforeRackId.replace(/^BEF_/, "")} ${d.beforeStartU}-${d.beforeEndU}U`
                            : "-";
                        const afterPos =
                          d.afterRackId && d.afterStartU != null && d.afterEndU != null
                            ? `${d.afterRackId.replace(/^AFT_/, "")} ${d.afterStartU}-${d.afterEndU}U`
                            : "-";

                        return (
                          <div
                            key={d.id}
                            draggable={allowLayout}
                            onDragStart={(ev) => {
                              if (!allowLayout) return;
                              ev.dataTransfer.setData("text/plain", d.id);
                              ev.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => setSelectedDeviceId(d.id)}
                            onMouseMove={(e) => {
                              setHoverId(d.id);
                              setHoverInfo({ x: e.clientX, y: e.clientY, d, beforePos, afterPos });
                            }}
                            onMouseLeave={() => {
                              setHoverId(null);
                              setHoverInfo(null);
                            }}
                            className={`absolute left-[2px] right-[2px] rounded flex flex-row items-center px-2 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition-all pointer-events-auto overflow-hidden ${
                              isHovered ? "brightness-125 scale-[1.01] z-20 shadow-[0_0_15px_rgba(56,189,248,0.4)]" : "z-10"
                            }`}
                            style={{
                              bottom: bottom + 1,  // 往上 1px，避免蓋到網格線
                              height: height - 1,  // 縮減 1px，完美置於格子內
                              backgroundColor: catColor(d.category),
                              backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.2) 100%)",
                              cursor: allowLayout ? "grab" : "pointer",
                            }}
                          >
                            {/* 設備文字內容動態排版 */}
                            <div className="flex-1 h-full flex flex-col justify-center min-w-0 pr-14 drop-shadow-md">
                              {d.sizeU >= 2 ? (
                                <>
                                  <div className="truncate w-full font-bold text-[9px] sm:text-[10px] leading-tight tracking-wide">
                                    {d.deviceId} | {d.name}
                                  </div>
                                  <div className="truncate w-full text-[8px] sm:text-[9px] opacity-90 font-medium leading-tight mt-0.5">
                                    {d.brand} | {d.model}
                                  </div>
                                </>
                              ) : (
                                <div className="truncate w-full font-bold text-[8px] sm:text-[9px] leading-tight">
                                  {d.deviceId} | {d.name} | {d.model}
                                </div>
                              )}
                            </div>
                            
                            {/* 狀態燈號 (移到右下角，絕對定位不擋字) */}
                            <div className="absolute bottom-1 right-1 flex items-center bg-black/40 px-1 py-[2px] rounded shadow-inner pointer-events-none scale-[0.7] sm:scale-[0.8] origin-bottom-right">
                              <LampsRow m={d.migration} />
                            </div>

                            {/* 移除按鈕 (Hover時顯示) */}
                            {allowLayout && isHovered && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearPlacement(mode, d.id);
                                  setHoverId(null);
                                  setHoverInfo(null);
                                }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-400 z-30 pointer-events-auto scale-75"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* 機櫃底部底座 */}
                    <div className="absolute -bottom-4 left-[-12px] right-[-12px] h-4 bg-slate-500 dark:bg-slate-700 rounded-b-sm shadow-md"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {addPlace && (
        <AddAndPlaceModal
          mode={mode}
          rackId={addPlace.rackId}
          u={addPlace.u}
          onClose={() => setAddPlace(null)}
        />
      )}

      {/* 根節點渲染毛玻璃懸浮卡片 (避免被父層 overflow 裁切) */}
      {hoverInfo && <HoverCard {...hoverInfo} />}
    </div>
  );
};

/* -----------------------------
  Admin Page（帳號管理）
----------------------------- */

const AdminPage = () => {
  const role = useStore((s) => s.role);
  const user = useStore((s) => s.userName);
  const accounts = useStore((s) => s.accounts);
  const upsertAccount = useStore((s) => s.upsertAccount);
  const deleteAccount = useStore((s) => s.deleteAccount);

  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

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

  const Modal = ({
    title,
    initial,
    onClose,
  }: {
    title: string;
    initial: Account;
    onClose: () => void;
  }) => {
    const [a, setA] = useState<Account>(initial);
    const isAdminAccount = a.username === "admin";

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
        >
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-xl font-black flex items-center gap-2">
                <KeyRound className="text-[var(--accent)]" /> {title}
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                <X />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[var(--muted)]">帳號</label>
                <input
                  className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  value={a.username}
                  onChange={(e) => setA((p) => ({ ...p, username: e.target.value }))}
                  disabled={!creating}
                />
                {!creating && (
                  <div className="text-[11px] text-[var(--muted)] mt-1">
                    編輯時不可更改帳號（需新增新帳號）
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-[var(--muted)]">權限</label>
                <select
                  className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                  value={a.role}
                  onChange={(e) => setA((p) => ({ ...p, role: e.target.value as Role }))}
                  disabled={isAdminAccount}
                >
                  <option value="admin">Admin</option>
                  <option value="vendor">Vendor</option>
                </select>
                {isAdminAccount && (
                  <div className="text-[11px] text-[var(--muted)] mt-1">admin 必須保持 Admin 權限</div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-[var(--muted)]">密碼</label>
                <input
                  type="password"
                  className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  value={a.password}
                  onChange={(e) => setA((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5">
                取消
              </button>
              <button
                onClick={() => {
                  const res = upsertAccount(a);
                  if (!res.ok) return alert(res.message || "儲存失敗");
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90 flex items-center gap-2"
              >
                <Save size={16} /> 儲存
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="text-[var(--accent)]" />
              <div className="text-lg font-black">管理後台：帳號管理</div>
            </div>
            <div className="text-sm text-[var(--muted)] mt-2">
              目前登入：<span className="text-[var(--text)] font-bold">{user}</span>（Admin）
            </div>
          </div>

          <button
            onClick={() => {
              setCreating(true);
              setEditing({ username: "", password: "", role: "vendor" });
            }}
            className="bg-[var(--accent)] text-black px-4 py-2 rounded-xl font-extrabold flex items-center gap-2 hover:opacity-90"
          >
            <Plus size={18} /> 新增帳號
          </button>
        </div>

        <div className="mt-5 bg-[var(--panel2)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-black/20 text-[var(--muted)] text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">帳號</th>
                <th className="px-4 py-3 font-semibold">權限</th>
                <th className="px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {accounts
                .slice()
                .sort((a, b) =>
                  a.username === "admin"
                    ? -1
                    : b.username === "admin"
                    ? 1
                    : a.username.localeCompare(b.username)
                )
                .map((a) => (
                  <tr key={a.username} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="font-black">{a.username}</div>
                      {a.username === "admin" && <div className="text-xs text-[var(--muted)]">admin 不能刪除</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--muted)]">
                        {a.role === "admin" ? "Admin" : "Vendor"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setCreating(false);
                            setEditing(a);
                          }}
                          className="px-3 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2 text-sm"
                        >
                          <Edit3 size={16} /> 修改
                        </button>
                        <button
                          onClick={() => {
                            const res = deleteAccount(a.username);
                            if (!res.ok) return alert(res.message || "刪除失敗");
                          }}
                          disabled={a.username === "admin"}
                          className={`px-3 py-2 rounded-xl border border-[var(--border)] flex items-center gap-2 text-sm ${
                            a.username === "admin" ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5 text-red-300"
                          }`}
                        >
                          <Trash2 size={16} /> 刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[var(--muted)]">
                    沒有帳號資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-[var(--muted)]">
          Vendor：只能查看（不可拖放/不可新增刪除匯入），但可切換搬遷後燈號。不同電腦同步請用完整 CSV。
        </div>
      </div>

      {editing && (
        <Modal
          title={creating ? "新增帳號" : "修改帳號"}
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
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
    if (role === "admin") base.push({ id: "admin" as const, label: "管理後台", icon: <Shield size={20} /> });
    return base;
  }, [role]);

  if (!isAuthed) return <LoginPage />;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-300">
      <ThemeTokens />

      <header className="h-16 border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-black"
            style={{
              background: "linear-gradient(135deg,var(--accent),var(--accent2))",
              boxShadow: "0 0 18px rgba(34,211,238,0.25)",
            }}
          >
            <Server size={18} />
          </div>
          <h1 className="text-lg md:text-xl font-black tracking-tighter uppercase italic">
            Migrate<span className="text-[var(--accent)]">Pro</span>
          </h1>
          <div className="hidden md:flex items-center gap-2 text-xs text-[var(--muted)]">
            <Sparkles size={14} className="text-[var(--accent)]" />
            機房搬遷專案管理
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={toggleFs} className="p-2 hover:bg-white/5 rounded-xl" title={isFs ? "離開全螢幕" : "全螢幕"}>
            {isFs ? <Minimize size={18} /> : <Expand size={18} />}
          </button>

          <select
            value={themeStyle}
            onChange={(e) => setThemeStyle(e.target.value as ThemeStyle)}
            className="bg-[var(--panel2)] border border-[var(--border)] rounded-lg text-xs px-2 py-1 outline-none hidden sm:block"
          >
            <option value="neon">Neon</option>
            <option value="horizon">Horizon</option>
            <option value="nebula">Nebula</option>
            <option value="matrix">Matrix</option>
          </select>

          <button onClick={toggleTheme} className="p-2 hover:bg-white/5 rounded-xl" title="切換深/淺色">
            {theme === "dark" ? "🌙" : "☀️"}
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-black/10">
            <User size={16} className="text-[var(--muted)]" />
            <span className="text-sm font-bold">{userName || "-"}</span>
            <span className="text-xs px-2 py-0.5 rounded-lg border border-[var(--border)] text-[var(--muted)]">
              {role === "admin" ? "Admin" : "Vendor"}
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
              {page === "admin" && <AdminPage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

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
