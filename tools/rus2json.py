# -*- coding: utf-8 -*-
"""Русский язык: авторские модули tools/content_rus6_*.py → content/russkiy-6/*.json.
Запуск из корня репозитория: python3 tools/rus2json.py
Источник правды по русскому — сами модули (у истории — xlsx).
id параграфов в JSON с префиксом «ya» (язык): ya1, ya37 — чтобы не путаться с историей (r1 — История России).
Пустые facts/persons/causes/cloze/lessons нужны, чтобы движок истории грузился без правок."""
import os, sys, json, importlib
sys.path.insert(0, os.path.dirname(__file__))

MODULES = ["content_rus6_gl1", "content_rus6_gl2", "content_rus6_rech", "content_rus6_lex"]   # новые главы — сюда
OUT = os.path.join(os.path.dirname(__file__), "..", "content", "russkiy-6")
os.makedirs(OUT, exist_ok=True)

tid = lambda t: "ya" + t[1:]          # r37 → ya37
topics, chapters = [], []
terms, nik, why, build, pairs, tf = [], [], [], [], [], []
for name in MODULES:
    M = importlib.import_module(name)
    base = M.ID_BASE
    for ch_id, num, book, title, tlist in M.CHAPTERS:
        chapters.append({"id": ch_id, "title": title, "topics": [tid(t) for t in tlist], "book": book, "num": num})
        for t, par, ttitle in M.TOPICS:
            if t in tlist: topics.append({"id": tid(t), "paragraph": par, "chapter": ch_id, "title": ttitle, "block": ""})
    for i, (t, term, book_def, simple, ex, keys, trap) in enumerate(M.CONCEPTS):
        terms.append({"id": base + i, "topic": tid(t), "term": term, "definition": simple, "book": book_def, "example": ex, "keys": keys, "trap": trap})
    for i, (t, lines, bad, fix) in enumerate(M.NIK_ERRORS):
        nik.append({"id": base + 100 + i, "topic": tid(t), "lines": lines, "bad": bad, "fix": fix})
    for i, (t, q, ok, wrong) in enumerate(M.WHY):
        why.append({"id": base + 200 + i, "topic": tid(t), "q": q, "ok": ok, "wrong": wrong})
    for i, (t, term, blocks, extra) in enumerate(M.BUILD):
        build.append({"id": base + 300 + i, "topic": tid(t), "term": term, "blocks": blocks, "extra": extra})
    for i, (t, group, l, r) in enumerate(M.PAIRS):
        pairs.append({"id": base + 400 + i, "topic": tid(t), "group": group, "l": l, "r": r})
    for i, (t, st, v, note) in enumerate(M.TRUEFALSE):
        tf.append({"id": base + 600 + i, "topic": tid(t), "statement": st, "isTrue": v, "note": note})

chapters.sort(key=lambda c: int(c["num"]))
order = {t: i for i, c in enumerate(chapters) for t in c["topics"]}
topics.sort(key=lambda t: (order[t["id"]], int(t["id"][2:])))

def dump(name, data):
    with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(name, len(data))

dump("topics", {"course": "Русский язык, 6 класс (Баранов, Ладыженская и др.)", "topics": topics, "chapters": chapters})
dump("terms", terms); dump("nik", nik); dump("why", why); dump("build", build); dump("rpairs", pairs); dump("truefalse", tf)
for n in ["facts", "persons", "causes", "cloze", "lessons"]: dump(n, [])
