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
  ArrowUpDown,
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
type ThemeStyle = "neon" | "holo" | "glass" | "midnightAI";
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
  catColors: "migrate.catColors",
  rackTextColor: "migrate.rackTextColor",
} as const;

/* -----------------------------
  Rack Layouts（依你指定）
----------------------------- */

// ✅ 搬遷前機櫃佈局：5 / 5 / 6 / 3
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
    beforeRackId: "BEF_01",
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

const isNoMoveRack = (name: string) => name.startsWith("不搬存放區");

/* -----------------------------
  Category Colors + Rack Text Color
----------------------------- */

type CatColors = Record<DeviceCategory, string>;

const DEFAULT_CAT_COLORS: CatColors = {
  Network: "#6f8f7d", // 灰綠
  Storage: "#6a86a6", // 灰藍
  Server: "#7a6fa3", // 灰紫
  Other: "#b58a1a", // 深黃
};

const loadCatColors = (): CatColors => {
  const v = readJson<CatColors>(LS.catColors, DEFAULT_CAT_COLORS);
  return {
    Network: v.Network || DEFAULT_CAT_COLORS.Network,
    Storage: v.Storage || DEFAULT_CAT_COLORS.Storage,
    Server: v.Server || DEFAULT_CAT_COLORS.Server,
    Other: v.Other || DEFAULT_CAT_COLORS.Other,
  };
};

const loadRackTextColor = (): string => {
  const v = localStorage.getItem(LS.rackTextColor);
  return v || "#F8FAFC";
};

/* -----------------------------
  Theme Tokens（AI色系）
----------------------------- */

const ThemeTokens = () => {
  const style = useStore((s) => s.themeStyle);

  const presets: Record<ThemeStyle, { light: string; dark: string }> = {
    neon: {
      light:
        ":root{--bg:#f7fafc;--panel:#ffffff;--panel2:#f1f5f9;--text:#0b1220;--muted:#475569;--border:#e2e8f0;--accent:#06b6d4;--accent2:#a855f7;--onColor:#0b1220}",
      dark:
        "html.dark{--bg:#05070d;--panel:#0b1220;--panel2:#1a2235;--text:#e5e7eb;--muted:#94a3b8;--border:#1e293b;--accent:#22d3ee;--accent2:#c084fc;--onColor:#f8fafc}",
    },

    // ✅ Holo AI：偏霓虹+柔和漸層（時下 AI 產品風）
    holo: {
      light:
        ":root{--bg:#f7f8ff;--panel:#ffffff;--panel2:#f2f4ff;--text:#0a0f1e;--muted:#586174;--border:#e6e8ff;--accent:#5b8cff;--accent2:#22c55e;--onColor:#0a0f1e}",
      dark:
        "html.dark{--bg:#05061a;--panel:#0b0e25;--panel2:#12163a;--text:#eef2ff;--muted:#aab1cf;--border:#1f265a;--accent:#7aa2ff;--accent2:#34d399;--onColor:#f8fafc}",
    },

    // ✅ Glass AI：玻璃擬態、青紫系
    glass: {
      light:
        ":root{--bg:#f6fbff;--panel:#ffffff;--panel2:#eef6ff;--text:#071224;--muted:#5b6b85;--border:#dbeafe;--accent:#14b8a6;--accent2:#8b5cf6;--onColor:#071224}",
      dark:
        "html.dark{--bg:#041018;--panel:#081a26;--panel2:#0b2233;--text:#e6f0ff;--muted:#96a9c2;--border:#16324a;--accent:#2dd4bf;--accent2:#a78bfa;--onColor:#f8fafc}",
    },

    // ✅ Midnight AI：深夜黑藍+亮紫粉（AI 控制台常見）
    midnightAI: {
      light:
        ":root{--bg:#f7f7fb;--panel:#ffffff;--panel2:#eef1ff;--text:#0b1020;--muted:#667085;--border:#e5e7eb;--accent:#7c3aed;--accent2:#ec4899;--onColor:#0b1020}",
      dark:
        "html.dark{--bg:#05060d;--panel:#0b0f18;--panel2:#0f172a;--text:#f8fafc;--muted:#a1a1aa;--border:#1f2937;--accent:#a78bfa;--accent2:#fb7185;--onColor:#f8fafc}",
    },
  };

  const css = presets[style] || presets.neon;

  return (
    <style>
      {`
${css.light}
${css.dark}

/* ✅ 燈號正綠 / 正紅 + 光暈（全站套用） */
:root{
  --lampOn: rgb(0,255,0);
  --lampOff: rgb(255,0,0);
}
`}
    </style>
  );
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
    className="inline-block w-2 h-2 rounded-full"
    style={{
      backgroundColor: on ? "var(--lampOn)" : "var(--lampOff)",
      boxShadow: on
        ? "0 0 10px rgba(0,255,0,0.8)"
        : "0 0 10px rgba(255,0,0,0.75)",
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
  CSV Full Backup / Restore
  ✅ 包含：資產欄位 + before/after 佈局 + 4 燈
----------------------------- */

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
  "mig_racked",
  "mig_cabled",
  "mig_powered",
  "mig_tested",
];

function downloadCSV(devices: Device[]) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    const needs =
      s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
    return needs ? `"${s.replace(/"/g, '""')}"` : s;
  };

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

  const csv = `${CSV_HEADERS.join(",")}\n${rows
    .map((r) => r.map(esc).join(","))
    .join("\n")}`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devices_fullbackup_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSVTemplate() {
  const sample = [
    CSV_HEADERS.join(","),
    [
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
      "A1/40/Gi1/0/1 -> FW\nA1/40/Gi1/0/2 -> Router",
      "BEF_01",
      "40",
      "40",
      "AFT_A1",
      "40",
      "40",
      "1",
      "1",
      "1",
      "0",
    ].join(","),
  ].join("\n");

  const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devices_fullbackup_template.csv`;
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

  // colors
  catColors: CatColors;
  rackTextColor: string;
  setCatColor: (cat: DeviceCategory, hex: string) => void;
  setRackTextColor: (hex: string) => void;

  // accounts
  accounts: Account[];
  upsertAccount: (a: Account) => { ok: boolean; message?: string };
  deleteAccount: (username: string) => { ok: boolean; message?: string };

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

  addDevice: (draft: DeviceDraft) => string; // returns id
  updateDevice: (id: string, patch: Partial<DeviceDraft>) => void;
  deleteDeviceById: (id: string) => void;

  importDevicesFromCSV: (devices: Device[]) => void;

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
    : [{ username: "admin", password: "migration123", role: "admin" as Role }, ...valid];
  const fixedAdmin = patched.map((a) =>
    a.username === "admin" ? { ...a, role: "admin" as Role } : a
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

  catColors: loadCatColors(),
  rackTextColor: loadRackTextColor(),
  setCatColor: (cat, hex) =>
    set((s) => {
      const next = { ...s.catColors, [cat]: hex };
      writeJson(LS.catColors, next);
      return { catColors: next };
    }),
  setRackTextColor: (hex) =>
    set(() => {
      localStorage.setItem(LS.rackTextColor, hex);
      return { rackTextColor: hex };
    }),

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
    const accounts = readJson<Account[]>(LS.accounts, DEFAULT_ACCOUNTS);
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

  importDevicesFromCSV: (devices) =>
    set(() => {
      const normalized = normalizeDevices(devices as any);
      writeJson(LS.devices, normalized);
      return { devices: normalized, selectedDeviceId: null };
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
  Color helpers
----------------------------- */

const catColorVar = (cat: DeviceCategory) => {
  const c = useStore.getState().catColors[cat];
  return c;
};

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
            <div className="text-lg font-black">SET機房搬遷專案管理</div>
            <div className="text-xs text-[var(--muted)]">登入後開始管理搬遷進度</div>
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
          ? "bg-[var(--lampOn)]/15 border-[var(--lampOn)]"
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
              <pre className="mt-1 whitespace-pre-wrap text-xs text-[var(--text)]/90">
                {d.portMap || "-"}
              </pre>
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
                    onChange={(v) =>
                      canToggleFlags(role) && setFlag(d.id, { racked: v })
                    }
                    disabled={!canToggleFlags(role)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">已接線</div>
                  <Switch
                    on={d.migration.cabled}
                    onChange={(v) =>
                      canToggleFlags(role) && setFlag(d.id, { cabled: v })
                    }
                    disabled={!canToggleFlags(role)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">已開機</div>
                  <Switch
                    on={d.migration.powered}
                    onChange={(v) =>
                      canToggleFlags(role) && setFlag(d.id, { powered: v })
                    }
                    disabled={!canToggleFlags(role)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">已測試</div>
                  <Switch
                    on={d.migration.tested}
                    onChange={(v) =>
                      canToggleFlags(role) && setFlag(d.id, { tested: v })
                    }
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
                  if (confirm("確定清除此設備在本頁面的位置？"))
                    clearPlacement(mode, d.id);
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
  ✅ Port對接備註：多行，最多48行
----------------------------- */

function limitLines(text: string, maxLines: number) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return lines.slice(0, maxLines).join("\n");
}

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

  const portMapLines = (d.portMap || "").replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0).length;

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
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/5"
              aria-label="close"
            >
              <X />
            </button>
          </div>

          <form
            className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!d.deviceId.trim() || !d.name.trim())
                return alert("請填寫設備編號與設備名稱");
              onSave({
                ...d,
                ports: Number(d.ports) || 0,
                sizeU: Math.max(1, Math.min(42, Number(d.sizeU) || 1)),
                portMap: limitLines(d.portMap || "", 48),
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
                {(["Network", "Storage", "Server", "Other"] as DeviceCategory[]).map(
                  (x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  )
                )}
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
                onChange={(e) =>
                  setD((p) => ({ ...p, ports: Number(e.target.value) }))
                }
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
                onChange={(e) =>
                  setD((p) => ({ ...p, sizeU: Number(e.target.value) || 1 }))
                }
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
                  Port對接備註（格式：櫃/U/Port，每行一筆，最多 48 行）
                </label>
                <div className="text-[11px] text-[var(--muted)]">
                  行數：{Math.min(portMapLines, 48)}/48
                </div>
              </div>
              <textarea
                className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none min-h-[220px] whitespace-pre-wrap"
                value={d.portMap ?? ""}
                onChange={(e) =>
                  setD((p) => ({ ...p, portMap: limitLines(e.target.value, 48) }))
                }
                placeholder={"A1/40/Gi1/0/1 -> FW\nA1/40/Gi1/0/2 -> Router"}
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

/* -----------------------------
  Admin Add+Place Modal
----------------------------- */

function AddAndPlaceModal({
  mode,
  rackId,
  startU,
  onClose,
}: {
  mode: PlacementMode;
  rackId: string;
  startU: number;
  onClose: () => void;
}) {
  const addDevice = useStore((s) => s.addDevice);
  const place = useStore((s) => s.place);

  return (
    <DeviceModal
      title={`新增設備並放置（${mode === "before" ? "搬遷前" : "搬遷後"}：${rackId.replace(
        mode === "before" ? /^BEF_/ : /^AFT_/,
        ""
      )} U${startU}）`}
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
      onClose={onClose}
      onSave={(draft) => {
        const id = addDevice(draft);
        const res = place(mode, id, rackId, startU);
        if (!res.ok) alert(res.message || "放置失敗");
        onClose();
      }}
    />
  );
}

/* -----------------------------
  CSV Import Modal（Admin only）
----------------------------- */

function CSVImportModal({ onClose }: { onClose: () => void }) {
  const importDevicesFromCSV = useStore((s) => s.importDevicesFromCSV);
  const [drag, setDrag] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return alert("CSV 內容不足，至少需要標題列 + 一筆資料");

    const header = rows[0].map((x) => x.trim());
    const idx = (k: string) => header.findIndex((h) => h === k);

    for (const k of CSV_HEADERS) {
      if (idx(k) === -1)
        return alert(`CSV 缺少欄位：${k}\n請用「下載範本」產生的格式。`);
    }

    const devices: Device[] = rows.slice(1).map((r) => {
      const get = (k: string) => (idx(k) >= 0 ? String(r[idx(k)] ?? "").trim() : "");
      const num = (k: string) => {
        const v = get(k);
        return v === "" ? undefined : Number(v);
      };
      const b = (k: string) => {
        const v = get(k);
        return v === "1" || v.toLowerCase() === "true";
      };

      const category = (get("category") as DeviceCategory) || "Other";
      return {
        id: get("id") || crypto.randomUUID(),
        category: (["Network", "Storage", "Server", "Other"].includes(category)
          ? category
          : "Other") as DeviceCategory,
        deviceId: get("deviceId"),
        name: get("name"),
        brand: get("brand"),
        model: get("model"),
        ports: Number(get("ports") || 0),
        sizeU: Math.max(1, Math.min(42, Number(get("sizeU") || 1))),
        ip: get("ip") || "",
        serial: get("serial") || "",
        portMap: get("portMap") || "",

        beforeRackId: get("beforeRackId") || undefined,
        beforeStartU: num("beforeStartU"),
        beforeEndU: num("beforeEndU"),

        afterRackId: get("afterRackId") || undefined,
        afterStartU: num("afterStartU"),
        afterEndU: num("afterEndU"),

        migration: {
          racked: b("mig_racked"),
          cabled: b("mig_cabled"),
          powered: b("mig_powered"),
          tested: b("mig_tested"),
        },
      } as Device;
    });

    importDevicesFromCSV(devices);
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
            <div className="text-xl font-black">CSV 匯入（完整還原）</div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
              <X />
            </button>
          </div>

          <div className="mt-3 text-sm text-[var(--muted)]">
            支援完整備份/還原：資產 + 佈局 + 燈號狀態。匯入會覆蓋目前資料。
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
              drag
                ? "border-[var(--accent)] bg-white/5"
                : "border-[var(--border)] bg-black/10"
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
                style={{
                  background:
                    "linear-gradient(135deg,var(--accent),var(--accent2))",
                }}
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
  Dashboard
----------------------------- */

const Dashboard = () => {
  const devices = useStore((s) => s.devices);

  const racked = devices.filter((d) => d.migration.racked).length;
  const completed = devices.filter((d) => isMigratedComplete(d.migration)).length;
  const pending = Math.max(0, devices.length - completed);

  const chartData = [
    {
      name: "Network",
      count: devices.filter((d) => d.category === "Network").length,
      fill: useStore.getState().catColors.Network,
    },
    {
      name: "Storage",
      count: devices.filter((d) => d.category === "Storage").length,
      fill: useStore.getState().catColors.Storage,
    },
    {
      name: "Server",
      count: devices.filter((d) => d.category === "Server").length,
      fill: useStore.getState().catColors.Server,
    },
    {
      name: "Other",
      count: devices.filter((d) => d.category === "Other").length,
      fill: useStore.getState().catColors.Other,
    },
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
                    ? "var(--lampOn)"
                    : s.tone === "red"
                    ? "var(--lampOff)"
                    : "var(--accent)",
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
            <li>1) 到「設備管理」新增/維護設備清單。</li>
            <li>2) 在「搬遷前/後」把設備拖到機櫃；已放置設備也可拖曳調整位置（含 U 重疊檢查）。</li>
            <li>3) 點機櫃內設備可看詳細；在「搬遷後」可即時切換 4 個狀態燈。</li>
            <li>4) 「CSV 匯出」為完整備份（含佈局/燈號），可用「CSV 匯入」完整還原。</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------
  Devices Page（排序 + 完成欄）
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
  | "complete";

function compare(a: any, b: any) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

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
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const allowManage = canManageAssets(role);

  const sorted = useMemo(() => {
    const mapBefore = (d: Device) =>
      d.beforeRackId && d.beforeStartU != null
        ? `${d.beforeRackId.replace(/^BEF_/, "")}-${d.beforeStartU}-${d.beforeEndU}`
        : "";
    const mapAfter = (d: Device) =>
      d.afterRackId && d.afterStartU != null
        ? `${d.afterRackId.replace(/^AFT_/, "")}-${d.afterStartU}-${d.afterEndU}`
        : "";

    const get = (d: Device) => {
      switch (sortKey) {
        case "category":
          return d.category;
        case "deviceId":
          return d.deviceId;
        case "name":
          return d.name;
        case "brand":
          return d.brand;
        case "model":
          return d.model;
        case "ports":
          return d.ports;
        case "sizeU":
          return d.sizeU;
        case "before":
          return mapBefore(d);
        case "after":
          return mapAfter(d);
        case "complete":
          return isMigratedComplete(d.migration) ? 1 : 0;
        default:
          return d.deviceId;
      }
    };

    const arr = devices.slice().sort((a, b) => {
      const c = compare(get(a), get(b));
      return sortDir === "asc" ? c : -c;
    });
    return arr;
  }, [devices, sortKey, sortDir]);

  const HeaderBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => {
        if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
          setSortKey(k);
          setSortDir("asc");
        }
      }}
      className="inline-flex items-center gap-2 hover:text-[var(--accent)]"
      title="點擊排序"
    >
      {label}
      <ArrowUpDown size={14} className="opacity-70" />
    </button>
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">
            設備資產清單
          </h2>
          <p className="text-[var(--muted)] text-sm">
            {allowManage
              ? "新增/編輯/刪除設備；刪除會同步移除搬遷前與搬遷後機櫃配置。"
              : "你目前為 Vendor 權限：可查看、可匯出 CSV、可切換搬遷後燈號，但不能調整機櫃佈局/新增/刪除/匯入。"}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {allowManage && (
            <button
              onClick={() => setImportOpen(true)}
              className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
            >
              <Upload size={16} /> CSV 匯入（完整還原）
            </button>
          )}

          <button
            onClick={() => canExportCSV(role) && downloadCSV(devices)}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
          >
            <Download size={16} /> CSV 匯出（完整備份）
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
              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="category" label="分類" />
              </th>

              {/* ✅ 拆開：編號 / 名稱 */}
              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="deviceId" label="編號" />
              </th>
              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="name" label="名稱" />
              </th>

              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="brand" label="廠牌" />
              </th>
              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="model" label="型號" />
              </th>

              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="ports" label="Ports" />
              </th>
              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="sizeU" label="U" />
              </th>

              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="before" label="搬遷前" />
              </th>
              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="after" label="搬遷後" />
              </th>

              {/* ✅ 狀態 -> 搬遷狀態 */}
              <th className="px-6 py-4 font-semibold">搬遷狀態</th>

              {/* ✅ 完成/未完成 */}
              <th className="px-6 py-4 font-semibold">
                <HeaderBtn k="complete" label="完成/未完成" />
              </th>

              <th className="px-6 py-4 font-semibold text-right">操作</th>
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

              const complete = isMigratedComplete(d.migration);

              return (
                <tr
                  key={d.id}
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="px-6 py-4">
                    <span
                      className="text-[10px] font-extrabold px-2 py-1 rounded-md border"
                      style={{
                        color: "var(--onColor)",
                        borderColor: "rgba(255,255,255,0.35)",
                        backgroundColor: useStore.getState().catColors[d.category],
                      }}
                    >
                      {d.category}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="font-black text-sm">{d.deviceId}</div>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedDeviceId(d.id)}
                      className="text-sm font-bold text-[var(--text)] hover:text-[var(--accent)]"
                    >
                      {d.name}
                    </button>
                  </td>

                  <td className="px-6 py-4 text-xs">
                    <div className="text-[var(--text)]">{d.brand}</div>
                  </td>

                  <td className="px-6 py-4 text-xs">
                    <div className="text-[var(--muted)]">{d.model}</div>
                  </td>

                  <td className="px-6 py-4 text-xs text-[var(--muted)]">
                    {d.ports}
                  </td>

                  <td className="px-6 py-4 text-xs text-[var(--muted)]">
                    {d.sizeU}U
                  </td>

                  <td className="px-6 py-4 text-xs text-[var(--muted)]">
                    {before}
                  </td>
                  <td className="px-6 py-4 text-xs text-[var(--muted)]">
                    {after}
                  </td>

                  <td className="px-6 py-4">
                    <LampsRow m={d.migration} />
                  </td>

                  <td className="px-6 py-4 text-xs">
                    <span
                      className={`px-2 py-1 rounded-lg border ${
                        complete
                          ? "border-[var(--lampOn)] text-[var(--lampOn)]"
                          : "border-[var(--lampOff)] text-[var(--lampOff)]"
                      }`}
                      style={{
                        boxShadow: complete
                          ? "0 0 12px rgba(0,255,0,0.25)"
                          : "0 0 12px rgba(255,0,0,0.2)",
                      }}
                    >
                      {complete ? "完成" : "未完成"}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
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
                          className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-white/5"
                          title="清除位置"
                        >
                          清除
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`確定刪除 ${d.deviceId} - ${d.name}？`))
                              deleteDeviceById(d.id);
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

      {importOpen && <CSVImportModal onClose={() => setImportOpen(false)} />}

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
  Unplaced Panel（移除 legend）
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
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
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
                  className={`min-w-[260px] p-3 rounded-2xl border border-[var(--border)] hover:bg-white/[0.03] ${
                    allowLayout
                      ? "cursor-grab active:cursor-grabbing"
                      : "cursor-not-allowed opacity-90"
                  }`}
                  title={allowLayout ? "拖曳到機櫃" : "Vendor 不允許拖放"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-[var(--text)] truncate">
                        {d.deviceId}
                      </div>
                      <div className="text-xs text-[var(--muted)] truncate">
                        {d.name}
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1 truncate">
                        {d.brand} · {d.model} · {d.sizeU}U
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-extrabold px-2 py-1 rounded-md border"
                      style={{
                        color: "var(--onColor)",
                        borderColor: "rgba(255,255,255,0.35)",
                        backgroundColor: useStore.getState().catColors[d.category],
                      }}
                    >
                      {d.category}
                    </span>
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
  Hover Tooltip (Floating Card)
----------------------------- */

function FloatingDeviceCard({
  d,
  x,
  y,
  mode,
}: {
  d: Device;
  x: number;
  y: number;
  mode: PlacementMode;
}) {
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
      className="fixed z-[80] pointer-events-none"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="w-[320px] rounded-2xl border border-[var(--border)] bg-[var(--panel)]/95 backdrop-blur shadow-2xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-black text-sm truncate">
              {d.deviceId} · {d.name}
            </div>
            <div className="text-xs text-[var(--muted)] truncate">
              {d.brand} / {d.model} · {d.ports} ports · {d.sizeU}U
            </div>
          </div>
          <LampsRow m={d.migration} />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-2">
            <div className="text-[10px] text-[var(--muted)]">搬遷前</div>
            <div className="font-bold">{beforePos}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] p-2">
            <div className="text-[10px] text-[var(--muted)]">搬遷後</div>
            <div className="font-bold">{afterPos}</div>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-[var(--muted)]">
          {mode === "after"
            ? "提示：點設備可開詳細；點空 U（Admin）可新增並放置"
            : "提示：點設備可開詳細；點空 U（Admin）可新增並放置"}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
  Rack Planner
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
  const role = useStore((s) => s.role);

  const catColors = useStore((s) => s.catColors);
  const rackTextColor = useStore((s) => s.rackTextColor);
  const setCatColor = useStore((s) => s.setCatColor);
  const setRackTextColor = useStore((s) => s.setRackTextColor);

  const allowLayout = canManageAssets(role);

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

  // ✅ 依指定 row 切分：搬遷前(5/5/6/3)，搬遷後維持 6 一排
  const rows = useMemo(() => {
    if (mode === "before") {
      const sizes = [5, 5, 6, 3];
      const out: Rack[][] = [];
      let idx = 0;
      for (const sz of sizes) {
        out.push(racks.slice(idx, idx + sz));
        idx += sz;
      }
      const rest = racks.slice(idx);
      if (rest.length) out.push(rest);
      return out.filter((r) => r.length > 0);
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

  // ✅ 更緊湊
  const U_H = 20;

  const getBlockStyle = (d: Device) => {
    const sU = (mode === "before" ? d.beforeStartU : d.afterStartU) ?? 1;
    const eU = (mode === "before" ? d.beforeEndU : d.afterEndU) ?? sU;
    const start = clampU(Math.min(sU, eU));
    const end = clampU(Math.max(sU, eU));
    const height = (end - start + 1) * U_H;
    const bottom = (start - 1) * U_H;
    return { bottom, height, start, end };
  };

  const findDeviceAtU = (rackId: string, u: number) => {
    const list = listForRack(rackId);
    return list.find((d) => {
      const s = (mode === "before" ? d.beforeStartU : d.afterStartU) ?? -1;
      const e = (mode === "before" ? d.beforeEndU : d.afterEndU) ?? -1;
      return u >= s && u <= e;
    });
  };

  // Hover tooltip
  const [hover, setHover] = useState<{
    d: Device;
    x: number;
    y: number;
  } | null>(null);

  // Admin add & place
  const [addPlace, setAddPlace] = useState<{
    rackId: string;
    u: number;
  } | null>(null);

  const onDrop = (e: React.DragEvent, rackId: string, u: number) => {
    e.preventDefault();
    if (!allowLayout) return;
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const res = place(mode, id, rackId, u);
    if (!res.ok) alert(res.message);
  };

  const onClickU = (rackId: string, u: number) => {
    const hit = findDeviceAtU(rackId, u);
    if (hit) {
      setSelectedDeviceId(hit.id);
      return;
    }
    if (!allowLayout) return;
    setAddPlace({ rackId, u });
  };

  const PlannerTopRight = () => (
    <div className="flex items-center gap-4 flex-wrap justify-end">
      <div className="flex items-center gap-3">
        <div className="text-xs text-[var(--muted)]">類別顏色</div>
        {(["Network", "Server", "Storage", "Other"] as DeviceCategory[]).map((c) => (
          <label key={c} className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-[var(--muted)]">{c}</span>
            <input
              type="color"
              value={catColors[c]}
              onChange={(e) => setCatColor(c, e.target.value)}
              className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer"
              title={`${c} 顏色`}
            />
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="text-xs text-[var(--muted)]">設備文字顏色</div>
        <input
          type="color"
          value={rackTextColor}
          onChange={(e) => setRackTextColor(e.target.value)}
          className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer"
          title="設備文字顏色"
        />
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">
            {mode === "before" ? "搬遷前" : "搬遷後"} 機櫃佈局
          </h2>
          <p className="text-[var(--muted)] text-sm">
            {allowLayout
              ? "拖拉設備到機櫃；點空 U 可新增設備並放置（Admin）"
              : "Vendor：只能查看（不可拖放/不可調整機櫃佈局），但可在搬遷後切換燈號"}
          </p>
        </div>

        {/* ✅ 右上角顏色工具 */}
        <PlannerTopRight />
      </div>

      <UnplacedPanel
        mode={mode}
        unplaced={unplaced}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        allowLayout={allowLayout}
      />

      <div className="space-y-6">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
          >
            {row.map((rack) => (
              <div
                key={rack.id}
                className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* ✅ 機櫃編號加大/粗體 */}
                <div
                  className="bg-black/30 text-center py-2 font-black tracking-wide text-base border-b border-[var(--border)]"
                  style={{
                    color:
                      mode === "after" && isNoMoveRack(rack.name)
                        ? "var(--lampOff)"
                        : "var(--accent)",
                  }}
                >
                  {rack.name}
                </div>

                {/* ✅ 更緊湊 padding */}
                <div className="p-2">
                  <div className="flex gap-2">
                    {/* U Numbers */}
                    <div className="relative">
                      <div className="relative flex flex-col-reverse">
                        {Array.from({ length: 42 }).map((_, i) => {
                          const u = i + 1;
                          return (
                            <div
                              key={u}
                              className="w-8 pr-1 text-right text-[10px] text-[var(--muted)] flex items-center justify-end"
                              style={{ height: U_H }}
                            >
                              {u}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Rack Grid */}
                    <div
                      className="relative flex-1 border border-[var(--border)] bg-black/20 rounded-xl overflow-hidden"
                      style={{ height: 42 * U_H }}
                    >
                      <div className="absolute inset-0 flex flex-col-reverse">
                        {Array.from({ length: 42 }).map((_, i) => {
                          const u = i + 1;
                          const thick = u % 5 === 0;
                          return (
                            <div
                              key={u}
                              onDragOver={(e) => allowLayout && e.preventDefault()}
                              onDrop={(e) => onDrop(e, rack.id, u)}
                              onClick={() => onClickU(rack.id, u)}
                              className="relative cursor-pointer"
                              style={{ height: U_H }}
                              title="點擊此 U"
                            >
                              <div
                                className="absolute inset-x-0 top-0"
                                style={{
                                  height: thick ? 2 : 1,
                                  background: thick
                                    ? "rgba(255,255,255,0.35)"
                                    : "rgba(255,255,255,0.15)",
                                }}
                              />
                              <div className="absolute inset-0 hover:bg-white/[0.04]" />
                            </div>
                          );
                        })}
                      </div>

                      {listForRack(rack.id).map((d) => {
                        const { bottom, height } = getBlockStyle(d);
                        const catColor = catColors[d.category];

                        // ✅ 動態字體：依高度縮放
                        const font1 = height >= 80 ? 13 : height >= 60 ? 12 : 11;
                        const font2 = height >= 80 ? 12 : height >= 60 ? 11 : 10;

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
                            onMouseEnter={(ev) => {
                              setHover({
                                d,
                                x: ev.clientX,
                                y: ev.clientY,
                              });
                            }}
                            onMouseMove={(ev) => {
                              setHover((p) =>
                                p ? { ...p, x: ev.clientX, y: ev.clientY } : p
                              );
                            }}
                            onMouseLeave={() => setHover(null)}
                            className="absolute left-1 right-1 border border-white/60 select-none"
                            style={{
                              bottom,
                              height,
                              backgroundColor: catColor,
                              cursor: allowLayout ? "grab" : "pointer",
                              borderRadius: 10, // ✅ 小圓角
                              boxShadow:
                                "0 10px 30px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.12) inset",
                              transform: "translateZ(0)",
                            }}
                          >
                            {/* Hover interaction */}
                            <div className="absolute inset-0 rounded-[10px] opacity-0 hover:opacity-100 transition-opacity"
                              style={{ background: "rgba(255,255,255,0.12)" }}
                            />

                            <div className="h-full w-full px-2 py-1 relative">
                              {allowLayout && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearPlacement(mode, d.id);
                                  }}
                                  className="absolute top-1 right-1 p-1 rounded-lg hover:bg-white/20"
                                  title="清除位置"
                                >
                                  <X size={14} style={{ color: rackTextColor }} />
                                </button>
                              )}

                              {/* ✅ 文字不要被燈號擋住：燈號移到右下，內容 padding-right */}
                              <div className="pr-8">
                                <div
                                  className="font-black truncate"
                                  style={{
                                    color: rackTextColor,
                                    fontSize: font1,
                                    lineHeight: "1.1",
                                  }}
                                >
                                  {d.deviceId} | {d.name}
                                </div>
                                <div
                                  className="font-bold truncate opacity-95"
                                  style={{
                                    color: rackTextColor,
                                    fontSize: font2,
                                    lineHeight: "1.1",
                                    marginTop: 2,
                                  }}
                                >
                                  {d.model || "-"}
                                </div>
                              </div>

                              <div className="absolute right-1 bottom-1">
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

      {hover && <FloatingDeviceCard d={hover.d} x={hover.x} y={hover.y} mode={mode} />}

      {addPlace && (
        <AddAndPlaceModal
          mode={mode}
          rackId={addPlace.rackId}
          startU={addPlace.u}
          onClose={() => setAddPlace(null)}
        />
      )}
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
                  <div className="text-[11px] text-[var(--muted)] mt-1">
                    admin 必須保持 Admin 權限
                  </div>
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
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5"
              >
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
                      {a.username === "admin" && (
                        <div className="text-xs text-[var(--muted)]">admin 不能刪除</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--muted)]">
                        {a.role === "admin" ? "Admin" : "Vendor"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
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
                            a.username === "admin"
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-white/5 text-red-300"
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
          新增帳號可選 Admin / Vendor；Vendor 只能查看（不可拖放/不可新增刪除匯入），但可切換搬遷後燈號。
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
          <h1 className="text-base md:text-lg font-black tracking-tight">
            SET機房搬遷專案管理
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={toggleFs}
            className="p-2 hover:bg-white/5 rounded-xl"
            title={isFs ? "離開全螢幕" : "全螢幕"}
          >
            {isFs ? <Minimize size={18} /> : <Expand size={18} />}
          </button>

          <select
            value={themeStyle}
            onChange={(e) => setThemeStyle(e.target.value as ThemeStyle)}
            className="bg-[var(--panel2)] border border-[var(--border)] rounded-lg text-xs px-2 py-1 outline-none hidden sm:block"
            title="佈景主題"
          >
            <option value="neon">Neon（保留）</option>
            <option value="holo">Holo AI</option>
            <option value="glass">Glass AI</option>
            <option value="midnightAI">Midnight AI</option>
          </select>

          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-white/5 rounded-xl"
            title="切換深/淺色"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-black/10">
            <User size={16} className="text-[var(--muted)]" />
            <span className="text-sm font-bold">{userName || "-"}</span>
            <span className="text-xs px-2 py-0.5 rounded-lg border border-[var(--border)] text-[var(--muted)]">
              {role === "admin" ? "Admin" : "Vendor"}
            </span>
            <button
              onClick={logout}
              className="ml-1 p-1 rounded-lg hover:bg-white/10"
              title="登出"
            >
              <LogOut size={16} className="text-[var(--muted)]" />
            </button>
          </div>

          <button
            onClick={logout}
            className="md:hidden p-2 hover:bg-white/5 rounded-xl"
            title="登出"
          >
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
            className={`p-2 rounded-lg ${
              page === item.id
                ? "text-[var(--accent)] bg-[var(--panel2)]"
                : "text-[var(--muted)]"
            }`}
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
