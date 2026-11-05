"""seed/*.json → migrations/0002_seed.sql 생성.
사용: python3 scripts/build_seed.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
seed = json.loads((ROOT / "seed" / "seed.json").read_text(encoding="utf-8"))

def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"

out = ["-- 초기 데이터 (scripts/build_seed.py 로 생성). 기준일 2026-11-05", ""]
for table, rows in (("fu_items", seed["fu"]), ("requirements", seed["requirements"])):
    for i, r in enumerate(rows, 1):
        r = {**r, "sort": i * 10, "updated_by": "seed"}
        cols = ", ".join(r.keys())
        vals = ", ".join(q(v) for v in r.values())
        out.append(f"INSERT OR IGNORE INTO {table} ({cols}) VALUES ({vals});")
    out.append("")
(ROOT / "migrations" / "0002_seed.sql").write_text("\n".join(out), encoding="utf-8")
print("rows:", len(seed["fu"]), len(seed["requirements"]))
