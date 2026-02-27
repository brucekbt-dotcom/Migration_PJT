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
    d.beforeRackId ?? "",
    d.beforeStartU ?? "",
    d.beforeEndU ?? "",
    d.afterRackId ?? "",
    d.afterStartU ?? "",
    d.afterEndU ?? "",
    d.migration?.racked ?? false,
    d.migration?.cabled ?? false,
    d.migration?.powered ?? false,
    d.migration?.tested ?? false,
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
