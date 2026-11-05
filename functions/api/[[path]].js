// Cloudflare Pages Functions — /api/* (D1 바인딩: DB)
// 인증: Cloudflare Access 앞단 적용. 작성자 = Cf-Access-Authenticated-User-Email

const TABLES = {
  fu: {
    table: "fu_items", prefix: "F", pad: 0,
    fields: ["title", "owner", "due", "status", "priority", "source", "note", "sort"],
    required: ["title"],
    enums: { status: ["미착수", "진행중", "완료", "보류"], priority: ["상", "중", "하"] },
  },
  requirements: {
    table: "requirements", prefix: "R", pad: 2,
    fields: ["area", "title", "detail", "source", "current_state", "guide_ref", "gap", "decision", "priority", "status", "note", "sort"],
    required: ["area", "title"],
    enums: {
      gap: ["충족", "부분", "미충족", "확인필요"],
      decision: ["결정", "요구", "미결", "제외"],
      priority: ["상", "중", "하"],
      status: ["취합", "U+전달", "반영확정", "제외"],
    },
  },
};
const FEEDBACK_ENUMS = {
  target_type: ["general", "fu", "requirement", "meeting", "guide"],
  category: ["의견", "질문", "이슈", "결정요청"],
  status: ["접수", "검토중", "완료"],
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const bad = (msg, status = 400) => json({ error: msg }, status);

function actorOf(request) {
  return (
    request.headers.get("cf-access-authenticated-user-email") ||
    request.headers.get("x-user") ||
    "anonymous"
  );
}

function pick(body, fields, enums) {
  const out = {};
  for (const f of fields) {
    if (body[f] === undefined) continue;
    let v = body[f];
    if (f === "sort") v = Number(v) || 0;
    else v = String(v ?? "").slice(0, 4000);
    if (enums && enums[f] && !enums[f].includes(v)) throw new Error(`${f} 값 오류: ${v}`);
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

// ---------- 공통 CRUD (fu / requirements) ----------
async function crud(db, key, method, id, request, actor) {
  const cfg = TABLES[key];
  const T = cfg.table;
  if (method === "GET" && !id) {
    const { results } = await db.prepare(`SELECT * FROM ${T} ORDER BY sort, id`).all();
    return json(results);
  }
  if (method === "GET") {
    const row = await db.prepare(`SELECT * FROM ${T} WHERE id = ?`).bind(id).first();
    return row ? json(row) : bad("not found", 404);
  }
  if (method === "POST") {
    const body = await request.json();
    const data = pick(body, cfg.fields, cfg.enums);
    for (const r of cfg.required) if (!data[r]) return bad(`${r} 필수`);
    const newId = await nextId(db, cfg);
    if (data.sort === undefined) {
      const m = await db.prepare(`SELECT COALESCE(MAX(sort),0) AS m FROM ${T}`).first();
      data.sort = (m?.m || 0) + 10;
    }
    const cols = ["id", ...Object.keys(data), "updated_by"];
    const vals = [newId, ...Object.values(data), actor];
    await db
      .prepare(`INSERT INTO ${T} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`)
      .bind(...vals)
      .run();
    await log(db, key === "fu" ? "fu" : "requirement", newId, "create", { title: [null, data.title] }, actor);
    return json(await db.prepare(`SELECT * FROM ${T} WHERE id = ?`).bind(newId).first(), 201);
  }
  if (method === "PATCH" && id) {
    const before = await db.prepare(`SELECT * FROM ${T} WHERE id = ?`).bind(id).first();
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
    await log(db, key === "fu" ? "fu" : "requirement", id, "update", diff, actor);
    return json(await db.prepare(`SELECT * FROM ${T} WHERE id = ?`).bind(id).first());
  }
  if (method === "DELETE" && id) {
    const before = await db.prepare(`SELECT * FROM ${T} WHERE id = ?`).bind(id).first();
    if (!before) return bad("not found", 404);
    await db.prepare(`DELETE FROM ${T} WHERE id = ?`).bind(id).run();
    await log(db, key === "fu" ? "fu" : "requirement", id, "delete", { title: [before.title, null] }, actor);
    return json({ ok: true });
  }
  return bad("method not allowed", 405);
}

// ---------- 피드백 ----------
async function feedback(db, method, id, request, url, actor) {
  if (method === "GET") {
    const tt = url.searchParams.get("target_type");
    const ti = url.searchParams.get("target_id");
    let sql = "SELECT * FROM feedback";
    const where = [], args = [];
    if (tt) { where.push("target_type = ?"); args.push(tt); }
    if (ti) { where.push("target_id = ?"); args.push(ti); }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY id DESC LIMIT 500";
    const { results } = await db.prepare(sql).bind(...args).all();
    return json(results);
  }
  if (method === "POST") {
    const b = await request.json();
    const data = pick(b, ["target_type", "target_id", "category", "body"], FEEDBACK_ENUMS);
    if (!data.body || !data.body.trim()) return bad("body 필수");
    const r = await db
      .prepare("INSERT INTO feedback (target_type, target_id, category, body, author) VALUES (?, ?, ?, ?, ?)")
      .bind(data.target_type || "general", data.target_id || "", data.category || "의견", data.body, actor)
      .run();
    const newId = r.meta?.last_row_id;
    await log(db, "feedback", newId, "create", { category: [null, data.category || "의견"], target: [null, `${data.target_type || "general"}:${data.target_id || ""}`] }, actor);
    return json(await db.prepare("SELECT * FROM feedback WHERE id = ?").bind(newId).first(), 201);
  }
  if (method === "PATCH" && id) {
    const before = await db.prepare("SELECT * FROM feedback WHERE id = ?").bind(id).first();
    if (!before) return bad("not found", 404);
    const data = pick(await request.json(), ["status", "reply", "category", "body"], FEEDBACK_ENUMS);
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

async function summary(db) {
  const q = (sql) => db.prepare(sql).all().then((r) => r.results);
  const [fu, reqGap, reqStatus, fb, recent] = await Promise.all([
    q("SELECT status, COUNT(*) AS n FROM fu_items GROUP BY status"),
    q("SELECT gap, COUNT(*) AS n FROM requirements GROUP BY gap"),
    q("SELECT decision, COUNT(*) AS n FROM requirements GROUP BY decision"),
    q("SELECT status, COUNT(*) AS n FROM feedback GROUP BY status"),
    q("SELECT * FROM change_log ORDER BY id DESC LIMIT 8"),
  ]);
  return json({ fu, reqGap, reqStatus, feedback: fb, recent });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return bad("D1 바인딩(DB) 미설정", 500);
  const url = new URL(request.url);
  const seg = [].concat(params.path || []);
  const [res, id] = seg;
  const method = request.method.toUpperCase();
  const actor = actorOf(request);
  try {
    if (res === "me") return json({ email: actor });
    if (res === "summary") return await summary(db);
    if (res === "changelog") {
      const lim = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
      const { results } = await db.prepare("SELECT * FROM change_log ORDER BY id DESC LIMIT ?").bind(lim).all();
      return json(results);
    }
    if (res === "fu" || res === "requirements") return await crud(db, res, method, id ? decodeURIComponent(id) : null, request, actor);
    if (res === "feedback") return await feedback(db, method, id, request, url, actor);
    return bad("unknown endpoint", 404);
  } catch (e) {
    return bad(e.message || String(e), 400);
  }
}
