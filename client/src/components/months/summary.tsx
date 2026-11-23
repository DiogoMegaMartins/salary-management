export function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`tnum text-sm ${strong ? "font-semibold" : ""}`}>{value}</p>
    </div>
  );
}
