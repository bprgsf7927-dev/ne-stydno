# -*- coding: utf-8 -*-
"""Вливает авторский модуль контента (tools/content_*.py) в content/srednie-veka-6/content.xlsx.
Запуск: python3 tools/add_content.py content_rossiya   (потом python3 tools/xlsx2json.py)
Повторный запуск безопасен: строки параграфов модуля сначала удаляются.
В модуле: TOPICS, CHAPTERS, DATES, TERMS, PERSONS, CAUSES, CLOZE, TRUEFALSE;
необязательно ID_BASE (по умолчанию 1001) и CHAPTER_POS ('start' — главы в начало курса, 'end' — в конец)."""
import os, sys, importlib
sys.path.insert(0, os.path.dirname(__file__))
from openpyxl import load_workbook

M = importlib.import_module(sys.argv[1])
BASE = getattr(M, "ID_BASE", 1001)
POS = getattr(M, "CHAPTER_POS", "end")
TIDS = {t[0] for t in M.TOPICS}
CIDS = {c[0] for c in M.CHAPTERS}
P = os.path.join(os.path.dirname(__file__), "..", "content", "srednie-veka-6", "content.xlsx")
wb = load_workbook(P)

def clear(ws, col, keys):
    for i in range(ws.max_row, 1, -1):
        if str(ws.cell(i, col).value) in keys: ws.delete_rows(i)

def put(name, rows):
    ws = wb[name]; clear(ws, 2, TIDS)
    for i, r in enumerate(rows): ws.append([BASE + i, *r])

ws = wb["Параграфы"]; clear(ws, 1, TIDS)
for tid, par, title in M.TOPICS:
    c = next(c for c in M.CHAPTERS if tid in c[4])
    ws.append([tid, par, c[0], title, c[2]])

put("Даты", M.DATES)
put("Термины", M.TERMS)
put("Персоналии", M.PERSONS)
put("Причины", M.CAUSES)
put("Тексты", [(t, x, "|".join(a), "|".join(e)) for t, x, a, e in M.CLOZE])
put("Правда-ложь", [(t, s, "да" if v else "нет", n) for t, s, v, n in M.TRUEFALSE])

ws = wb["Главы"]
if ws.cell(1, 4).value != "book":
    ws.cell(1, 4, "book"); ws.cell(1, 5, "num")
    for i in range(2, ws.max_row + 1):
        ws.cell(i, 4, "Всеобщая история"); ws.cell(i, 5, ws.cell(i, 1).value)
clear(ws, 1, CIDS)
new = [[cid, title, ",".join(topics), book, num] for cid, num, book, title, topics in M.CHAPTERS]
if POS == "start":
    ws.insert_rows(2, len(new))
    for i, r in enumerate(new):
        for j, v in enumerate(r): ws.cell(2 + i, 1 + j, v)
else:
    for r in new: ws.append(r)

wb.save(P); print("ok", sys.argv[1], len(M.TOPICS), "параграфов,", len(M.DATES), "дат")
