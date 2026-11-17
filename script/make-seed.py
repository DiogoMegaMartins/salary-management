"""Gera server/seed.json com dados FICTÍCIOS de demonstração (primeiro arranque com base vazia).

Nada aqui corresponde a pessoas, bancos ou corretoras reais. Uso: python script/make-seed.py
"""
import json
import os

PARCELS = [
    ("Gastos Mensais", "gastos", "#d97757", "Banco Exemplo", 0),
    ("Outras Poupanças", "poupanca", "#c9a227", "", 1),
    ("Fundo de Emergência", "poupanca", "#2f9e8f", "Banco Exemplo | Corretora Exemplo", 2),
    ("Ações", "investimento", "#3b7dd8", "Corretora Exemplo", 3),
    ("ETFs", "investimento", "#7a5cd0", "Corretora Exemplo", 4),
    ("Matérias-Primas", "investimento", "#2aa7c0", "Corretora Exemplo", 5),
    ("Criptomoedas", "investimento", "#c2477f", "Corretora Exemplo | Exchange Exemplo", 6),
]

# label, mês, base, extraordinária, outros sujeitos a IRS e SS, outros sujeitos a IRS, isentos,
# taxa IRS base, taxa IRS extra, taxa SS, IRS jovem, descontos (valor do recibo), subsídio diário, dias
M2025 = [
    ("Outubro", 10, 1500, 0, 0, 0, 0, 0, 0, 0.11, "", 285.0, 7.63, 22),
    ("Novembro", 11, 1500, 0, 0, 0, 0, 0, 0, 0.11, "", 285.0, 7.63, 20),
    ("Dezembro (SN)", 12, 0, 0, 1500, 0, 0, 0, 0, 0.11, "", 330.0, 0, 0),
    ("Dezembro (SF)", 12, 1500, 0, 500, 0, 0, 0, 0, 0.11, "", 400.0, 7.63, 21),
]

M2026 = [
    ("Janeiro", 1, 1550, 0, 0, 0, 0, 0, 0, 0.11, "", 295.0, 7.63, 21),
    ("Fevereiro", 2, 1550, 0, 0, 0, 0, 0, 0, 0.11, "", 295.0, 7.63, 20),
    ("Março", 3, 1550, 0, 0, 0, 0, 0, 0, 0.11, "", 295.0, 7.63, 22),
    ("Abril", 4, 1550, 0, 0, 0, 0, 0, 0, 0.11, "", 295.0, 7.63, 20),
    ("Maio", 5, 1550, 0, 0, 0, 0, 0, 0, 0.11, "", 295.0, 7.63, 21),
    ("Junho", 6, 1550, 400, 0, 0, 0, 0, 0, 0.11, "", 360.0, 7.63, 21),
    ("Julho", 7, 1550, 0, 0, 0, 0, 0, 0, 0.11, "", 295.0, 7.63, 22),
    ("Agosto", 8, 1550, 0, 0, 0, 0, 0, 0, 0.11, "", 295.0, 7.63, 20),
]

# Divisão salarial: label -> [gastos, outras poupanças, fundo de emergência, ações, ETFs, matérias-primas, cripto]
S2025 = {
    "Outubro": [600, 50, 200, 150, 150, 0, 25],
    "Novembro": [650, 0, 200, 150, 150, 0, 25],
    "Dezembro (SN)": [500, 0, 0, 200, 0, 0, 0],
    "Dezembro (SF)": [750, 100, 250, 200, 200, 0, 50],
}
S2026 = {
    "Janeiro": [600, 50, 200, 200, 150, 25, 25],
    "Fevereiro": [610, 50, 200, 150, 150, 25, 25],
    "Março": [600, 100, 200, 150, 150, 25, 25],
    "Abril": [580, 100, 200, 150, 150, 25, 25],
    "Maio": [600, 100, 200, 150, 150, 25, 25],
    "Junho": [700, 100, 250, 200, 200, 50, 50],
    "Julho": [560, 100, 200, 150, 150, 25, 25],
    "Agosto": [600, 50, 200, 150, 150, 25, 25],
}

months = []
for year, rows, splits in ((2025, M2025, S2025), (2026, M2026, S2026)):
    for i, r in enumerate(rows):
        (label, mnum, base, extra, oss, ois, isent, tib, tie, tss, jovem, desc, md, mdays) = r
        alloc = splits.get(label, [])
        months.append(
            {
                "year": year,
                "month": mnum,
                "label": label,
                "sortOrder": i,
                "base": base,
                "extraordinaria": extra,
                "outrosIrsSs": oss,
                "outrosIrs": ois,
                "isentos": round(isent, 2),
                "taxaIrsBase": tib,
                "taxaIrsExtra": tie,
                "taxaSs": tss,
                "irsJovem": jovem,
                "descontosMode": "manual",
                "descontosManual": desc,
                "mealDaily": md,
                "mealDays": mdays,
                "notes": "",
                "allocations": [
                    {"parcelIndex": j, "mode": "fixo", "value": v} for j, v in enumerate(alloc)
                ],
            }
        )

seed = {
    "parcels": [
        {
            "name": n,
            "kind": k,
            "color": c,
            "platforms": p,
            "sortOrder": o,
            "defaultMode": "fixo",
            "defaultValue": 0,
            "targetAmount": 10000 if n == "Fundo de Emergência" else None,
            "targetDate": None,
            "archived": 0,
        }
        for (n, k, c, p, o) in PARCELS
    ],
    "months": months,
}

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "server", "seed.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(seed, f, ensure_ascii=False, indent=1)

# verificação: a divisão nunca excede o líquido do mês
for m in months:
    gross = m["base"] + m["extraordinaria"] + m["outrosIrsSs"] + m["outrosIrs"] + m["isentos"]
    net = gross - m["descontosManual"] - m["outrosIrs"]
    alloc = sum(a["value"] for a in m["allocations"])
    assert alloc <= net + 1e-9, (m["label"], alloc, net)
    print(f'{m["year"]} {m["label"]:16} liq={net:9.2f} aloc={alloc:8.2f} rest={net-alloc:8.2f}')
