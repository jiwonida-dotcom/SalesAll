// Cloudflare Pages Functions — /api/* (D1 바인딩: DB)
// 인증: Cloudflare Access 앞단 적용. 작성자 = Cf-Access-Authenticated-User-Email

const PRI = ["상", "중", "하"];
const ENTITIES = {
  fu: {
    table: "fu_items", log: "fu", prefix: "F", pad: 0,
    fields: ["title", "owner", "due", "status", "priority", "source", "note", "sort"],
    required: ["title"],
    enums: { status: ["미착수", "진행중", "완료", "보류"], priority: PRI },
  },
  requirements: {
    table: "requirements", log: "requirement", prefix: "R", pad: 2,
    fields: ["area", "title", "detail", "source", "current_state", "guide_ref", "gap", "decision", "priority", "status", "operators", "scope", "note", "sort"],
    required: ["area", "title"],
    enums: {
      gap: ["충족", "부분", "미충족", "확인필요"],
      decision: ["결정", "요구", "미결", "제외"],
      priority: PRI,
      status: ["취합", "U+전달", "반영확정", "제외"],
      scope: ["필수", "선택", "미정"],
    },
  },
  inquiries: {
    table: "inquiries", log: "inquiry", prefix: "Q", pad: 2,
    fields: ["title", "detail", "reqs", "fu_ref", "to_party", "status", "owner", "asked_at", "answered_at", "answer", "sort"],
    required: ["title"],
    enums: { status: ["작성", "전달", "답변", "반영완료", "종결"] },
  },
  decisions: {
    table: "decisions", log: "decision", prefix: "D", pad: 2,
    fields: ["title", "rationale", "decided_at", "source", "status", "reqs", "sort"],
    required: ["title"],
    enums: { status: ["확정", "잠정", "번복"] },
  },
  issues: {
    table: "issues", log: "issue", prefix: "I", pad: 2,
    fields: ["title", "type", "impact", "status", "owner", "action", "reqs", "sort"],
    required: ["title"],
    enums: { type: ["이슈", "리스크"], impact: PRI, status: ["열림", "대응중", "해소"] },
  },
  checks: {
    table: "checks", log: "check", prefix: "C", pad: 2,
    fields: ["area", "item", "reqs", "result", "note", "checked_by", "checked_at", "sort"],
    required: ["area", "item"],
    enums: { result: ["미확인", "정상", "이슈", "해당없음"] },
  },
};
const OPERATORS = ["공통", "유모바일", "헬로모바일", "기타MVNO"];
const COMMENT_ENUMS = {
  target_type: ["general", "fu", "requirement", "inquiry", "decision", "issue", "check", "meeting", "guide"],
  category: ["코멘트", "의견", "질문", "이슈", "결정요청"],
  status: ["접수", "검토중", "완료"],
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const bad = (msg, status = 400) => json({ error: msg }, status);

const actorOf = (req) =>
  req.headers.get("cf-access-authenticated-user-email") || req.headers.get("x-user") || "anonymous";

function pick(body, fields, enums) {
  const out = {};
  for (const f of fields) {
    if (body[f] === undefined) continue;
    let v = body[f];
    if (f === "sort") v = Number(v) || 0;
    else v = String(v ?? "").slice(0, 4000);
    if (enums && enums[f] && !enums[f].includes(v)) throw new Error(`${f} 값 오류: ${v}`);
    if (f === "operators") {
      const list = v.split(",").map((s) => s.trim()).filter(Boolean);
      if (!list.length || list.some((x) => !OPERATORS.includes(x))) throw new Error(`operators 값 오류: ${v}`);
      v = list.join(",");
    }
    out[f] = v;
  }
  return out;
}

async function log(db, entity, entity_id, action, diff, actor) {
  await db
    .prepare("INSERT INTO change_log (entity, entity_id, action, diff, actor) VALUES (?, ?, ?, ?, ?)")
    .bind(entity, String(entity_id), action, JSON.stringify(diff || {}), actor)
    .run();
}

async function nextId(db, cfg) {
  const { results } = await db.prepare(`SELECT id FROM ${cfg.table}`).all();
  const max = results.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace(/\D/g, ""), 10) || 0), 0);
  return cfg.prefix + String(max + 1).padStart(cfg.pad, "0");
}

async function crud(db, key, method, id, request, actor) {
  const cfg = ENTITIES[key];
  const T = cfg.table;
  const one = (i) => db.prepare(`SELECT * FROM ${T} WHERE id = ?`).bind(i).first();
  if (method === "GET" && !id) {
    const { results } = await db.prepare(`SELECT * FROM ${T} ORDER BY sort, id`).all();
    return json(results);
  }
  if (method === "GET") {
    const row = await one(id);
    return row ? json(row) : bad("not found", 404);
  }
  if (method === "POST") {
    const data = pick(await request.json(), cfg.fields, cfg.enums);
    for (const r of cfg.required) if (!data[r]) return bad(`${r} 필수`);
    const newId = await nextId(db, cfg);
    if (data.sort === undefined) {
      const m = await db.prepare(`SELECT COALESCE(MAX(sort),0) AS m FROM ${T}`).first();
      data.sort = (m?.m || 0) + 10;
    }
    const cols = ["id", ...Object.keys(data), "updated_by"];
    await db
      .prepare(`INSERT INTO ${T} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`)
      .bind(newId, ...Object.values(data), actor)
      .run();
    await log(db, cfg.log, newId, "create", { [cfg.required.includes("title") ? "title" : "item"]: [null, data.title || data.item] }, actor);
    return json(await one(newId), 201);
  }
  if (method === "PATCH" && id) {
    const before = await one(id);
    if (!before) return bad("not found", 404);
    const data = pick(await request.json(), cfg.fields, cfg.enums);
    const diff = {};
    for (const [k, v] of Object.entries(data)) if (String(before[k] ?? "") !== String(v)) diff[k] = [before[k], v];
    if (!Object.keys(diff).length) return json(before);
    const sets = Object.keys(diff).map((k) => `${k} = ?`).join(", ");
    await db
      .prepare(`UPDATE ${T} SET ${sets}, updated_at = datetime('now'), updated_by = ? WHERE id = ?`)
      .bind(...Object.keys(diff).map((k) => data[k]), actor, id)
      .run();
    await log(db, cfg.log, id, "update", diff, actor);
    return json(await one(id));
  }
  if (method === "DELETE" && id) {
    const before = await one(id);
    if (!before) return bad("not found", 404);
    await db.prepare(`DELETE FROM ${T} WHERE id = ?`).bind(id).run();
    await log(db, cfg.log, id, "delete", { title: [before.title || before.item, null] }, actor);
    return json({ ok: true });
  }
  return bad("method not allowed", 405);
}

// ---------- 코멘트 (feedback 테이블) ----------
async function comments(db, method, id, request, url, actor) {
  if (method === "GET") {
    const where = [], args = [];
    for (const k of ["target_type", "target_id"]) {
      const v = url.searchParams.get(k);
      if (v) { where.push(`${k} = ?`); args.push(v); }
    }
    const sql = "SELECT * FROM feedback" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY id DESC LIMIT 1000";
    const { results } = await db.prepare(sql).bind(...args).all();
    return json(results);
  }
  if (method === "POST") {
    const data = pick(await request.json(), ["target_type", "target_id", "category", "body"], COMMENT_ENUMS);
    if (!data.body || !data.body.trim()) return bad("body 필수");
    const r = await db
      .prepare("INSERT INTO feedback (target_type, target_id, category, body, author) VALUES (?, ?, ?, ?, ?)")
      .bind(data.target_type || "general", data.target_id || "", data.category || "코멘트", data.body, actor)
      .run();
    const newId = r.meta?.last_row_id;
    await log(db, "feedback", newId, "create", { target: [null, `${data.target_type || "general"}:${data.target_id || ""}`] }, actor);
    return json(await db.prepare("SELECT * FROM feedback WHERE id = ?").bind(newId).first(), 201);
  }
  if (method === "PATCH" && id) {
    const before = await db.prepare("SELECT * FROM feedback WHERE id = ?").bind(id).first();
    if (!before) return bad("not found", 404);
    const data = pick(await request.json(), ["status", "reply", "category", "body"], COMMENT_ENUMS);
    const diff = {};
    for (const [k, v] of Object.entries(data)) if (String(before[k] ?? "") !== String(v)) diff[k] = [before[k], v];
    if (!Object.keys(diff).length) return json(before);
    const sets = Object.keys(diff).map((k) => `${k} = ?`).join(", ");
    await db.prepare(`UPDATE feedback SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...Object.keys(diff).map((k) => data[k]), id).run();
    await log(db, "feedback", id, "update", diff, actor);
    return json(await db.prepare("SELECT * FROM feedback WHERE id = ?").bind(id).first());
  }
  if (method === "DELETE" && id) {
    await db.prepare("DELETE FROM feedback WHERE id = ?").bind(id).run();
    await log(db, "feedback", id, "delete", {}, actor);
    return json({ ok: true });
  }
  return bad("method not allowed", 405);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return bad("D1 바인딩(DB) 미설정", 500);
  const url = new URL(request.url);
  const [res, rawId] = [].concat(params.path || []);
  const id = rawId ? decodeURIComponent(rawId) : null;
  const method = request.method.toUpperCase();
  const actor = actorOf(request);
  try {
    if (res === "me") return json({ email: actor });
    if (res === "all") {
      // 초기 로딩용 일괄 조회
      const out = { me: actor };
      for (const [k, cfg] of Object.entries(ENTITIES)) {
        out[k] = (await db.prepare(`SELECT * FROM ${cfg.table} ORDER BY sort, id`).all()).results;
      }
      out.comments = (await db.prepare("SELECT * FROM feedback ORDER BY id DESC LIMIT 1000").all()).results;
      return json(out);
    }
    if (res === "changelog") {
      const lim = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
      const { results } = await db.prepare("SELECT * FROM change_log ORDER BY id DESC LIMIT ?").bind(lim).all();
      return json(results);
    }
    if (ENTITIES[res]) return await crud(db, res, method, id, request, actor);
    if (res === "comments" || res === "feedback") return await comments(db, method, id, request, url, actor);
    return bad("unknown endpoint", 404);
  } catch (e) {
    return bad(e.message || String(e), 400);
  }
}
