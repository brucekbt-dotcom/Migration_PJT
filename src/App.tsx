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

type PlacementDraft = {
  mode: PlacementMode;
  rackId: string;
  startU: number;
};

// -----------------------------
// Constants / Mock
// -----------------------------

const LS = {
  theme: "migrate.theme",
  themeStyle: "migrate.themeStyle",
  devices: "migrate.devices",
  ui: "migrate.ui",
} as const;

type UiState = { sideCollapsed: boolean; afterPanelCollapsed: boolean };
const DEFAULT_UI: UiState = { sideCollapsed: false, afterPanelCollapsed: false };

const mockRacks: Rack[] = [
  ...["A1", "A2", "A3", "A4", "A5", "A6"].map((n) => ({
    id: n,
    name: n,
    units: 42,
  })),
  ...["B1", "B2", "B3", "B4", "B5", "B6"].map((n) => ({
    id: n,
    name: n,
    units: 42,
  })),
  ...["HUB 15A", "HUB 15B", "HUB 16A", "HUB 16B", "HUB 17A", "HUB 17B"].map(
    (n) => ({ id: n, name: n, units: 42 })
  ),
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
    ip: "10.0.0.1",
    serial: "",
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
    serial: "",
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
    serial: "",
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
// Store
// -----------------------------

interface Store {
  racks: Rack[];
  devices: Device[];
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  page: PageKey;
  selectedDeviceId: string | null;
  ui: UiState;
  // actions
  setPage: (p: PageKey) => void;
  toggleTheme: () => void;
  setThemeStyle: (s: ThemeStyle) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setUi: (patch: Partial<UiState>) => void;
  addDevice: (draft: DeviceDraft) => string; // returns new id
  updateDevice: (id: string, patch: Partial<DeviceDraft>) => void;
  deleteDevice: (id: string) => void;
  clearPlacement: (mode: PlacementMode, id: string) => void;
  place: (
    mode: PlacementMode,
    deviceId: string,
    rackId: string,
    startU: number
  ) => { ok: boolean; message?: string };
  setMigrationFlag: (id: string, patch: Partial<MigrationFlags>) => void;
}

const useStore = create<Store>((set, get) => ({
  racks: mockRacks,
  devices: normalizeDevices(readJson<Device[]>(LS.devices, mockDevices)),
  theme: (localStorage.getItem(LS.theme) as ThemeMode) || "dark",
  themeStyle: (localStorage.getItem(LS.themeStyle) as ThemeStyle) || "neon",
  page: "dashboard",
  selectedDeviceId: null,
  ui: { ...DEFAULT_UI, ...readJson<UiState>(LS.ui, DEFAULT_UI) },

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
          migration: {
            racked: false,
            cabled: false,
            powered: false,
            tested: false,
          },
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

  deleteDevice: (id) =>
    set((s) => {
      const next = s.devices.filter((d) => d.id !== id);
      writeJson(LS.devices, next);
      return {
        devices: next,
        selectedDeviceId:
          s.selectedDeviceId === id ? null : s.selectedDeviceId,
      };
    }),

  clearPlacement: (mode, id) =>
    set((s) => {
      const next = s.devices.map((d) => {
        if (d.id !== id) return d;
        return mode === "before"
          ? {
              ...d,
              beforeRackId: undefined,
              beforeStartU: undefined,
              beforeEndU: undefined,
            }
          : {
              ...d,
              afterRackId: undefined,
              afterStartU: undefined,
              afterEndU: undefined,
            };
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
      return (
        rId === rackId &&
        s != null &&
        e != null &&
        rangesOverlap(sU, eU, s, e)
      );
    });

    if (collision)
      return {
        ok: false,
        message: `位置衝突: ${collision.deviceId} ${collision.name}`,
      };

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
        d.id === id
          ? { ...d, migration: { ...d.migration, ...patch } }
          : d
      );
      writeJson(LS.devices, next);
      return { devices: next };
    }),
}));

// -----------------------------
// Theme tokens
// -----------------------------

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
return <style>{`${css.light}\n${css.dark}`}</style>;
};

// -----------------------------
// Tiny UI pieces
// -----------------------------

const Lamp = ({ on }: { on: boolean }) => (
  <span
    className="inline-block w-1.5 h-1.5 rounded-full"
    style={{
      backgroundColor: on ? "var(--lampOn)" : "var(--lampOff)",
      boxShadow: on
        ? "0 0 8px var(--lampOn)"
        : "0 0 8px rgba(239,68,68,0.35)",
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

function useApplyTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
}

// -----------------------------
// CSV
// -----------------------------

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
  ];
  const esc = (v: any) => {
    const s = String(v ?? "");
const needs =
  s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
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

  const csv =
    headers.join(",") + "
" + rows.map((r) => r.map(esc).join(",")).join("
");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devices_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -----------------------------
// Modals
// -----------------------------

function ModalShell({
  title,
  children,
  onClose,
  widthClass = "max-w-3xl",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full ${widthClass} rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl`}
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
          <div className="mt-4">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}

function DeviceEditModal({
  title,
  racks,
  initial,
  placement,
  onClose,
  onSave,
}: {
  title: string;
  racks: Rack[];
  initial: DeviceDraft;
  placement?: PlacementDraft;
  onClose: () => void;
  onSave: (d: DeviceDraft, place?: PlacementDraft) => void;
}) {
  const [d, setD] = useState<DeviceDraft>(initial);
  const [pl, setPl] = useState<PlacementDraft | undefined>(placement);
  const portsOptions = [8, 16, 24, 48, 72];

  const input = (k: keyof DeviceDraft) => (e: any) =>
    setD((p) => ({ ...p, [k]: e.target.value } as any));

  return (
    <ModalShell title={title} onClose={onClose}>
      <form
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!d.deviceId.trim() || !d.name.trim()) {
            alert("請填寫設備編號與設備名稱");
            return;
          }
          const next: DeviceDraft = {
            ...d,
            ports: Number(d.ports) || 0,
            sizeU: Math.max(1, Math.min(42, Number(d.sizeU) || 1)),
          };
          const nextPl =
            pl && pl.rackId
              ? {
                  ...pl,
                  startU: clampU(Number(pl.startU) || 1),
                }
              : undefined;
          onSave(next, nextPl);
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

        <div className="lg:col-span-3">
          <label className="text-xs text-[var(--muted)]">Port對接備註</label>
          <input
            className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
            value={d.portMap ?? ""}
            onChange={input("portMap")}
            placeholder="EX: Gi1/0/1 -> Firewall WAN"
          />
        </div>

        {/* placement section */}
        {pl && (
          <div className="lg:col-span-3 rounded-2xl border border-[var(--border)] bg-black/10 p-4">
            <div className="text-sm font-black text-[var(--accent)]">放置到機櫃（{pl.mode === "before" ? "搬遷前" : "搬遷後"}）</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[var(--muted)]">機櫃</label>
                <select
                  className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                  value={pl.rackId}
                  onChange={(e) => setPl((p) => (p ? { ...p, rackId: e.target.value } : p))}
                >
                  {racks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">起始U</label>
                <select
                  className="mt-1 w-full bg-[var(--panel2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none"
                  value={String(pl.startU)}
                  onChange={(e) => setPl((p) => (p ? { ...p, startU: Number(e.target.value) } : p))}
                >
                  {Array.from({ length: 42 }).map((_, i) => {
                    const u = i + 1;
                    return (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="text-xs text-[var(--muted)] flex items-end">
                會自動佔用 {d.sizeU}U（{pl.startU} ~ {clampU(pl.startU + Math.max(1, Number(d.sizeU) || 1) - 1)}）
              </div>
            </div>
          </div>
        )}

        <div className="lg:col-span-3 flex justify-end gap-3 mt-2">
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
    </ModalShell>
  );
}

function DeviceInfoModal({
  device,
  mode,
  onClose,
}: {
  device: Device;
  mode: PlacementMode;
  onClose: () => void;
}) {
  const setMigrationFlag = useStore((s) => s.setMigrationFlag);

  const Item = ({
    label,
    value,
  }: {
    label: string;
    value: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="text-sm font-bold text-[var(--text)] text-right">{value}</div>
    </div>
  );

  const Toggle = ({
    label,
    k,
    disabled,
  }: {
    label: string;
    k: keyof MigrationFlags;
    disabled?: boolean;
  }) => {
    const on = device.migration[k];
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setMigrationFlag(device.id, { [k]: !on } as any)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed border-white/10"
            : on
            ? "border-[var(--lampOn)] bg-black/20"
            : "border-[var(--border)] hover:bg-white/5"
        }`}
      >
        <div className="text-sm font-extrabold">{label}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">{on ? "是" : "否"}</span>
          <Lamp on={on} />
        </div>
      </button>
    );
  };

  const before =
    device.beforeRackId && device.beforeStartU != null
      ? `${device.beforeRackId} ${device.beforeStartU}-${device.beforeEndU}U`
      : "-";
  const after =
    device.afterRackId && device.afterStartU != null
      ? `${device.afterRackId} ${device.afterStartU}-${device.afterEndU}U`
      : "-";

  return (
    <ModalShell title={`設備資訊 · ${device.deviceId}`} onClose={onClose} widthClass="max-w-xl">
      <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-black truncate">{device.name}</div>
            <div className="text-sm text-[var(--muted)] truncate">{device.brand} · {device.model} · {device.ports} Ports · {device.sizeU}U</div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-extrabold px-2 py-1 rounded-md border"
              style={{
                color: catColorVar(device.category),
                borderColor: `${catColorVar(device.category)}44`,
                backgroundColor: `${catColorVar(device.category)}11`,
              }}
            >
              {device.category}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <Item label="設備IP" value={device.ip || "-"} />
          <Item label="序號" value={device.serial || "-"} />
          <Item label="Port對接" value={device.portMap || "-"} />
          <Item label="搬遷前位置" value={before} />
          <Item label="搬遷後位置" value={after} />
          <div className="pt-3">
            <div className="text-xs text-[var(--muted)] mb-2">搬遷狀態（僅搬遷後頁可切換）</div>
            <div className="grid grid-cols-1 gap-2">
              <Toggle label="已上架" k="racked" disabled={mode !== "after"} />
              <Toggle label="已接線" k="cabled" disabled={mode !== "after"} />
              <Toggle label="已開機" k="powered" disabled={mode !== "after"} />
              <Toggle label="已測試" k="tested" disabled={mode !== "after"} />
            </div>
            <div className="mt-3 text-xs text-[var(--muted)]">
              4 顆燈全綠才代表搬遷完成。
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
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
    {
      name: "Network",
      count: devices.filter((d) => d.category === "Network").length,
      fill: "var(--catNetwork)",
    },
    {
      name: "Storage",
      count: devices.filter((d) => d.category === "Storage").length,
      fill: "var(--catStorage)",
    },
    {
      name: "Server",
      count: devices.filter((d) => d.category === "Server").length,
      fill: "var(--catServer)",
    },
    {
      name: "Other",
      count: devices.filter((d) => d.category === "Other").length,
      fill: "var(--catOther)",
    },
  ];

  const stats = [
    { label: "總設備數", value: devices.length, icon: <Server size={20} /> },
    {
      label: "已定位(搬遷後)",
      value: placedAfter,
      icon: <ArrowRightLeft size={20} />,
    },
    {
      label: "搬遷完成",
      value: completed,
      icon: <CheckCircle2 size={20} />,
    },
    {
      label: "待處理",
      value: Math.max(0, devices.length - completed),
      icon: <AlertCircle size={20} />,
    },
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
            <li>1) 到「設備管理」新增/編輯設備（Ports、IP、序號、占用 U）。</li>
            <li>2) 在「搬遷前/後」從左側清單拖拉設備到機櫃（可再拖拉調整）。</li>
            <li>3) 點機櫃內設備看詳細；在「搬遷後」可切換 4 顆狀態燈。</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// -----------------------------
// Devices Page
// -----------------------------

const DevicesPage = () => {
  const racks = useStore((s) => s.racks);
  const devices = useStore((s) => s.devices);
  const addDevice = useStore((s) => s.addDevice);
  const updateDevice = useStore((s) => s.updateDevice);
  const deleteDevice = useStore((s) => s.deleteDevice);
  const clearPlacement = useStore((s) => s.clearPlacement);

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">設備資產清單</h2>
          <p className="text-[var(--muted)] text-sm">
            新增/編輯/刪除設備；刪除會同步移除搬遷前與搬遷後機櫃配置。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadCSV(devices)}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
          >
            <Download size={16} /> CSV
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
                <tr
                  key={d.id}
                  className="hover:bg-white/[0.02] transition-colors group"
                >
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
                            deleteDevice(d.id);
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
                <td
                  colSpan={8}
                  className="px-6 py-10 text-center text-[var(--muted)]"
                >
                  目前沒有設備，請先新增。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <DeviceEditModal
          title="新增設備"
          racks={racks}
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
          racks={racks}
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

// -----------------------------
// Rack Planner
// -----------------------------

type HoverInfo = {
  x: number;
  y: number;
  device: Device;
  mode: PlacementMode;
};

const RackPlanner = ({ mode }: { mode: PlacementMode }) => {
  const racks = useStore((s) => s.racks);
  const devices = useStore((s) => s.devices);
  const place = useStore((s) => s.place);
  const clearPlacement = useStore((s) => s.clearPlacement);
  const addDevice = useStore((s) => s.addDevice);
  const updateDevice = useStore((s) => s.updateDevice);

  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [detail, setDetail] = useState<Device | null>(null);
  const [addFromU, setAddFromU] = useState<{ rackId: string; startU: number } | null>(null);

  // 4 rows like requested
  const rows = useMemo(
    () => [
      racks.slice(0, 6),
      racks.slice(6, 12),
      racks.slice(12, 18),
      racks.slice(18, 19),
    ],
    [racks]
  );

  const listForRack = (rackId: string) =>
    devices
      .filter((d) =>
        mode === "before" ? d.beforeRackId === rackId : d.afterRackId === rackId
      )
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

  const U_H = 22; // bigger U height

  const getBlockStyle = (d: Device) => {
    const sU = (mode === "before" ? d.beforeStartU : d.afterStartU) ?? 1;
    const eU = (mode === "before" ? d.beforeEndU : d.afterEndU) ?? sU;
    const start = clampU(Math.min(sU, eU));
    const end = clampU(Math.max(sU, eU));
    const height = (end - start + 1) * U_H;
    const bottom = (start - 1) * U_H;
    return { bottom, height, start, end };
  };

  const getDeviceAt = (rackId: string, u: number) => {
    return devices.find((d) => {
      const rId = mode === "before" ? d.beforeRackId : d.afterRackId;
      const s = mode === "before" ? d.beforeStartU : d.afterStartU;
      const e = mode === "before" ? d.beforeEndU : d.afterEndU;
      return rId === rackId && s != null && e != null && u >= s && u <= e;
    });
  };

  const onDrop = (e: React.DragEvent, rackId: string, u: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const res = place(mode, id, rackId, u);
    if (!res.ok) alert(res.message);
  };

  const unplaced = useMemo(() => {
    return devices.filter((d) => {
      const hasBefore = d.beforeRackId && d.beforeStartU != null;
      const hasAfter = d.afterRackId && d.afterStartU != null;
      return mode === "before" ? !hasBefore : !hasAfter;
    });
  }, [devices, mode]);

  const rightCollapsed = mode === "after" && ui.afterPanelCollapsed;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--accent)]">
            {mode === "before" ? "搬遷前" : "搬遷後"} 機櫃佈局
          </h2>
          <p className="text-[var(--muted)] text-sm">
            左側拖拉設備到機櫃；已放置設備也可再拖拉調整位置（含 U 重疊檢查）
          </p>
        </div>

        {mode === "after" && (
          <button
            onClick={() => setUi({ afterPanelCollapsed: !ui.afterPanelCollapsed })}
            className="px-3 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center gap-2"
          >
            {ui.afterPanelCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
            右側狀態
          </button>
        )}
      </div>

      <div className={`grid gap-6 ${mode === "after" ? (rightCollapsed ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[320px_1fr_320px]") : "grid-cols-1 xl:grid-cols-[320px_1fr]"}`}>
        {/* Left palette */}
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-black/20 flex items-center justify-between">
            <div>
              <div className="text-sm font-black text-[var(--accent)]">設備清單</div>
              <div className="text-xs text-[var(--muted)]">未放置（{unplaced.length}）</div>
            </div>
            <button
              onClick={() => setAddFromU({ rackId: racks[0]?.id || "A1", startU: 1 })}
              className="px-3 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold hover:opacity-90 flex items-center gap-2"
            >
              <Plus size={16} /> 新增
            </button>
          </div>
          <div className="p-3 space-y-2 max-h-[calc(100vh-220px)] overflow-auto">
            {unplaced.length === 0 && (
              <div className="text-sm text-[var(--muted)] p-3 rounded-xl border border-[var(--border)]">
                目前沒有未放置設備。
              </div>
            )}
            {unplaced.map((d) => (
              <div
                key={d.id}
                draggable
                onDragStart={(ev) => {
                  ev.dataTransfer.setData("text/plain", d.id);
                  ev.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => setDetail(d)}
                className="p-3 rounded-2xl border border-[var(--border)] bg-black/10 hover:bg-white/5 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black truncate">{d.deviceId}</div>
                    <div className="text-xs text-[var(--muted)] truncate">{d.name}</div>
                    <div className="text-[11px] text-[var(--muted)] truncate mt-1">{d.brand} · {d.model} · {d.sizeU}U</div>
                  </div>
                  <span
                    className="text-[10px] font-extrabold px-2 py-1 rounded-md border shrink-0"
                    style={{
                      color: catColorVar(d.category),
                      borderColor: `${catColorVar(d.category)}44`,
                      backgroundColor: `${catColorVar(d.category)}11`,
                    }}
                  >
                    {d.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Racks */}
        <div className="space-y-6 min-w-0">
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
                  <div className="bg-black/30 text-[var(--accent)] text-center py-2 font-mono text-sm border-b border-[var(--border)]">
                    {rack.name}
                  </div>

                  <div className="p-3">
                    <div className="flex gap-2">
                      {/* Left scale 1~42 */}
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
                            const occ = getDeviceAt(rack.id, u);
                            return (
                              <div
                                key={u}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => onDrop(e, rack.id, u)}
                                onClick={() => {
                                  if (occ) setDetail(occ);
                                  else setAddFromU({ rackId: rack.id, startU: u });
                                }}
                                className="relative cursor-pointer"
                                style={{ height: U_H }}
                              >
                                <div className="absolute inset-x-0 top-0 h-px bg-white/15" />
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
                              onDragStart={(ev) => {
                                ev.dataTransfer.setData("text/plain", d.id);
                                ev.dataTransfer.effectAllowed = "move";
                              }}
                              onMouseEnter={(ev) => {
                                const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                                setHover({ x: rect.right + 10, y: rect.top, device: d, mode });
                              }}
                              onMouseLeave={() => setHover(null)}
                              onClick={() => setDetail(d)}
                              className="absolute left-1 right-1 border border-white/70 text-white cursor-pointer select-none"
                              style={{
                                bottom,
                                height,
                                backgroundColor: catColor,
                              }}
                            >
                              <div className="h-full w-full px-2 py-1 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-black truncate">{d.deviceId}</div>
                                  <div className="text-[10px] opacity-95 truncate">{d.name}</div>
                                </div>
                                <div className="mt-0.5">
                                  <Lamps m={d.migration} />
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearPlacement(mode, d.id);
                                }}
                                className="absolute top-1 right-1 p-1 rounded-md bg-black/25 hover:bg-black/40 text-white opacity-80 hover:opacity-100"
                                title="移除"
                              >
                                <X size={14} />
                              </button>
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

        {/* Right panel (after only) */}
        {mode === "after" && !rightCollapsed && (
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] bg-black/20">
              <div className="text-sm font-black text-[var(--accent)]">搬遷狀態</div>
              <div className="text-xs text-[var(--muted)]">點設備可切換 4 顆燈（全綠=完成）</div>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-4">
                <div className="text-xs text-[var(--muted)]">已定位（搬遷後）</div>
                <div className="text-2xl font-black text-[var(--text)]">
                  {devices.filter((d) => d.afterRackId).length} / {devices.length}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-4">
                <div className="text-xs text-[var(--muted)]">搬遷完成</div>
                <div className="text-2xl font-black text-[var(--text)]">
                  {devices.filter((d) => isMigratedComplete(d.migration)).length}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-4">
                <div className="text-xs text-[var(--muted)]">尚未搬遷</div>
                <div className="text-2xl font-black text-[var(--text)]">
                  {devices.filter((d) => !isMigratedComplete(d.migration)).length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* hover tooltip */}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="bg-[var(--panel2)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 w-72">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black truncate">{hover.device.deviceId}</div>
                <div className="text-xs text-[var(--muted)] truncate">{hover.device.name}</div>
              </div>
              <span
                className="text-[10px] font-extrabold px-2 py-1 rounded-md border shrink-0"
                style={{
                  color: catColorVar(hover.device.category),
                  borderColor: `${catColorVar(hover.device.category)}44`,
                  backgroundColor: `${catColorVar(hover.device.category)}11`,
                }}
              >
                {hover.device.category}
              </span>
            </div>
            <div className="mt-2 text-xs text-[var(--muted)]">
              {hover.device.brand} · {hover.device.model} · {hover.device.ports} Ports · {hover.device.sizeU}U
            </div>
          </div>
        </div>
      )}

      {/* detail modal */}
      {detail && (
        <DeviceInfoModal
          device={detail}
          mode={mode}
          onClose={() => setDetail(null)}
        />
      )}

      {/* add-from-U modal */}
      {addFromU && (
        <DeviceEditModal
          title="新增設備並放置"
          racks={racks}
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
          placement={{ mode, rackId: addFromU.rackId, startU: addFromU.startU }}
          onClose={() => setAddFromU(null)}
          onSave={(draft, pl) => {
            const id = addDevice(draft);
            if (pl) {
              const res = place(pl.mode, id, pl.rackId, pl.startU);
              if (!res.ok) alert(res.message);
            }
            setAddFromU(null);
          }}
        />
      )}

      {/* edit from detail quick entry */}
      {detail && false && (
        <DeviceEditModal
          title="編輯"
          racks={racks}
          initial={{
            category: detail.category,
            deviceId: detail.deviceId,
            name: detail.name,
            brand: detail.brand,
            model: detail.model,
            ports: detail.ports,
            sizeU: detail.sizeU,
            ip: detail.ip ?? "",
            serial: detail.serial ?? "",
            portMap: detail.portMap ?? "",
          }}
          onClose={() => setDetail(null)}
          onSave={(draft) => {
            updateDevice(detail.id, draft);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
};

// -----------------------------
// App Shell
// -----------------------------

export default function App() {
  useApplyTheme();

  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const themeStyle = useStore((s) => s.themeStyle);
  const setThemeStyle = useStore((s) => s.setThemeStyle);
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);

  const navItems = [
    { id: "dashboard", label: "儀表板", icon: <LayoutDashboard size={20} /> },
    { id: "devices", label: "設備管理", icon: <Server size={20} /> },
    { id: "before", label: "搬遷前機櫃", icon: <ArrowLeftRight size={20} /> },
    { id: "after", label: "搬遷後機櫃", icon: <ArrowRightLeft size={20} /> },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-300">
      <ThemeTokens />

      {/* Top Header */}
      <header className="h-16 border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6">
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
            <option value="neon">Neon Blue</option>
            <option value="graphite">Graphite Gray</option>
            <option value="aurora">Aurora Green</option>
            <option value="circuit">Circuit Violet</option>
          </select>

          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
            title="切換深/淺色"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>

          <button
            onClick={() => setUi({ sideCollapsed: !ui.sideCollapsed })}
            className="p-2 hover:bg-white/5 rounded-full transition-colors hidden lg:inline-flex"
            title="收合側邊欄"
          >
            {ui.sideCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav
          className={`border-r border-[var(--border)] h-[calc(100vh-64px)] sticky top-16 p-4 hidden lg:block bg-[var(--panel)] transition-all ${
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
                    ? "bg-[var(--panel2)] text-[var(--accent)] border border-[var(--border)] shadow-[0_0_20px_rgba(34,211,238,0.1)] font-bold"
                    : "text-[var(--muted)] hover:bg-white/[0.03]"
                }`}
              >
                {item.icon}
                {!ui.sideCollapsed && item.label}
              </button>
            ))}
          </div>

          {!ui.sideCollapsed && (
            <div className="absolute bottom-8 left-4 right-4 p-4 rounded-2xl bg-gradient-to-br from-[var(--accent)]/10 to-transparent border border-[var(--accent)]/20">
              <div className="text-xs font-bold text-[var(--accent)] uppercase mb-1">
                提示
              </div>
              <div className="text-sm text-[var(--muted)]">
                左側可拖設備，點 U 可新增。
              </div>
            </div>
          )}
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
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-2 flex gap-6 shadow-2xl z-40">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id as PageKey)}
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
    </div>
  );
}
