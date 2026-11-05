-- SalesAll MVNO 프로젝트 관리 — D1 스키마
CREATE TABLE IF NOT EXISTS fu_items (
  id          TEXT PRIMARY KEY,            -- F1, F2 ...
  title       TEXT NOT NULL,
  owner       TEXT DEFAULT '',
  due         TEXT DEFAULT '',             -- 자유 표기(즉시, 다음 주, 2026-12 등)
  status      TEXT NOT NULL DEFAULT '미착수', -- 미착수/진행중/완료/보류
  priority    TEXT NOT NULL DEFAULT '중',    -- 상/중/하
  source      TEXT DEFAULT '',             -- 근거(회의 11/05 등)
  note        TEXT DEFAULT '',
  sort        INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS requirements (
  id            TEXT PRIMARY KEY,          -- R01, R02 ...
  area          TEXT NOT NULL,             -- 영역
  title         TEXT NOT NULL,             -- 요구사항
  detail        TEXT DEFAULT '',           -- 배경·근거
  source        TEXT DEFAULT '',           -- 회의 11/05, 가이드 분석(제안) 등
  current_state TEXT DEFAULT '',           -- 세일즈올 현행(가이드 기준)
  guide_ref     TEXT DEFAULT '',           -- 가이드 슬라이드 번호(쉼표 구분)
  gap           TEXT NOT NULL DEFAULT '확인필요', -- 충족/부분/미충족/확인필요
  decision      TEXT NOT NULL DEFAULT '요구',   -- 결정/요구/미결/제외
  priority      TEXT NOT NULL DEFAULT '중',
  status        TEXT NOT NULL DEFAULT '취합',   -- 취합/U+전달/반영확정/제외
  note          TEXT DEFAULT '',
  sort          INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by    TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL DEFAULT 'general', -- general/fu/requirement/meeting/guide
  target_id   TEXT DEFAULT '',
  category    TEXT NOT NULL DEFAULT '의견',      -- 의견/질문/이슈/결정요청
  body        TEXT NOT NULL,
  author      TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT '접수',      -- 접수/검토중/완료
  reply       TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_target ON feedback(target_type, target_id);

CREATE TABLE IF NOT EXISTS change_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  entity    TEXT NOT NULL,     -- fu/requirement/feedback
  entity_id TEXT NOT NULL,
  action    TEXT NOT NULL,     -- create/update/delete
  diff      TEXT DEFAULT '',   -- JSON {field:[before, after]}
  actor     TEXT DEFAULT '',
  at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_change_at ON change_log(at DESC);
