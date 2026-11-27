/** Only operations with explicit local projection and server validation may be queued. */
export type OfflineOp = { method: string; url: string; data: any; localId: number };
export function supportsOffline(method: string, url: string) {
  return (method === "PATCH" && /^\/api\/months\/\d+$/.test(url)) ||
    (method === "PUT" && (url === "/api/allocations" || /^\/api\/months\/\d+\/parcels\/\d+\/distribution(?:\/\d+\/assets)?$/.test(url))) ||
    (method === "POST" && url === "/api/transactions");
}
export function projectOffline(state: any, op: OfflineOp) {
  const d = op.data;
  const parts = op.url.split("/");
  const monthId = op.url === "/api/allocations" || op.url === "/api/transactions" ? Number(d.monthId) : Number(parts[3]);
  const month = state.months.find((m: any) => m.id === monthId);
  if (!month) throw new Error("Mês não encontrado na cópia offline.");
  if (month.status === "fechado") throw new Error("Mês fechado. Reabre-o online antes de editar.");
  if (op.method === "PATCH") {
    if ("status" in d || "carryIn" in d || "id" in d) throw new Error("Estado e transporte exigem ligação.");
    Object.assign(month, d);
    return month;
  }
  if (op.url === "/api/allocations") {
    if (!["fixo", "percentagem"].includes(d.mode) || !Number.isFinite(d.value) || d.value < 0) throw new Error("Valor de divisão inválido.");
    if (!state.parcels.some((p: any) => p.id === d.parcelId)) throw new Error("Parcela inválida.");
    let a = state.allocations.find((a: any) => a.monthId === monthId && a.parcelId === d.parcelId);
    if (!a) { a = { id: op.localId, ...d }; state.allocations.push(a); } else Object.assign(a, d);
    return a;
  }
  if (op.url === "/api/transactions") {
    if (d.type !== "expense" || !Number.isFinite(d.value) || d.value <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error("Offline permite registar despesas válidas; outros movimentos exigem ligação.");
    // como no servidor: a data decide o mês. Se o mês dessa data não existe ou está fechado, recusa-se já aqui;
    // senão a operação ficava na fila e bloqueava a sincronização (e todas as escritas) para sempre.
    const [y, mo] = String(d.date).split("-").map(Number);
    if (month.year !== y || month.month !== mo) {
      const target = state.months
        .filter((m: any) => m.year === y && m.month === mo)
        .sort((a: any, b: any) => Number(a.status === "fechado") - Number(b.status === "fechado") || a.id - b.id)[0];
      if (!target) throw new Error(`Não existe o mês ${String(mo).padStart(2, "0")}/${y}. Cria esse mês (com ligação) antes de usar esta data.`);
      if (target.status === "fechado") throw new Error("O mês da data indicada está fechado. Reabre-o online antes de registar.");
      d.monthId = target.id;
    }
    const row = { ...d, id: op.localId, createdAt: new Date().toISOString() };
    state.transactions.push(row);
    return row;
  }
  const parcelId = Number(parts[5]);
  const allocation = state.allocations.find((a: any) => a.monthId === monthId && a.parcelId === parcelId);
  if (!allocation || !Array.isArray(d.lines)) throw new Error("Guarda a alocação antes de distribuir.");
  if (parts[8] === "assets") {
    const platformId = Number(parts[7]);
    state.allocationAssets = state.allocationAssets.filter((a: any) => a.allocationId !== allocation.id || a.platformId !== platformId);
    const rows = d.lines.map((line: any, i: number) => ({ ...line, id: op.localId - i, allocationId: allocation.id, platformId, position: i }));
    state.allocationAssets.push(...rows);
    return rows;
  }
  state.allocationPlatforms = state.allocationPlatforms.filter((a: any) => a.allocationId !== allocation.id);
  const rows = d.lines.map((line: any, i: number) => ({ ...line, id: op.localId - i, allocationId: allocation.id, position: i }));
  state.allocationPlatforms.push(...rows);
  return rows;
}
