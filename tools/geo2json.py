# -*- coding: utf-8 -*-
"""Собирает content/geografia-6/*.json из tools/content_geo6.py (формат тот же, что у истории).
Запуск: python3 tools/geo2json.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import content_geo6 as G

OUT = os.path.join(os.path.dirname(__file__), "..", "content", "geografia-6")
os.makedirs(OUT, exist_ok=True)

def dump(name, data):
    with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

topics = {
    "course": G.COURSE,
    "orderGroups": {str(k): v for k, v in G.ORDER_GROUPS.items()},
    "continents": G.CONTINENTS,
    "topics": [{"id": t, "paragraph": p, "chapter": c, "title": title, "block": ""} for t, p, c, title in G.TOPICS],
    "chapters": [{"id": cid, "title": title, "topics": ts, "book": "География", "num": num, "label": label} for cid, num, label, title, ts in G.CHAPTERS],
}
dump("topics", topics)
dump("facts", [{"id": i + 1, "topic": t, "date": d, "year": y, "century": g, "event": e, "person": p, "term": term, "hook": h,
                "assoc_type": at, "assoc": a, "more": m, "check": G.CHK} for i, (t, d, y, g, e, p, term, h, at, a, m) in enumerate(G.DATES)])
dump("terms", [{"id": i + 1, "topic": t, "term": term, "definition": d} for i, (t, term, d) in enumerate(G.TERMS)])
dump("persons", [{"id": i + 1, "topic": t, "name": n, "who": w, "cont": c, "mouth": m, "countries": cs, "kind": k, "ocean": oc, "lon": lon, "lat": lat} for i, (t, n, w, c, m, cs, k, oc, lon, lat) in enumerate(G.PERSONS)])
dump("causes", [{"id": i + 1, "topic": t, "cause": c, "effect": e, "wrong": [w1, w2]} for i, (t, c, e, w1, w2) in enumerate(G.CAUSES)])
dump("cloze", [{"id": i + 1, "topic": t, "text": x, "answers": a, "extra": e} for i, (t, x, a, e) in enumerate(G.CLOZE)])
dump("truefalse", [{"id": i + 1, "topic": t, "statement": s, "isTrue": v, "note": n} for i, (t, s, v, n) in enumerate(G.TRUEFALSE)])
dump("lessons", [])
print("ok:", len(G.TOPICS), "параграфа,", len(G.DATES), "чисел,", len(G.TERMS), "терминов,", len(G.PERSONS), "объектов")
