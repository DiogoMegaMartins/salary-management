/**
 * Gerador mínimo de PDF a partir de Markdown simples (títulos, parágrafos, citações, tabelas e linhas).
 * Sem dependências: escreve PDF 1.4 com Helvetica e codificação WinAnsi (cobre o português e o euro).
 * Serve o relatório mensal; não pretende ser um conversor de Markdown completo.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const CONTENT_W = PAGE_W - 2 * MARGIN;

/* larguras da Helvetica (em milésimos de em) para os caracteres ASCII 32..126 */
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Caracteres fora do ASCII que existem na WinAnsi (Windows-1252), com o seu código. */
const WIN_ANSI: Record<string, number> = {
  "€": 0x80, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99,
};

/** Substituições para o que a WinAnsi não tem. */
function clean(s: string): string {
  return s
    .replace(/⚠️?/g, "(!)")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/→/g, "->")
    .replace(/ | /g, " ");
}

/** Remove a marcação Markdown em linha (negrito, itálico, código, ligações). */
function inline(s: string): string {
  return clean(s)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[\s(])_(.+?)_(?=[\s).,;:]|$)/g, "$1$2")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1");
}

function codeOf(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c >= 32 && c < 127) return c;
  if (WIN_ANSI[ch] != null) return WIN_ANSI[ch];
  if (c >= 0xa0 && c <= 0xff) return c;
  return 0x3f; // ?
}

/** String PDF em ASCII puro: parênteses e barra com escape, bytes altos em octal. */
function pdfString(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = codeOf(ch);
    if (c === 0x28 || c === 0x29 || c === 0x5c) out += "\\" + String.fromCharCode(c);
    else if (c >= 32 && c < 127) out += String.fromCharCode(c);
    else out += "\\" + c.toString(8).padStart(3, "0");
  }
  return `(${out})`;
}

function charWidth(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c >= 32 && c < 127) return HELV[c - 32];
  if (ch === "—") return 1000;
  if (ch === "–") return 556;
  if (ch === "•") return 350;
  if (ch === "€") return 556;
  if (ch === "…") return 1000;
  if (c >= 0xc0 && c <= 0xff) return 556; // letras acentuadas: largura da letra base (aprox.)
  return 556;
}

type Font = "F1" | "F2" | "F3"; // normal, negrito, itálico

function textWidth(s: string, size: number, font: Font = "F1"): number {
  let w = 0;
  for (const ch of s) w += charWidth(ch);
  return (w / 1000) * size * (font === "F2" ? 1.05 : 1);
}

function wrap(text: string, width: number, size: number, font: Font): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (textWidth(next, size, font) <= width || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function fit(text: string, width: number, size: number, font: Font): string {
  if (textWidth(text, size, font) <= width) return text;
  let t = text;
  while (t.length > 1 && textWidth(t + "…", size, font) > width) t = t.slice(0, -1);
  return t + "…";
}

type Page = string[];

export function markdownToPdf(md: string, opts: { title?: string; footer?: string } = {}): Uint8Array {
  const pages: Page[] = [[]];
  let y = MARGIN; // topo para baixo
  const num = (n: number) => n.toFixed(2);
  const page = () => pages[pages.length - 1];
  const ensure = (h: number) => {
    if (y + h > PAGE_H - MARGIN - 14) { pages.push([]); y = MARGIN; }
  };
  const text = (x: number, baseline: number, s: string, font: Font, size: number, gray = 0) =>
    page().push(`${gray} g BT /${font} ${size} Tf ${num(x)} ${num(PAGE_H - baseline)} Td ${pdfString(s)} Tj ET`);
  const rule = (x1: number, x2: number, at: number, gray = 0.75, w = 0.6) =>
    page().push(`${gray} G ${w} w ${num(x1)} ${num(PAGE_H - at)} m ${num(x2)} ${num(PAGE_H - at)} l S`);
  const vbar = (x: number, top: number, bottom: number) =>
    page().push(`0.6 G 1.5 w ${num(x)} ${num(PAGE_H - top)} m ${num(x)} ${num(PAGE_H - bottom)} l S`);

  const lines = md.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) { y += 6; continue; }

    if (/^---+\s*$/.test(raw)) { ensure(10); y += 4; rule(MARGIN, PAGE_W - MARGIN, y); y += 8; continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(raw);
    if (h) {
      const level = h[1].length;
      const size = level === 1 ? 18 : level === 2 ? 13 : 11;
      const t = inline(h[2]);
      const ls = wrap(t, CONTENT_W, size, "F2");
      ensure(ls.length * (size + 4) + 8);
      y += level === 1 ? 4 : 8;
      for (const l of ls) { y += size; text(MARGIN, y, l, "F2", size); y += 4; }
      if (level === 2) { rule(MARGIN, PAGE_W - MARGIN, y + 1); y += 5; }
      continue;
    }

    if (raw.trimStart().startsWith("|")) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) block.push(lines[i++]);
      i--;
      const cells = block
        .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim())))
        .filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      if (cells.length === 0) continue;
      const cols = Math.max(...cells.map((r) => r.length));
      const size = 9;
      const natural = Array.from({ length: cols }, (_, c) =>
        Math.max(...cells.map((r, ri) => textWidth(r[c] ?? "", size, ri === 0 ? "F2" : "F1"))) + 14,
      );
      const total = natural.reduce((a, b) => a + b, 0);
      const scale = total > CONTENT_W ? CONTENT_W / total : 1;
      const widths = natural.map((w) => Math.max(36, w * scale));
      const sum = widths.reduce((a, b) => a + b, 0);
      const k = sum > CONTENT_W ? CONTENT_W / sum : 1;
      const colW = widths.map((w) => w * k);
      cells.forEach((row, ri) => {
        ensure(16);
        y += 11;
        let x = MARGIN;
        for (let c = 0; c < cols; c++) {
          const font: Font = ri === 0 ? "F2" : "F1";
          const t = fit(row[c] ?? "", colW[c] - 8, size, font);
          const tx = c === 0 ? x + 2 : x + colW[c] - 6 - textWidth(t, size, font);
          text(tx, y, t, font, size);
          x += colW[c];
        }
        y += 4;
        rule(MARGIN, PAGE_W - MARGIN, y, ri === 0 ? 0.4 : 0.88, ri === 0 ? 0.9 : 0.5);
      });
      y += 4;
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(raw);
    if (quote) {
      const ls = wrap(inline(quote[1]), CONTENT_W - 14, 10, "F3");
      ensure(ls.length * 13 + 4);
      const top = y + 2;
      for (const l of ls) { y += 13; text(MARGIN + 12, y, l, "F3", 10, 0.25); }
      vbar(MARGIN + 3, top, y + 3);
      y += 4;
      continue;
    }

    const ls = wrap(inline(raw), CONTENT_W, 10, "F1");
    ensure(ls.length * 13);
    for (const l of ls) { y += 13; text(MARGIN, y, l, "F1", 10); }
  }

  /* rodapé com o número da página */
  const total = pages.length;
  pages.forEach((p, idx) => {
    const label = `${opts.footer ?? ""}${opts.footer ? "  ·  " : ""}Página ${idx + 1} de ${total}`;
    const w = textWidth(clean(label), 8);
    p.push(`0.45 g BT /F1 8 Tf ${num((PAGE_W - w) / 2)} ${num(26)} Td ${pdfString(clean(label))} Tj ET`);
  });

  /* montagem do ficheiro (tudo ASCII, por isso o comprimento da string é o comprimento em bytes) */
  const objs: string[] = [];
  const add = (body: string) => { objs.push(body); return objs.length; };
  add("<< /Type /Catalog /Pages 2 0 R >>"); // 1
  add(""); // 2: preenchido a seguir
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"); // 3 = F1
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"); // 4 = F2
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"); // 5 = F3
  const pageIds: number[] = [];
  for (const p of pages) {
    const stream = p.join("\n");
    const contentId = objs.length + 2;
    const pageId = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objs[1] = `<< /Type /Pages /Kids [${pageIds.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const d = new Date();
  const stamp = `D:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;
  const info = add(`<< /Title ${pdfString(clean(opts.title ?? "Relatório"))} /Producer ${pdfString("Partição do Salário")} /CreationDate (${stamp}) >>`);

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, idx) => {
    offsets.push(out.length);
    out += `${idx + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
