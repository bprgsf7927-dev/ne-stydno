# -*- coding: utf-8 -*-
"""Дописывает Историю России (tools/content_rossiya.py) в content/srednie-veka-6/content.xlsx.
Повторный запуск безопасен: старые строки России (topic r…) сначала удаляются.
Запуск: python3 tools/add_rossiya.py && python3 tools/xlsx2json.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from openpyxl import load_workbook
import content_rossiya as R

P = os.path.join(os.path.dirname(__file__), "..", "content", "srednie-veka-6", "content.xlsx")
wb = load_workbook(P)

def clear(ws, col):
    for i in range(ws.max_row, 1, -1):
        v = ws.cell(i, col).value
        if v is not None and str(v).startswith(("r", "R")): ws.delete_rows(i)

def put(name, rows, tcol=2):
    ws = wb[name]; clear(ws, tcol)
    for i, r in enumerate(rows): ws.append([1001 + i, *r])

ws = wb["Параграфы"]; clear(ws, 1)
for tid, par, title in R.TOPICS:
    ch = next(c[0] for c in R.CHAPTERS if tid in c[4])
    ws.append([tid, par, ch, title, "История России"])

put("Даты", [(t, d, y, c, e, p, term, h, at, a, m, ck) for (t, d, y, c, e, p, term, h, at, a, m, ck) in R.DATES])
put("Термины", R.TERMS)
put("Персоналии", R.PERSONS)
put("Причины", R.CAUSES)
put("Тексты", [(t, x, "|".join(a), "|".join(e)) for t, x, a, e in R.CLOZE])
put("Правда-ложь", [(t, s, "да" if v else "нет", n) for t, s, v, n in R.TRUEFALSE])

ws = wb["Главы"]
if ws.cell(1, 4).value != "book":
    ws.cell(1, 4, "book"); ws.cell(1, 5, "num")
    for i in range(2, ws.max_row + 1):
        ws.cell(i, 4, "Всеобщая история"); ws.cell(i, 5, ws.cell(i, 1).value)
clear(ws, 1)
for cid, num, book, title, topics in R.CHAPTERS:
    ws.append([cid, title, ",".join(topics), book, num])

lg = wb["Легенда"]
for r in lg.iter_rows(min_row=2):
    if r[0].value == "Главы":
        r[1].value = "Какие параграфы в какой главе. book — учебник (Всеобщая история / История России), num — номер главы в учебнике. Порядок строк = порядок курса"
wb.save(P); print("ok", len(R.TOPICS), "параграфов,", len(R.DATES), "дат")
