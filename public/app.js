/* SalesAll MVNO 프로젝트 관리 — IA v2 · GATAG UI (빌드 없음, Vanilla JS) */
(() => {
"use strict";

// ================= 상태 =================
const S = { content: null, d: { fu: [], requirements: [], inquiries: [], decisions: [], issues: [], checks: [] }, comments: [], me: "", apiOk: false, form: null };

// ================= 유틸 =================
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const toKST = (s) => { if (!s) return ""; const d = new Date(String(s).replace(" ", "T") + "Z"); return isNaN(d) ? s : new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " "); };
const count = (arr, k) => arr.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
const ids = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200); };

const TONE = {
  ok: ["완료", "정상", "확정", "해소", "반영완료", "충족", "결정", "필수"],
  info: ["진행중", "전달", "대응중", "확인필요", "요구", "U+전달", "답변"],
  warn: ["보류", "부분", "잠정", "미결", "중", "선택"],
  critical: ["미충족", "이슈", "상", "번복", "열림"],
  danger: ["리스크"],
};
const toneOf = (v) => Object.keys(TONE).find((k) => TONE[k].includes(v)) || "mute";
const lv = (v) => (v ? `<span class="lv lv-${toneOf(v)}"><span class="chip"></span>${esc(v)}</span>` : "");
const TONE_VAR = { ok: "--lv-ok", info: "--c7", warn: "--lv-warn", critical: "--lv-critical", danger: "--lv-danger", mute: "--baseline" };

const ICON = {
  list: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5.5 4h7M5.5 8h7M5.5 12h7M3 4h.01M3 8h.01M3 12h.01"/></svg>',
  q: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5.8"/><path d="M6.4 6.3a1.7 1.7 0 1 1 2.4 1.6c-.5.2-.8.6-.8 1.1v.3M8 11.3h.01"/></svg>',
  alert: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.3h.01"/></svg>',
  flag: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 14V2.5M3.5 3h8l-1.6 2.7L11.5 8.4h-8"/></svg>',
  doc: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4 1.8h5.2L12 4.6v9.6H4z"/><path d="M9 1.8v3h3M6 8h4M6 10.5h4"/></svg>',
  chart: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 13V8M8 13V3.5M12 13V6"/></svg>',
};

// ================= API =================
async function api(path, opt = {}) {
  const res = await fetch("/api/" + path, {
    method: opt.method || "GET",
    headers: opt.body ? { "content-type": "application/json" } : {},
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) throw new Error("API 응답 없음 (" + res.status + ")");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.status);
  return data;
}
async function loadAll() {
  S.content = await fetch("data/content.json").then((r) => r.json());
  try {
    const all = await api("all");
    S.me = all.me; S.comments = all.comments;
    for (const k of Object.keys(S.d)) S.d[k] = all[k] || [];
    S.apiOk = true;
  } catch (e) { S.apiOk = false; S.apiErr = e.message; }
}
async function reload(key) {
  if (key === "comments") S.comments = await api("comments");
  else S.d[key] = await api(key);
}

// ================= 엔티티 정의 =================
const E = {
  fu: { ep: "fu", tt: "fu", name: "할 일", t: (r) => r.title,
    seg: { k: "status", vals: ["미착수", "진행중", "완료", "보류"], open: (r) => r.status !== "완료" },
    fields: [
      { k: "title", l: "할 일", req: 1, full: 1 }, { k: "owner", l: "담당" }, { k: "due", l: "기한", ph: "즉시 / 다음 주 / 2026-12" },
      { k: "status", l: "상태", en: ["미착수", "진행중", "완료", "보류"] }, { k: "priority", l: "우선순위", en: ["상", "중", "하"], def: "중" },
      { k: "source", l: "근거", ph: "회의 11/05" }, { k: "note", l: "비고", area: 1, full: 1 }],
    cols: [
      { l: "ID", r: (r) => r.id, cls: "id" },
      { l: "할 일", r: (r) => `${esc(r.title)}${r.note ? `<span class="cue">※ ${esc(r.note)}</span>` : ""}`, raw: 1 },
      { l: "담당", r: (r) => r.owner, cls: "nw" }, { l: "기한", r: (r) => r.due, cls: "dt" },
      { l: "우선", r: (r) => lv(r.priority), raw: 1 },
      { l: "상태", r: (r) => quickSel("fu", r, "status"), raw: 1 },
      { l: "", r: (r) => cmtBadge("fu", r.id), raw: 1 }],
  },
  inquiries: { ep: "inquiries", tt: "inquiry", name: "U+ 질의", t: (r) => r.title,
    seg: { k: "status", vals: ["작성", "전달", "답변", "반영완료", "종결"], open: (r) => ["작성", "전달"].includes(r.status) },
    fields: [
      { k: "title", l: "질의", req: 1, full: 1 }, { k: "detail", l: "배경·상세", area: 1, full: 1 },
      { k: "to_party", l: "대상", def: "U+ 시스템 구축 담당" }, { k: "owner", l: "담당" },
      { k: "status", l: "상태", en: ["작성", "전달", "답변", "반영완료", "종결"] },
      { k: "reqs", l: "관련 요구사항", ph: "R05,R08" }, { k: "fu_ref", l: "관련 할 일", ph: "F4" },
      { k: "asked_at", l: "전달일", ph: "2026-11-12" }, { k: "answered_at", l: "답변일" },
      { k: "answer", l: "답변", area: 1, full: 1 }],
    cols: [
      { l: "ID", r: (r) => r.id, cls: "id" },
      { l: "질의", r: (r) => `${esc(r.title)}${r.answer ? `<span class="cue">답변: ${esc(r.answer)}</span>` : ""}`, raw: 1 },
      { l: "요구사항", r: (r) => reqChips(r.reqs), raw: 1 },
      { l: "전달일", r: (r) => r.asked_at || "-", cls: "dt" }, { l: "답변일", r: (r) => r.answered_at || "-", cls: "dt" },
      { l: "상태", r: (r) => quickSel("inquiries", r, "status"), raw: 1 }],
  },
  decisions: { ep: "decisions", tt: "decision", name: "결정", t: (r) => r.title,
    seg: { k: "status", vals: ["확정", "잠정", "번복"] },
    fields: [
      { k: "title", l: "결정", req: 1, full: 1 }, { k: "rationale", l: "근거", area: 1, full: 1 },
      { k: "decided_at", l: "결정일", ph: "2026-11-05" }, { k: "source", l: "출처 회의", ph: "M20261105" },
      { k: "status", l: "상태", en: ["확정", "잠정", "번복"] }, { k: "reqs", l: "관련 요구사항", ph: "R06" }],
    cols: [
      { l: "ID", r: (r) => r.id, cls: "id" },
      { l: "결정", r: (r) => `${esc(r.title)}${r.rationale ? `<span class="cue">근거: ${esc(r.rationale)}</span>` : ""}`, raw: 1 },
      { l: "결정일", r: (r) => r.decided_at, cls: "dt" },
      { l: "출처", r: (r) => meetingChip(r.source), raw: 1 },
      { l: "요구사항", r: (r) => reqChips(r.reqs), raw: 1 },
      { l: "상태", r: (r) => lv(r.status), raw: 1 }],
  },
  issues: { ep: "issues", tt: "issue", name: "이슈·리스크", t: (r) => r.title,
    seg: { k: "status", vals: ["열림", "대응중", "해소"], open: (r) => r.status !== "해소" },
    fields: [
      { k: "title", l: "제목", req: 1, full: 1 }, { k: "type", l: "구분", en: ["이슈", "리스크"] },
      { k: "impact", l: "영향도", en: ["상", "중", "하"], def: "중" }, { k: "status", l: "상태", en: ["열림", "대응중", "해소"] },
      { k: "owner", l: "담당" }, { k: "reqs", l: "관련 요구사항" }, { k: "action", l: "대응", area: 1, full: 1 }],
    cols: [
      { l: "ID", r: (r) => r.id, cls: "id" }, { l: "구분", r: (r) => lv(r.type), raw: 1 },
      { l: "제목", r: (r) => `${esc(r.title)}${r.action ? `<span class="cue">대응: ${esc(r.action)}</span>` : ""}`, raw: 1 },
      { l: "영향", r: (r) => lv(r.impact), raw: 1 }, { l: "담당", r: (r) => r.owner || "-", cls: "nw" },
      { l: "상태", r: (r) => quickSel("issues", r, "status"), raw: 1 }],
  },
  requirements: { ep: "requirements", tt: "requirement", name: "요구사항", t: (r) => r.title,
    seg: { k: "gap", vals: ["충족", "부분", "미충족", "확인필요"] },
    fields: [
      { k: "area", l: "영역", req: 1 }, { k: "source", l: "출처", ph: "회의 11/05" },
      { k: "title", l: "요구사항", req: 1, full: 1 }, { k: "detail", l: "배경·근거", area: 1, full: 1 },
      { k: "current_state", l: "세일즈올 현행 (가이드 기준)", area: 1, full: 1 }, { k: "guide_ref", l: "가이드 슬라이드", ph: "9,18" },
      { k: "operators", l: "적용 사업자", multi: ["공통", "유모바일", "헬로모바일", "기타MVNO"], def: "공통", full: 1 },
      { k: "scope", l: "범위", en: ["필수", "선택", "미정"], def: "미정" },
      { k: "gap", l: "갭", en: ["충족", "부분", "미충족", "확인필요"], def: "확인필요" },
      { k: "decision", l: "판단", en: ["결정", "요구", "미결", "제외"], def: "요구" },
      { k: "priority", l: "우선순위", en: ["상", "중", "하"], def: "중" },
      { k: "status", l: "진행", en: ["취합", "U+전달", "반영확정", "제외"], def: "취합" },
      { k: "note", l: "비고", area: 1, full: 1 }],
    cols: [
      { l: "ID", r: (r) => r.id, cls: "id" }, { l: "영역", r: (r) => r.area, cls: "nw" },
      { l: "요구사항", r: (r) => `<b style="font-weight:600">${esc(r.title)}</b><span class="cue">${esc(r.source)}</span>`, raw: 1 },
      { l: "세일즈올 현행", r: (r) => `<span class="pre sm">${esc(r.current_state)}</span> ${slideChips(r.guide_ref)}`, raw: 1, cls: "sm" },
      { l: "사업자", r: (r) => ids(r.operators).map((o) => `<span class="chn">${esc(o)}</span>`).join(""), raw: 1 },
      { l: "범위", r: (r) => lv(r.scope), raw: 1 }, { l: "갭", r: (r) => lv(r.gap), raw: 1 },
      { l: "판단", r: (r) => lv(r.decision), raw: 1 }, { l: "우선", r: (r) => lv(r.priority), raw: 1 }],
  },
  checks: { ep: "checks", tt: "check", name: "검증 항목", t: (r) => `${r.area} · ${r.item}`,
    seg: { k: "result", vals: ["미확인", "정상", "이슈", "해당없음"] },
    fields: [
      { k: "area", l: "영역", req: 1 }, { k: "item", l: "확인 항목", req: 1, full: 1 }, { k: "reqs", l: "관련 요구사항" },
      { k: "result", l: "결과", en: ["미확인", "정상", "이슈", "해당없음"] }, { k: "checked_by", l: "확인자" }, { k: "checked_at", l: "확인일" },
      { k: "note", l: "확인 결과 메모", area: 1, full: 1 }],
    cols: [
      { l: "ID", r: (r) => r.id, cls: "id" }, { l: "영역", r: (r) => r.area, cls: "nw" },
      { l: "확인 항목", r: (r) => `${esc(r.item)}${r.note ? `<span class="cue">※ ${esc(r.note)}</span>` : ""}`, raw: 1 },
      { l: "요구사항", r: (r) => reqChips(r.reqs), raw: 1 },
      { l: "확인", r: (r) => (r.checked_at ? `${esc(r.checked_at)}<span class="cue">${esc(r.checked_by)}</span>` : "-"), raw: 1, cls: "dt" },
      { l: "결과", r: (r) => quickSel("checks", r, "result"), raw: 1 }],
  },
};

// ================= 공통 조각 =================
const reqChips = (s) => ids(s).map((x) => { const r = S.d.requirements.find((q) => q.id === x); return `<a class="chn" href="#/req/list/${x}" title="${esc(r ? r.title : "")}">${x}</a>`; }).join("");
const slideChips = (s) => ids(s).map((n) => `<a class="chn" href="#/ref/guide/${n}">p.${n}</a>`).join("");
const fuChips = (s) => ids(s).map((x) => `<a class="chn" href="#/run/fu/${x}">${x}</a>`).join("");
const meetingChip = (id) => { const m = (S.content.meetings || []).find((x) => x.id === id); return m ? `<a class="chn" href="#/plan/meeting/${m.id}">${esc(m.date)}</a>` : esc(id); };
const cmtBadge = (tt, id) => { const n = S.comments.filter((c) => c.target_type === E[tt].tt && c.target_id === id).length; return n ? `<span class="chn">💬 ${n}</span>` : ""; };
function quickSel(key, r, k) {
  const f = E[key].fields.find((x) => x.k === k);
  if (!S.apiOk) return lv(r[k]);
  return `<select class="field compact qs" data-key="${key}" data-id="${esc(r.id)}" data-k="${k}">${f.en.map((v) => `<option ${v === r[k] ? "selected" : ""}>${v}</option>`).join("")}</select>`;
}
function bindQuick(root) {
  root.querySelectorAll(".qs").forEach((s) => {
    s.onclick = (e) => e.stopPropagation();
    s.onchange = async () => {
      const body = { [s.dataset.k]: s.value };
      if (s.dataset.key === "checks") Object.assign(body, { checked_by: S.me, checked_at: today() });
      if (s.dataset.key === "inquiries" && s.value === "전달") { const r = S.d.inquiries.find((x) => x.id === s.dataset.id); if (r && !r.asked_at) body.asked_at = today(); }
      if (s.dataset.key === "inquiries" && s.value === "답변") { const r = S.d.inquiries.find((x) => x.id === s.dataset.id); if (r && !r.answered_at) body.answered_at = today(); }
      try { await api(`${E[s.dataset.key].ep}/${encodeURIComponent(s.dataset.id)}`, { method: "PATCH", body }); await reload(s.dataset.key); toast(`${s.dataset.id} → ${s.value}`); render(); }
      catch (e) { toast("변경 실패: " + e.message); }
    };
  });
}
function donut(segs, center, sub) {
  const total = segs.reduce((a, s) => a + s.n, 0) || 1, R = 70, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = segs.filter((s) => s.n).map((s) => { const len = (s.n / total) * C; const a = `<circle r="${R}" cx="90" cy="90" fill="none" stroke="var(${s.c})" stroke-width="22" stroke-dasharray="${Math.max(len - 2, 0)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"/>`; off += len; return a; }).join("");
  return `<div class="donut-box"><svg viewBox="0 0 180 180"><circle r="${R}" cx="90" cy="90" fill="none" stroke="var(--grid)" stroke-width="22"/>${arcs}</svg><div class="donut-c"><div class="t">${center}</div><div class="s">${sub}</div></div></div>
  <div class="dlegend">${segs.map((s) => `<a class="dl" href="${s.href || "#"}"><span class="chip" style="background:var(${s.c})"></span>${esc(s.l)}<b>${s.n}</b><span class="p">${((s.n / total) * 100).toFixed(0)}%</span></a>`).join("")}</div>`;
}
const stack = (obj, order) => { const t = Object.values(obj).reduce((a, b) => a + b, 0) || 1; return `<div class="stackbar">${order.map(([k, c]) => `<i style="width:${((obj[k] || 0) / t) * 100}%;background:var(${c})"></i>`).join("")}</div>`; };
const card = (title, desc, body, r = "") => `<section class="card"><div class="card-h"><h2>${title}</h2>${desc ? `<span class="desc">${desc}</span>` : ""}${r ? `<div class="r">${r}</div>` : ""}</div>${body}</section>`;
const table = (head, rows, empty = "데이터 없음") => `<div class="table-scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td class="empty" colspan="${head.length}">${empty}</td></tr>`}</tbody></table></div>`;

// ================= 폼 =================
function formHtml(key, row) {
  const fs = E[key].fields;
  return `<div class="form" id="frm">` + fs.map((f) => {
    const v = row ? row[f.k] ?? "" : f.def ?? "";
    let ctl;
    if (f.en) ctl = `<select class="field" name="${f.k}">${f.en.map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select>`;
    else if (f.multi) ctl = `<div class="checks">${f.multi.map((o) => `<label><input type="checkbox" name="${f.k}" value="${o}" ${ids(v).includes(o) ? "checked" : ""}>${o}</label>`).join("")}</div>`;
    else if (f.area) ctl = `<textarea class="field" name="${f.k}">${esc(v)}</textarea>`;
    else ctl = `<input class="field" name="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || "")}">`;
    return `<div class="${f.full ? "full" : ""}"><label>${esc(f.l)}${f.req ? " *" : ""}</label>${ctl}</div>`;
  }).join("") + `<div class="act full"><span class="msg" id="fmsg"></span>${row ? `<button class="btn danger" id="fDel">삭제</button>` : ""}<button class="btn" id="fCancel">취소</button><button class="btn primary" id="fSave">저장</button></div></div>`;
}
function readForm(key) {
  const o = {}, el = $("#frm");
  for (const f of E[key].fields) {
    if (f.multi) o[f.k] = [...el.querySelectorAll(`input[name="${f.k}"]:checked`)].map((x) => x.value).join(",");
    else o[f.k] = el.querySelector(`[name="${f.k}"]`).value;
  }
  return o;
}
function bindForm(key, row, done) {
  document.querySelectorAll('#frm input[name="operators"]').forEach((cb) => (cb.onchange = () => {
    if (!cb.checked) return;
    document.querySelectorAll('#frm input[name="operators"]').forEach((o) => { if (o !== cb && (cb.value === "공통" || o.value === "공통")) o.checked = false; });
  }));
  $("#fCancel").onclick = () => { S.form = null; render(); };
  $("#fSave").onclick = async () => {
    const body = readForm(key);
    const miss = E[key].fields.find((f) => f.req && !String(body[f.k]).trim());
    if (miss) return ($("#fmsg").textContent = `${miss.l} 입력 필요`);
    if (body.operators !== undefined && !body.operators) return ($("#fmsg").textContent = "적용 사업자 1개 이상 선택");
    try {
      const r = await api(row ? `${E[key].ep}/${encodeURIComponent(row.id)}` : E[key].ep, { method: row ? "PATCH" : "POST", body });
      await reload(key); S.form = null; toast(`${r.id} 저장`); done ? done(r) : render();
    } catch (e) { $("#fmsg").textContent = "저장 실패: " + e.message; }
  };
  const d = $("#fDel");
  if (d) d.onclick = async () => {
    if (!confirm(`${row.id} 삭제`)) return;
    try { await api(`${E[key].ep}/${encodeURIComponent(row.id)}`, { method: "DELETE" }); await reload(key); S.form = null; toast(`${row.id} 삭제`); history.back(); }
    catch (e) { $("#fmsg").textContent = "삭제 실패: " + e.message; }
  };
}

// ================= 코멘트 =================
function comments(tt, id) {
  const list = S.comments.filter((c) => c.target_type === tt && c.target_id === id);
  const body = (list.length ? list.map((c) => `<div class="cmt"><div class="mh"><b>${esc(c.author)}</b><span>${esc(toKST(c.created_at))}</span>${c.category && c.category !== "코멘트" ? lv(c.category) : ""}${S.apiOk ? `<span class="spacer"></span><button class="btn sm ghost" data-cdel="${c.id}">삭제</button>` : ""}</div><div class="bd">${esc(c.body)}</div>${c.reply ? `<div class="rp">답변 · ${esc(c.reply)}</div>` : ""}</div>`).join("") : `<div class="empty">코멘트 없음</div>`)
    + (S.apiOk ? `<div class="form" style="margin-top:14px"><div class="full"><textarea class="field" id="cBody" placeholder="코멘트 입력"></textarea></div><div class="act full"><button class="btn primary" id="cSend">등록</button></div></div>` : "");
  return card("코멘트", `${list.length}건`, body);
}
function bindComments(tt, id) {
  const send = $("#cSend");
  if (send) send.onclick = async () => {
    const b = $("#cBody").value.trim(); if (!b) return toast("내용 입력 필요");
    try { await api("comments", { method: "POST", body: { target_type: tt, target_id: id, body: b } }); await reload("comments"); render(); } catch (e) { toast("등록 실패: " + e.message); }
  };
  document.querySelectorAll("[data-cdel]").forEach((btn) => (btn.onclick = async () => {
    if (!confirm("코멘트 삭제")) return;
    await api("comments/" + btn.dataset.cdel, { method: "DELETE" }); await reload("comments"); render();
  }));
}

// ================= 범용 목록·상세 =================
const F = {}; // 페이지별 필터 상태
function listPage(m, key, base, opt = {}) {
  const e = E[key], rows0 = S.d[key];
  const f = (F[key] = F[key] || { seg: e.seg.open ? "_open" : "", q: "", x: {} });
  const segC = count(rows0, e.seg.k);
  let rows = rows0.filter((r) => (!f.seg || (f.seg === "_open" ? e.seg.open(r) : r[e.seg.k] === f.seg)) && (!f.q || JSON.stringify(r).includes(f.q)));
  for (const [k, v] of Object.entries(f.x)) if (v) rows = rows.filter((r) => (k === "operators" ? ids(r.operators).includes(v) || r.operators === "공통" : r[k] === v));
  const segBtns = [...(e.seg.open ? [["_open", "미완료", rows0.filter(e.seg.open).length]] : []), ["", "전체", rows0.length], ...e.seg.vals.map((v) => [v, v, segC[v] || 0])]
    .map(([v, l, n]) => `<button data-seg="${v}" aria-pressed="${f.seg === v}">${l}<span class="n">${n}</span></button>`).join("");
  const extra = (opt.selects || []).map(([k, l, vals]) => `<select class="field compact" data-x="${k}"><option value="">${l} 전체</option>${vals.map((v) => `<option ${f.x[k] === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>`).join("");
  const formCard = S.form && S.form.key === key && !S.form.row ? card(`${e.name} 등록`, "", formHtml(key, null)) : "";
  m.innerHTML = (opt.lead ? `<p class="lead">${opt.lead}</p>` : "") + formCard + card(opt.title || e.name, opt.desc || "", `
    <div class="toolbar"><div class="seg">${segBtns}</div>${extra}<input class="field" type="search" id="lq" placeholder="검색" value="${esc(f.q)}">${opt.tools || ""}<span class="count">${rows.length}건</span></div>
    ${table(e.cols.map((c) => c.l), rows.map((r) => `<tr class="click" data-id="${esc(r.id)}">${e.cols.map((c) => `<td class="${c.cls || ""}">${c.raw ? c.r(r) : esc(c.r(r))}</td>`).join("")}</tr>`), S.apiOk ? "해당 항목 없음" : "D1 연결 필요")}`);
  m.querySelectorAll("[data-seg]").forEach((b) => (b.onclick = () => { f.seg = b.dataset.seg; render(); }));
  m.querySelectorAll("[data-x]").forEach((s) => (s.onchange = () => { f.x[s.dataset.x] = s.value; render(); }));
  $("#lq").oninput = (ev) => { f.q = ev.target.value; clearTimeout(F._t); F._t = setTimeout(() => { render(); const q = $("#lq"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
  m.querySelectorAll("tr.click").forEach((tr) => (tr.onclick = () => (location.hash = `${base}/${tr.dataset.id}`)));
  bindQuick(m);
  if (formCard) bindForm(key, null, (r) => (location.hash = `${base}/${r.id}`));
  opt.after && opt.after(m, rows);
}
function detailPage(m, key, id, base, extraFn) {
  const e = E[key], r = S.d[key].find((x) => x.id === id);
  if (!r) { m.innerHTML = card(esc(id), "", `<div class="empty">항목 없음 · <a href="${base}">목록</a></div>`); return; }
  const editing = S.form && S.form.key === key && S.form.row === id;
  const enumF = e.fields.filter((f) => f.en);
  const kvF = e.fields.filter((f) => !f.en && !f.req || (f.req && f.k !== "title" && f.k !== "item"));
  const val = (f) => {
    const v = r[f.k];
    if (f.k === "reqs") return reqChips(v) || "-";
    if (f.k === "guide_ref") return slideChips(v) || "-";
    if (f.k === "fu_ref") return fuChips(v) || "-";
    if (f.k === "source" && key === "decisions") return meetingChip(v);
    if (f.multi) return ids(v).map((o) => `<span class="chn">${esc(o)}</span>`).join("");
    return esc(v || "-");
  };
  const main = editing ? card(`${r.id} 수정`, "", formHtml(key, r)) : card(`<span class="muted" style="font-weight:600">${r.id}</span> ${esc(e.t(r))}`, "", `
    <div class="badges">${enumF.map((f) => (r[f.k] ? `<span class="lv lv-${toneOf(r[f.k])}"><span class="chip"></span><span style="opacity:.65;font-weight:600">${esc(f.l)}</span>${esc(r[f.k])}</span>` : "")).join("")}</div>
    <dl class="kv">${kvF.map((f) => `<dt>${esc(f.l)}</dt><dd>${val(f)}</dd>`).join("")}<dt>최종 수정</dt><dd>${esc(toKST(r.updated_at))} · ${esc(r.updated_by)}</dd></dl>`,
    `<a class="btn sm" href="${base}">목록</a>${S.apiOk ? `<button class="btn sm primary" id="edit">수정</button>` : ""}`);
  m.innerHTML = `<div class="duo"><div>${main}${extraFn ? extraFn(r) : ""}</div><div>${comments(e.tt, r.id)}</div></div>`;
  const ed = $("#edit"); if (ed) ed.onclick = () => { S.form = { key, row: id }; render(); };
  if (editing) bindForm(key, r);
  bindComments(e.tt, r.id);
}
function relatedReqCard(r) {
  // 요구사항 상세 하단: 연결 객체
  const has = (x) => ids(x.reqs).includes(r.id);
  const q = S.d.inquiries.filter(has), d = S.d.decisions.filter(has), i = S.d.issues.filter(has), c = S.d.checks.filter(has);
  const sl = ids(r.guide_ref);
  const row = (key, base, x) => `<tr class="click" onclick="location.hash='${base}/${x.id}'"><td class="id">${x.id}</td><td>${esc(E[key].t(x))}</td><td>${lv(x.status || x.result)}</td></tr>`;
  const blocks = [["U+ 질의", "inquiries", "#/run/inq", q], ["결정", "decisions", "#/run/dec", d], ["이슈·리스크", "issues", "#/run/issue", i], ["검증 항목", "checks", "#/req/check", c]]
    .filter((b) => b[3].length).map(([l, k, b, arr]) => `<div class="sub-h">${l}</div><table><tbody>${arr.map((x) => row(k, b, x)).join("")}</tbody></table>`).join("");
  return card("연결 항목", "질의·결정·이슈·검증·가이드", (blocks || `<div class="muted" style="font-size:13px">연결된 질의·결정·이슈·검증 항목 없음</div>`)
    + (sl.length ? `<div class="sub-h">가이드 화면</div><div class="thumbs">${sl.map((n) => { const s = S.content.guide.slides[n - 1]; return s ? `<a class="thumb" href="#/ref/guide/${n}"><img loading="lazy" src="${s.img}" alt=""><span>p.${n} ${esc(s.title)}</span></a>` : ""; }).join("")}</div>` : ""));
}

// ================= 화면 =================
const P = {};

P.home = (m) => {
  const C = S.content, pj = C.project, d = S.d;
  const fuOpen = d.fu.filter((x) => x.status !== "완료"), fuC = count(d.fu, "status");
  const qOpen = d.inquiries.filter((x) => ["작성", "전달"].includes(x.status)), qC = count(d.inquiries, "status");
  const iOpen = d.issues.filter((x) => x.status !== "해소");
  const gapC = count(d.requirements, "gap");
  const next = C.schedule.find((s) => s.state === "next") || {};
  const cur = (C.phases || []).find((p) => p.state === "current") || {};
  const top = fuOpen.slice().sort((a, b) => "상중하".indexOf(a.priority) - "상중하".indexOf(b.priority)).slice(0, 6);
  m.innerHTML = (S.apiOk ? "" : `<div class="banner">API·D1 연결 실패 — 정적 콘텐츠만 표시 (${esc(S.apiErr || "")})</div>`) + `
  <div class="tiles">
    <a class="tile hero" href="#/plan/milestone"><div class="lbl">현 단계<span class="ic">${ICON.flag}</span></div><div class="val">${esc(cur.name || pj.phase)}</div><div class="sub">다음 · ${esc(next.date || "")} ${esc(next.title || "")}</div></a>
    <a class="tile" href="#/run/fu"><div class="lbl">할 일 미완료<span class="ic">${ICON.list}</span></div><div class="val num">${fuOpen.length}<small> / ${d.fu.length}</small></div><div class="sub">진행중 ${fuC["진행중"] || 0} · 보류 ${fuC["보류"] || 0} · 완료 ${fuC["완료"] || 0}</div>${stack(fuC, [["완료", "--lv-ok"], ["진행중", "--c7"], ["보류", "--lv-warn"]])}</a>
    <a class="tile" href="#/run/inq"><div class="lbl">U+ 질의 미답변<span class="ic">${ICON.q}</span></div><div class="val num">${qOpen.length}<small> / ${d.inquiries.length}</small></div><div class="sub">작성 ${qC["작성"] || 0} · 전달 ${qC["전달"] || 0} · 답변 ${qC["답변"] || 0}</div>${stack(qC, [["반영완료", "--lv-ok"], ["답변", "--c3"], ["전달", "--c7"], ["작성", "--baseline"]])}</a>
    <a class="tile" href="#/run/issue"><div class="lbl">열린 이슈·리스크<span class="ic">${ICON.alert}</span></div><div class="val num">${iOpen.length}</div><div class="sub">영향 상 ${iOpen.filter((x) => x.impact === "상").length} · 중 ${iOpen.filter((x) => x.impact === "중").length} · 하 ${iOpen.filter((x) => x.impact === "하").length}</div></a>
  </div>
  <div class="duo">
    <div>
      ${card("우선 할 일", "미완료 · 우선순위순", table(["ID", "할 일", "담당", "기한", "상태"], top.map((x) => `<tr class="click" onclick="location.hash='#/run/fu/${x.id}'"><td class="id">${x.id}</td><td>${esc(x.title)}</td><td class="nw sm">${esc(x.owner)}</td><td class="dt">${esc(x.due)}</td><td>${lv(x.status)}</td></tr>`), S.apiOk ? "미완료 할 일 없음" : "D1 연결 필요"), `<a class="btn sm" href="#/run/fu">전체</a>`)}
      ${card("미답변 U+ 질의", "작성·전달 상태", table(["ID", "질의", "요구사항", "상태"], qOpen.slice(0, 6).map((x) => `<tr class="click" onclick="location.hash='#/run/inq/${x.id}'"><td class="id">${x.id}</td><td>${esc(x.title)}</td><td>${reqChips(x.reqs)}</td><td>${lv(x.status)}</td></tr>`), S.apiOk ? "미답변 질의 없음" : "D1 연결 필요"), `<a class="btn sm" href="#/run/inq">전체</a>`)}
    </div>
    ${card("요구사항 갭 분포", "세일즈올 현행 대비", donut([["충족", "--lv-ok"], ["부분", "--lv-warn"], ["미충족", "--lv-critical"], ["확인필요", "--c7"]].map(([l, c]) => ({ l, c, n: gapC[l] || 0, href: "#/req/list" })), d.requirements.length, "요구사항"))}
  </div>
  <div class="half">
    ${card("리스크", "", C.risks.length ? `<ul class="clean">${iOpen.filter((x) => x.type === "리스크").map((x) => `<li><a href="#/run/issue/${x.id}">${x.id}</a> ${esc(x.title)} ${lv(x.impact)}</li>`).join("") || C.risks.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "")}
    ${card("최근 결정", "", `<ul class="tl">${d.decisions.slice(-4).reverse().map((x) => `<li><div class="when">${esc(x.decided_at)}</div><div><div class="hd"><a href="#/run/dec/${x.id}"><b>${x.id}</b></a>${lv(x.status)}</div><div class="sm">${esc(x.title)}</div></div></li>`).join("") || `<li><div class="muted">결정 없음</div></li>`}</ul>`)}
  </div>`;
};

P.run = (m, sub, id) => {
  const map = { fu: ["fu", "#/run/fu"], inq: ["inquiries", "#/run/inq"], dec: ["decisions", "#/run/dec"], issue: ["issues", "#/run/issue"] };
  const [key, base] = map[sub] || map.fu;
  if (id) return detailPage(m, key, id, base);
  const lead = { inquiries: "U+ 확인이 필요한 항목의 질의 → 전달 → 답변 → 요구사항 반영 추적. 상태 '전달'·'답변' 변경 시 전달일·답변일 자동 기록", decisions: "회의·협의 결정 사항 누적. 번복 시 상태 '번복' + 신규 결정 등록", issues: "일정·공수·의존성 리스크와 발생 이슈 관리" }[key];
  listPage(m, key, base, { lead });
};

P.req = (m, sub, id) => {
  if (sub === "matrix") return P.matrix(m);
  if (sub === "gap") return P.gap(m);
  if (sub === "check") {
    if (id) return detailPage(m, "checks", id, "#/req/check");
    return listPage(m, "checks", "#/req/check", { lead: "U+ 테스트 계정 검증 항목 (크로스 분석 기반). 결과 변경 시 확인자·확인일 자동 기록", title: "검증 체크리스트" });
  }
  if (id) return detailPage(m, "requirements", id, "#/req/list", relatedReqCard);
  const R = S.d.requirements;
  listPage(m, "requirements", "#/req/list", {
    title: "요구사항 목록", desc: "회의 도출 R01~R17 · 가이드 분석(제안) R18~R22 · 크로스 분석(제안) R23~",
    selects: [["area", "영역", [...new Set(R.map((r) => r.area))]], ["operators", "사업자", ["유모바일", "헬로모바일", "기타MVNO"]], ["scope", "범위", ["필수", "선택", "미정"]], ["source", "출처", [...new Set(R.map((r) => r.source))]]],
    tools: `<button class="btn sm" id="csv">CSV</button>`,
    after: (mm, rows) => { const b = $("#csv"); if (b) b.onclick = () => csv(rows); },
  });
};
function csv(rows) {
  const cols = ["id", "area", "title", "detail", "source", "current_state", "guide_ref", "operators", "scope", "gap", "decision", "priority", "status", "note", "updated_at", "updated_by"];
  const head = ["ID", "영역", "요구사항", "배경·근거", "출처", "세일즈올 현행", "가이드", "사업자", "범위", "갭", "판단", "우선", "진행", "비고", "수정일(UTC)", "수정자"];
  const line = (a) => a.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + [line(head), ...rows.map((r) => line(cols.map((c) => r[c])))].join("\r\n")], { type: "text/csv" }));
  a.download = `요구사항_${today()}.csv`; a.click();
}

P.matrix = (m) => {
  const ops = ["유모바일", "헬로모바일", "기타MVNO"];
  const f = (F.matrix = F.matrix || { scope: "" });
  const rows = S.d.requirements.filter((r) => !f.scope || r.scope === f.scope);
  const on = (r, o) => r.operators === "공통" || ids(r.operators).includes(o) || ids(r.operators).includes("공통");
  const tot = ops.map((o) => rows.filter((r) => on(r, o)).length);
  const sc = count(S.d.requirements, "scope");
  m.innerHTML = `<p class="lead">요구사항 × 사업자 적용 범위. '공통'은 전 사업자 적용. 적용 사업자·범위 수정은 요구사항 상세에서 처리</p>` + card("사업자별 매트릭스", `${rows.length}건`, `
    <div class="toolbar"><div class="seg">${[["", "전체", S.d.requirements.length], ...["필수", "선택", "미정"].map((v) => [v, v, sc[v] || 0])].map(([v, l, n]) => `<button data-sc="${v}" aria-pressed="${f.scope === v}">${l}<span class="n">${n}</span></button>`).join("")}</div></div>
    ${table(["ID", "영역", "요구사항", ...ops.map((o) => `<span style="display:block;text-align:center">${o}</span>`), "범위", "갭"], rows.map((r) => `<tr class="click" onclick="location.hash='#/req/list/${r.id}'"><td class="id">${r.id}</td><td class="nw sm">${esc(r.area)}</td><td>${esc(r.title)}</td>${ops.map((o) => `<td class="c"><span class="dot ${on(r, o) ? "" : "off"}"></span></td>`).join("")}<td>${lv(r.scope)}</td><td>${lv(r.gap)}</td></tr>`).concat(rows.length ? [`<tr><td></td><td></td><td class="sm"><b>사업자별 적용 건수</b></td>${tot.map((n) => `<td class="c num"><b>${n}</b></td>`).join("")}<td></td><td></td></tr>`] : []))}`);
  m.querySelectorAll("[data-sc]").forEach((b) => (b.onclick = () => { f.scope = b.dataset.sc; render(); }));
};

P.gap = (m) => {
  const X = S.content.cross;
  const f = (F.gap = F.gap || { v: "" });
  const VT = { "일치": "ok", "상이": "critical", "가이드 미기재": "info" };
  const vtag = (x) => `<span class="lv lv-${VT[x]}"><span class="chip"></span>${esc(x)}</span>`;
  const cnt = count(X.matrix, "verdict");
  const rows = X.matrix.filter((r) => !f.v || r.verdict === f.v);
  m.innerHTML = `<p class="lead">${esc(X.basis)} 대조 결과. '크로스 분석(제안)' 항목은 회의 외 추가 검토 대상</p>
  <div class="tiles">${X.summary.map(([a, b, c], i) => `<div class="tile ${i === 0 ? "hero" : ""}"><div class="lbl">${esc(a)}<span class="ic">${ICON.chart}</span></div><div class="val" style="font-size:17px;line-height:1.5;white-space:normal">${esc(b)}</div><div class="sub" style="white-space:normal">${esc(c)}</div></div>`).join("")}</div>`
  + card("회의 안건 × 가이드 현행", "일치: 회의 인식과 가이드 부합 · 상이: 불일치 · 가이드 미기재: 판단 불가", `
    <div class="toolbar"><div class="seg">${[["", "전체", X.matrix.length], ...["일치", "상이", "가이드 미기재"].map((k) => [k, k, cnt[k] || 0])].map(([v, l, n]) => `<button data-v="${v}" aria-pressed="${f.v === v}">${l}<span class="n">${n}</span></button>`).join("")}</div></div>
    ${table(["안건", "회의 현황·요구", "가이드 현행", "판정", "시사점", "요구사항"], rows.map((r) => `<tr><td class="nw"><b>${esc(r.agenda)}</b><span class="cue">${esc(r.t)}</span></td><td class="sm">${esc(r.meeting)}</td><td class="sm">${esc(r.guide)} ${slideChips(r.slides)}</td><td>${vtag(r.verdict)}</td><td class="sm">${esc(r.note)}</td><td>${reqChips(r.reqs)}</td></tr>`))}`)
  + `<div class="half">${card("회의 인식 정정", `${X.corrections.length}건`, table(["항목", "회의 발언 → 가이드 확인", "잔여 확인"], X.corrections.map(([a, b, c, d]) => `<tr><td class="nw"><b>${esc(a)}</b></td><td class="sm">${esc(b)}<span class="cue">→ ${esc(c)}</span></td><td class="sm">${esc(d.replace(/^잔여 확인:\s*/, ""))}</td></tr>`)))}
    ${card("가이드 확인 불가", `${X.unverifiable.length}건 · 테스트 계정·U+ 확인`, table(["요구사항", "확인 대상"], X.unverifiable.map(([a, b, c]) => `<tr><td>${reqChips(a)}</td><td>${esc(b)}<span class="cue">※ ${esc(c)}</span></td></tr>`)))}</div>`
  + card("회의 미논의 가이드 기능", "MVNO 적용 검토 · 크로스 분석(제안)", table(["기능", "가이드 현행", "MVNO 검토 쟁점", "요구사항"], X.uncovered.map((r) => `<tr><td class="nw"><b>${esc(r.item)}</b></td><td class="sm">${esc(r.guide)} ${slideChips(r.slides)}</td><td class="sm">${esc(r.impact)}</td><td>${reqChips(r.req)}</td></tr>`)))
  + comments("general", "cross");
  m.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { f.v = b.dataset.v; render(); }));
  bindComments("general", "cross");
};

P.plan = (m, sub, id) => {
  const C = S.content;
  if (sub === "meeting") return id ? P.meeting(m, id) : P.meetings(m);
  m.innerHTML = card("단계", "프로젝트 단계별 산출물", `<div class="phases">${C.phases.map((p) => `<div class="phase ${p.state}"><div class="pn">${p.state === "current" ? lv("진행중") : ""}${esc(p.name)}</div><div class="pp">${esc(p.period)}</div><ul>${p.outputs.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div>`).join("")}</div>`)
  + `<div class="duo">${card("일정", "U+ 로드맵 포함", `<ul class="tl">${C.schedule.map((s) => `<li><div class="when">${esc(s.date)}</div><div><div class="hd"><b>${esc(s.title)}</b>${s.kind === "U+ 로드맵" ? '<span class="tag-src">U+ 로드맵</span>' : ""}${{ done: lv("완료"), next: lv("진행중") }[s.state] || ""}</div>${s.note ? `<div class="ct">※ ${esc(s.note)}</div>` : ""}</div></li>`).join("")}</ul>`)}
    ${card("일정 리스크", "", `<ul class="clean">${C.risks.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><div style="margin-top:12px"><a class="btn sm" href="#/run/issue">이슈·리스크</a></div>`)}</div>`;
};
P.meetings = (m) => {
  const ms = S.content.meetings;
  m.innerHTML = card("회의록", `${ms.length}건 · 신규 회의는 content.json meetings 배열에 추가`, table(["일자", "회의", "구분", "결정", "할 일", "요구사항"], ms.map((x) => {
    const d = S.d.decisions.filter((r) => r.source === x.id).length, a = S.d.fu.filter((r) => r.source === x.ref).length, q = S.d.requirements.filter((r) => r.source === x.ref).length;
    return `<tr class="click" onclick="location.hash='#/plan/meeting/${x.id}'"><td class="dt">${esc(x.date)}</td><td><b>${esc(x.title)}</b></td><td>${lv(x.kind || "-")}</td><td class="num">${d}</td><td class="num">${a}</td><td class="num">${q}</td></tr>`;
  })));
};
P.meeting = (m, id) => {
  const x = S.content.meetings.find((r) => r.id === id);
  if (!x) { m.innerHTML = card("회의록", "", `<div class="empty">회의 없음</div>`); return; }
  const dec = S.d.decisions.filter((r) => r.source === x.id), act = S.d.fu.filter((r) => r.source === x.ref), req = S.d.requirements.filter((r) => r.source === x.ref);
  m.innerHTML = `<div class="duo"><div>
    ${card(esc(x.title), esc(x.date), `<dl class="kv">${x.overview.map(([k, v, n]) => `<dt>${esc(k)}</dt><dd>${esc(v)}${n ? `<span class="cue">※ ${esc(n)}</span>` : ""}</dd>`).join("")}</dl>`, `<a class="btn sm" href="#/plan/meeting">목록</a>`)}
    ${card("핵심 요약", "", `<ul class="clean">${x.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`)}
    ${card("안건별 논의", `${x.agenda.length}건`, table(["안건", "현황·문제", "요구사항·의견"], x.agenda.map(([a, t, s, r]) => `<tr><td class="nw"><b>${esc(a)}</b><span class="cue">${esc(t)}</span></td><td class="sm">${esc(s)}</td><td class="sm">${esc(r)}</td></tr>`)))}
    ${card("미결·확인 필요", "", `<ul class="clean">${x.open.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`)}
  </div><div>
    ${card("결정", `${dec.length}건 · 결정 로그`, `<ul class="tl">${dec.map((r) => `<li><div class="when"><a href="#/run/dec/${r.id}">${r.id}</a></div><div><div class="sm" style="margin:0">${esc(r.title)}</div></div></li>`).join("") || `<li><div class="muted">없음</div></li>`}</ul>`)}
    ${card("액션 (할 일)", `${act.length}건`, table(["ID", "할 일", "상태"], act.map((r) => `<tr class="click" onclick="location.hash='#/run/fu/${r.id}'"><td class="id">${r.id}</td><td class="sm">${esc(r.title)}<span class="cue">${esc(r.owner)} · ${esc(r.due)}</span></td><td>${lv(r.status)}</td></tr>`)))}
    ${card("도출 요구사항", `${req.length}건`, `<div>${req.map((r) => `<a class="chn" href="#/req/list/${r.id}" title="${esc(r.title)}">${r.id}</a>`).join("")}</div>`)}
    ${comments("meeting", x.id)}
  </div></div>`;
  bindComments("meeting", x.id);
};

P.ref = (m, sub, id) => {
  const C = S.content, G = C.guide;
  if (sub === "glossary") {
    m.innerHTML = card("용어집", "녹취록 음성인식 표기 → 실제 의미 보정 포함", table(["용어", "의미", "비고"], C.glossary.map(([a, b, c]) => `<tr><td class="nw"><b>${esc(a)}</b></td><td>${esc(b)}</td><td class="sm">${esc(c)}</td></tr>`)));
    return;
  }
  if (sub === "docs") {
    m.innerHTML = card("자료실", "자료 위치·보유 현황", `<div class="docs">${C.docs.map(([a, b, c, d]) => `<div class="doc"><span class="ic">${ICON.doc}</span><div><b>${esc(a)}</b><span>${esc(b)}</span><span class="mono" style="margin-top:6px">${c === "미보유" ? lv("미보유") : esc(c)}</span>${d ? `<span>${esc(d)}</span>` : ""}</div></div>`).join("")}</div>`);
    return;
  }
  if (id) {
    const n = Number(id), s = G.slides[n - 1];
    if (!s) { m.innerHTML = card("가이드", "", `<div class="empty">슬라이드 없음</div>`); return; }
    const rel = S.d.requirements.filter((r) => ids(r.guide_ref).includes(String(n)));
    m.innerHTML = `<div class="duo"><div>${card(`p.${n} · ${esc(s.title)}`, "", `<div class="slide"><img src="${s.img}" alt="p.${n}"></div>${s.text ? `<p class="lead" style="margin:14px 0 0">${esc(s.text)}</p>` : ""}`,
      `<a class="btn sm" href="#/ref/guide">목록</a>${n > 1 ? `<a class="btn sm" href="#/ref/guide/${n - 1}">이전</a>` : ""}${n < G.slides.length ? `<a class="btn sm" href="#/ref/guide/${n + 1}">다음</a>` : ""}`)}</div>
      <div>${card("관련 요구사항", `${rel.length}건`, rel.length ? table(["ID", "요구사항", "갭"], rel.map((r) => `<tr class="click" onclick="location.hash='#/req/list/${r.id}'"><td class="id">${r.id}</td><td>${esc(r.title)}</td><td>${lv(r.gap)}</td></tr>`)) : `<div class="muted">없음</div>`)}${comments("guide", "p." + n)}</div></div>`;
    bindComments("guide", "p." + n);
    return;
  }
  const reqBy = {};
  S.d.requirements.forEach((r) => ids(r.guide_ref).forEach((n) => (reqBy[n] = (reqBy[n] || 0) + 1)));
  m.innerHTML = card(esc(G.title), `${esc(G.file)} · ${G.pages}p`, `<dl class="kv">${G.overview.map(([k, a, b]) => `<dt>${esc(k)}</dt><dd>${esc(a)}${b ? `<span class="cue">※ ${esc(b)}</span>` : ""}</dd>`).join("")}</dl>`)
  + card("신청서 작성 단계", "Mobile 신규가입", `<div class="steps">${G.steps.map((s, i) => `<div class="step"><h3>${i + 1}. ${esc(s.name)}</h3><div>${slideChips(s.slides.join(","))}</div><ul>${s.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("")}</div>`)
  + `<div class="half">${card("편리 기능", "", table(["기능", "설명", ""], G.features.map(([a, b, n]) => `<tr><td class="nw"><b>${esc(a)}</b></td><td class="sm">${esc(b)}</td><td>${slideChips(String(n))}</td></tr>`)))}
    ${card("FAQ", "", table(["", "질문 · 조치", ""], G.faq.map(([q, a, b, n]) => `<tr><td class="id">${q}</td><td><b style="font-weight:600">${esc(a)}</b><span class="cue">${esc(b)}</span></td><td>${slideChips(String(n))}</td></tr>`)))}</div>`
  + card("슬라이드", `${G.slides.length}장 · 요구사항 연결 건수 표시`, `<div class="thumbs">${G.slides.map((s) => `<a class="thumb" href="#/ref/guide/${s.n}"><img loading="lazy" src="${s.img}" alt="p.${s.n}"><span>p.${s.n} ${esc(s.title)}${reqBy[s.n] ? ` · 요구사항 ${reqBy[s.n]}` : ""}</span></a>`).join("")}</div>`);
};

P.admin = async (m, sub) => {
  const C = S.content;
  if (sub === "settings") {
    m.innerHTML = `<div class="half">${card("참여자", "Cloudflare Access 허용 대상 기준", table(["소속", "구분", "비고"], C.participants.map(([a, b, c]) => `<tr><td class="nw"><b>${esc(a)}</b></td><td>${esc(b)}</td><td class="sm">${esc(c)}</td></tr>`)))}
      ${card("사업자", "요구사항 '적용 사업자' 선택값", table(["사업자", "설명"], C.operators.map(([a, b]) => `<tr><td class="nw"><b>${esc(a)}</b></td><td class="sm">${esc(b)}</td></tr>`)))}</div>`
      + card("상태값 정의", "", table(["대상", "값"], [["할 일", E.fu.seg.vals], ["U+ 질의", E.inquiries.seg.vals], ["결정", E.decisions.seg.vals], ["이슈·리스크", E.issues.seg.vals], ["요구사항 갭", E.requirements.seg.vals], ["요구사항 범위", ["필수", "선택", "미정"]], ["검증 결과", E.checks.seg.vals]].map(([a, v]) => `<tr><td class="nw"><b>${a}</b></td><td>${v.map(lv).join(" ")}</td></tr>`)))
      + card("시스템", "", `<dl class="kv"><dt>로그인</dt><dd>${esc(S.me || "-")}</dd><dt>D1</dt><dd>${S.apiOk ? lv("정상") : lv("이슈")}</dd><dt>참여자·사업자 수정</dt><dd>public/data/content.json 편집 후 커밋</dd><dt>접근 제어</dt><dd>Cloudflare Access (Zero Trust) 정책</dd></dl>`);
    return;
  }
  if (!S.apiOk) { m.innerHTML = card("변경 이력", "", `<div class="empty">D1 연결 필요</div>`); return; }
  const rows = await api("changelog?limit=300");
  const ENT = { fu: ["할 일", "#/run/fu/"], requirement: ["요구사항", "#/req/list/"], inquiry: ["U+ 질의", "#/run/inq/"], decision: ["결정", "#/run/dec/"], issue: ["이슈", "#/run/issue/"], check: ["검증", "#/req/check/"], feedback: ["코멘트", null] };
  const ACT = { create: "등록", update: "수정", delete: "삭제" };
  const FL = { title: "제목", item: "항목", status: "상태", priority: "우선", owner: "담당", due: "기한", note: "비고", source: "출처", area: "영역", detail: "배경", current_state: "현행", guide_ref: "가이드", gap: "갭", decision: "판단", operators: "사업자", scope: "범위", reqs: "요구사항", answer: "답변", asked_at: "전달일", answered_at: "답변일", result: "결과", checked_by: "확인자", checked_at: "확인일", impact: "영향", type: "구분", action: "대응", rationale: "근거", target: "대상", reply: "답변", body: "내용" };
  const diffTxt = (d) => { try { return Object.entries(JSON.parse(d || "{}")).map(([k, [a, b]]) => `${FL[k] || k}: ${a == null ? "" : String(a).slice(0, 30)} → ${b == null ? "" : String(b).slice(0, 40)}`).join(" / "); } catch { return ""; } };
  m.innerHTML = card("변경 이력", `최근 ${rows.length}건`, `<ul class="tl">${rows.map((r) => { const [l, h] = ENT[r.entity] || [r.entity, null]; const idt = r.entity === "feedback" ? "#" + r.entity_id : r.entity_id; return `<li><div class="when">${esc(toKST(r.at))}</div><div><div class="hd">${h && r.action !== "delete" ? `<a href="${h}${r.entity_id}"><b>${l} ${esc(idt)}</b></a>` : `<b>${l} ${esc(idt)}</b>`}${lv(ACT[r.action] || r.action)}<span class="tag-src">${esc(r.actor)}</span></div>${diffTxt(r.diff) ? `<div class="sm">${esc(diffTxt(r.diff))}</div>` : ""}</div></li>`; }).join("") || `<li><div class="muted">없음</div></li>`}</ul>`);
};

// ================= 내비게이션 =================
const NAV = [
  { k: "home", l: "홈", y: () => (S.content.phases || []).find((p) => p.state === "current")?.name || "" },
  { k: "run", l: "실행 관리", subs: [["fu", "할 일"], ["inq", "U+ 질의"], ["dec", "결정 로그"], ["issue", "이슈·리스크"]],
    y: () => `미완료 ${S.d.fu.filter((x) => x.status !== "완료").length}`, alert: () => S.d.issues.some((x) => x.status !== "해소" && x.impact === "상") },
  { k: "req", l: "요구사항", subs: [["list", "목록"], ["matrix", "사업자별 매트릭스"], ["gap", "갭 분석"], ["check", "검증 체크리스트"]], y: () => `${S.d.requirements.length}건` },
  { k: "plan", l: "일정·회의", subs: [["milestone", "마일스톤"], ["meeting", "회의록"]], y: () => (S.content.schedule.find((s) => s.state === "next") || {}).date || "" },
  { k: "ref", l: "레퍼런스", subs: [["guide", "세일즈올 가이드"], ["glossary", "용어집"], ["docs", "자료실"]], y: () => `가이드 ${S.content.guide.pages}p` },
  { k: "admin", l: "관리", subs: [["log", "변경 이력"], ["settings", "참여자·사업자"]], y: () => (S.apiOk ? "D1" : "오프라인") },
];
const ADD = { "run/fu": "fu", "run/inq": "inquiries", "run/dec": "decisions", "run/issue": "issues", "req/list": "requirements", "req/check": "checks" };

function route() {
  const [g = "home", sub, id] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const nav = NAV.find((n) => n.k === g) || NAV[0];
  return { nav, sub: nav.subs ? (nav.subs.find((s) => s[0] === sub) ? sub : nav.subs[0][0]) : null, id };
}
let lastRoute = "";
async function render() {
  const { nav, sub, id } = route();
  const rk = `${nav.k}/${sub}/${id || ""}`;
  if (rk !== lastRoute) { if (S.form && !(S.form.row && S.form.row === id)) S.form = null; lastRoute = rk; }
  const C = S.content, pj = C.project;
  $("#hTitle").textContent = pj.name;
  $("#hSub").textContent = `${pj.goal} · ${pj.targets}`;
  $("#tabs").innerHTML = NAV.map((n) => `<a class="tab ${n.alert && n.alert() ? "alert" : ""}" role="tab" href="#/${n.k}" aria-selected="${n.k === nav.k}"><span class="y">${esc(n.y())}</span><span class="m">${n.l}</span></a>`).join("");
  $("#subnav").innerHTML = nav.subs ? `<nav class="seg">${nav.subs.map(([k, l]) => `<a href="#/${nav.k}/${k}" aria-pressed="${k === sub}">${l}</a>`).join("")}</nav>` : "";
  const next = C.schedule.find((s) => s.state === "next") || {};
  $("#meta").innerHTML = `<span>기준일 ${esc(pj.baseDate)}</span><span class="pill">${esc(pj.phase)}</span><span>다음 · ${esc(next.date || "")} ${esc(next.title || "")}</span>${S.me ? `<span>${esc(S.me)}</span>` : ""}`;
  const addKey = ADD[`${nav.k}/${sub}`];
  const ab = $("#addBtn");
  ab.hidden = !(S.apiOk && addKey && !id);
  if (addKey) { $("#addLbl").textContent = `${E[addKey].name} 등록`; ab.onclick = () => { S.form = { key: addKey, row: null }; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }; }
  const m = $("#main");
  try { await P[nav.k](m, sub, id); } catch (e) { m.innerHTML = card("오류", "", `<div class="empty">${esc(e.message)}</div>`); console.error(e); }
}
window.addEventListener("hashchange", () => { if (legacy()) return; render(); window.scrollTo(0, 0); });
$("#themeBtn").onclick = () => {
  const root = document.documentElement;
  const cur = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const nx = cur === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", nx);
  try { localStorage.setItem("salesall-theme", nx); } catch (e) {}
};
// 구 경로 호환 (#/fu, #/req/R01, #/guide/9 등)
function legacy() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  const map = { dashboard: "#/home", fu: "#/run/fu", feedback: "#/home", meeting: "#/plan/meeting", guide: "#/ref/guide", glossary: "#/ref/glossary", docs: "#/ref/docs", log: "#/admin/log", cross: "#/req/gap" };
  if (map[h[0]]) { location.replace(map[h[0]] + (h[1] ? "/" + h[1] : "")); return true; }
  if (h[0] === "req" && /^R\d+/.test(h[1] || "")) { location.replace("#/req/list/" + h[1]); return true; }
  return false;
}
legacy();
loadAll().then(render);
})();
