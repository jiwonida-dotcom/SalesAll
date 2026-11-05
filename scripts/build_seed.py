"""seed/seed.json → 마이그레이션 SQL 생성.
- migrations/0002_seed.sql : fu_items, requirements (0001 스키마 컬럼만)
- migrations/0005_ia_v2.sql : IA v2 스키마 확장 + inquiries/decisions/issues/checks 초기 데이터
사용: python3 scripts/build_seed.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
seed = json.loads((ROOT / "seed" / "seed.json").read_text(encoding="utf-8"))

REQ_V1 = ["id", "area", "title", "detail", "source", "current_state", "guide_ref", "gap", "decision", "priority", "status", "note"]


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def inserts(table, rows, cols=None, by="seed"):
    out = []
    for i, r in enumerate(rows, 1):
        r = {k: v for k, v in r.items() if cols is None or k in cols}
        r = {**r, "sort": i * 10, "updated_by": by}
        out.append(f"INSERT OR IGNORE INTO {table} ({', '.join(r)}) VALUES ({', '.join(q(v) for v in r.values())});")
    return out


# 0002
out = ["-- 초기 데이터 (scripts/build_seed.py 로 생성). 기준일 2026-11-05", ""]
out += inserts("fu_items", seed["fu"]) + [""]
out += inserts("requirements", seed["requirements"], REQ_V1) + [""]
(ROOT / "migrations" / "0002_seed.sql").write_text("\n".join(out), encoding="utf-8")

# 0005
ddl = """-- IA v2: U+ 질의 대장, 결정 로그, 이슈·리스크, 검증 체크리스트, 요구사항 사업자·범위
ALTER TABLE requirements ADD COLUMN operators TEXT NOT NULL DEFAULT '공통';
ALTER TABLE requirements ADD COLUMN scope TEXT NOT NULL DEFAULT '미정';

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, detail TEXT DEFAULT '',
  reqs TEXT DEFAULT '', fu_ref TEXT DEFAULT '', to_party TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT '작성',      -- 작성/전달/답변/반영완료/종결
  owner TEXT DEFAULT '', asked_at TEXT DEFAULT '', answered_at TEXT DEFAULT '', answer TEXT DEFAULT '',
  sort INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), updated_by TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, rationale TEXT DEFAULT '',
  decided_at TEXT DEFAULT '', source TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT '확정',      -- 확정/잠정/번복
  reqs TEXT DEFAULT '', sort INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), updated_by TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '이슈',        -- 이슈/리스크
  impact TEXT NOT NULL DEFAULT '중',        -- 상/중/하
  status TEXT NOT NULL DEFAULT '열림',      -- 열림/대응중/해소
  owner TEXT DEFAULT '', action TEXT DEFAULT '', reqs TEXT DEFAULT '', sort INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), updated_by TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY, area TEXT NOT NULL, item TEXT NOT NULL, reqs TEXT DEFAULT '',
  result TEXT NOT NULL DEFAULT '미확인',    -- 미확인/정상/이슈/해당없음
  note TEXT DEFAULT '', checked_by TEXT DEFAULT '', checked_at TEXT DEFAULT '', sort INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), updated_by TEXT DEFAULT ''
);
"""
out = [ddl]
for t, k in (("inquiries", "inquiries"), ("decisions", "decisions"), ("issues", "issues"), ("checks", "checks")):
    out += inserts(t, seed[k]) + [""]
(ROOT / "migrations" / "0005_ia_v2.sql").write_text("\n".join(out), encoding="utf-8")
print({k: len(v) for k, v in seed.items()})
