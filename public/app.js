/* SalesAll MVNO 프로젝트 관리 — 프런트엔드 (빌드 없음, Vanilla JS) */
(() => {
"use strict";

const S = { content: null, fu: [], req: [], fb: [], me: "", apiOk: true };

const ENUM = {
  fuStatus: ["미착수", "진행중", "완료", "보류"],
  priority: ["상", "중", "하"],
  gap: ["충족", "부분", "미충족", "확인필요"],
  decision: ["결정", "요구", "미결", "제외"],
  reqStatus: ["취합", "U+전달", "반영확정", "제외"],
  fbCat: ["의견", "질문", "이슈", "결정요청"],
  fbStatus: ["접수", "검토중", "완료"],
};
const TONE = {
  "완료": "ok", "진행중": "info", "미착수": "", "보류": "warn",
  "상": "bad", "중": "warn", "하": "",
  "충족": "ok", "부분": "warn", "미충족": "bad", "확인필요": "info",
  "결정": "ok", "요구": "pri", "미결": "warn", "제외": "",
  "취합": "", "U+전달": "info", "반영확정": "ok",
  "접수": "warn", "검토중": "info",
  "의견": "", "질문": "info", "이슈": "bad", "결정요청": "pri",
};
const TARGET_LABEL = { general: "일반", fu: "F/U", requirement: "요구사항", meeting: "회의록", guide: "가이드" };

// ---------- util ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tag = (v) => (v ? `<span class="tag ${TONE[v] ? "t-" + TONE[v] : ""}">${esc(v)}</span>` : "");
const opts = (arr, sel, all) => (all ? `<option value="">${all}</option>` : "") + arr.map((v) => `<option ${v === sel ? "selected" : ""}>${esc(v)}</option>`).join("");
const fmtAt = (s) => (s ? s.replace("T", " ").slice(0, 16) : "");
const toKST = (s) => { if (!s) return ""; const d = new Date(s.replace(" ", "T") + "Z"); return isNaN(d) ? s : new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " "); };
const slideLinks = (ref) => String(ref || "").split(",").map((s) => s.trim()).filter(Boolean).map((n) => `<a class="chip-link" href="#/guide/${n}">p.${n}</a>`).join("");
const count = (arr, k) => arr.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200);
}

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
    const [me, fu, req, fb] = await Promise.all([api("me"), api("fu"), api("requirements"), api("feedback")]);
    S.me = me.email; S.fu = fu; S.req = req; S.fb = fb; S.apiOk = true;
    $("#banner").innerHTML = "";
  } catch (e) {
    S.apiOk = false;
    $("#banner").innerHTML = `<div class="banner">API·D1 연결 실패 — 조회 전용 모드 (${esc(e.message)}). F/U·요구사항·피드백은 D1 연결 후 표시됩니다.</div>`;
  }
  $("#me").textContent = S.me ? "로그인: " + S.me : "";
}
async function reload(kind) {
  if (!S.apiOk) return;
  if (!kind || kind === "fu") S.fu = await api("fu");
  if (!kind || kind === "req") S.req = await api("requirements");
  if (!kind || kind === "fb") S.fb = await api("feedback");
}

// ---------- modal / form ----------
function openModal(title, html, onMount) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  $("#modal").hidden = false;
  onMount && onMount($("#modalBody"));
}
function closeModal() { $("#modal").hidden = true; $("#modalBody").innerHTML = ""; }
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-close]") || e.target.id === "modal") closeModal();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });

function formHtml(fields, data = {}) {
  return `<form class="form" id="frm">` + fields.map((f) => {
    const v = data[f.k] ?? f.def ?? "";
    let ctl;
    if (f.enum) ctl = `<select name="${f.k}">${opts(f.enum, v)}</select>`;
    else if (f.area) ctl = `<textarea name="${f.k}" rows="${f.rows || 3}">${esc(v)}</textarea>`;
    else ctl = `<input type="text" name="${f.k}" value="${esc(v)}" ${f.req ? "required" : ""} placeholder="${esc(f.ph || "")}">`;
    return `<label class="${f.full ? "full" : ""}">${esc(f.l)}${f.req ? " *" : ""}${ctl}</label>`;
  }).join("") + `</form>`;
}
function readForm(el) {
  const o = {};
  new FormData($("#frm", el)).forEach((v, k) => (o[k] = String(v)));
  return o;
}

const FU_FIELDS = [
  { k: "title", l: "할 일", req: true, full: true },
  { k: "owner", l: "담당" }, { k: "due", l: "기한", ph: "즉시 / 다음 주 / 2026-12" },
  { k: "status", l: "상태", enum: ENUM.fuStatus }, { k: "priority", l: "우선순위", enum: ENUM.priority, def: "중" },
  { k: "source", l: "근거", ph: "회의 11/05" },
  { k: "note", l: "비고", area: true, full: true },
];
const REQ_FIELDS = [
  { k: "area", l: "영역", req: true }, { k: "source", l: "출처", ph: "회의 11/05 / 가이드 분석(제안)" },
  { k: "title", l: "요구사항", req: true, full: true },
  { k: "detail", l: "배경·근거", area: true, full: true },
  { k: "current_state", l: "세일즈올 현행 (가이드 기준)", area: true, full: true },
  { k: "guide_ref", l: "가이드 슬라이드", ph: "9,18" },
  { k: "gap", l: "갭", enum: ENUM.gap, def: "확인필요" },
  { k: "decision", l: "판단", enum: ENUM.decision, def: "요구" },
  { k: "priority", l: "우선순위", enum: ENUM.priority, def: "중" },
  { k: "status", l: "진행", enum: ENUM.reqStatus, def: "취합" },
  { k: "note", l: "비고", area: true, full: true, rows: 2 },
];

function editModal(kind, row) {
  const isFu = kind === "fu";
  const fields = isFu ? FU_FIELDS : REQ_FIELDS;
  const ep = isFu ? "fu" : "requirements";
  const title = (row ? row.id + " 수정" : "신규 등록") + (isFu ? " — F/U" : " — 요구사항");
  openModal(title, formHtml(fields, row || {}) + `
    <div class="form-actions">
      ${row ? `<button class="btn danger" id="del">삭제</button><span class="sp"></span>` : ""}
      <button class="btn" data-close>취소</button><button class="btn pri" id="save">저장</button>
    </div>`, (el) => {
    $("#save", el).onclick = async () => {
      const body = readForm(el);
      if (fields.some((f) => f.req && !body[f.k].trim())) return toast("필수 항목 입력 필요");
      try {
        await api(row ? `${ep}/${encodeURIComponent(row.id)}` : ep, { method: row ? "PATCH" : "POST", body });
        await reload(isFu ? "fu" : "req"); closeModal(); toast("저장 완료"); render();
      } catch (e) { toast("저장 실패: " + e.message); }
    };
    const d = $("#del", el);
    if (d) d.onclick = async () => {
      if (!confirm(`${row.id} 삭제`)) return;
      try { await api(`${ep}/${encodeURIComponent(row.id)}`, { method: "DELETE" }); await reload(isFu ? "fu" : "req"); closeModal(); toast("삭제 완료"); location.hash = isFu ? "#/fu" : "#/req"; render(); }
      catch (e) { toast("삭제 실패: " + e.message); }
    };
  });
}

// ---------- 피드백 스레드 ----------
function threadHtml(list, opt = {}) {
  if (!list.length) return `<div class="empty">등록된 피드백 없음</div>`;
  return `<div class="thread">` + list.map((f) => `
    <div class="fb" data-id="${f.id}">
      <div class="meta">${tag(f.category)} ${tag(f.status)}
        ${opt.showTarget ? `<span class="chip-link">${esc(TARGET_LABEL[f.target_type] || f.target_type)}${f.target_id ? " · " + esc(f.target_id) : ""}</span>` : ""}
        <span>${esc(f.author)}</span><span>${esc(toKST(f.created_at))}</span><span class="sp"></span>
        ${S.apiOk ? `<button class="btn sm ghost" data-fb-edit="${f.id}">처리</button>` : ""}
      </div>
      <div class="body">${esc(f.body)}</div>
      ${f.reply ? `<div class="reply"><b>답변</b> ${esc(f.reply)}</div>` : ""}
    </div>`).join("") + `</div>`;
}
function fbFormHtml(target) {
  return `<div class="card mt"><h2>피드백 등록</h2>
    <div class="form">
      ${target ? "" : `<label>대상<select id="fbTT">${Object.entries(TARGET_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <label>대상 ID<input type="text" id="fbTI" placeholder="R01 / F3 / p.9"></label>`}
      <label>구분<select id="fbCat">${opts(ENUM.fbCat)}</select></label>
      <label class="full">내용<textarea id="fbBody" placeholder="의견·질문·이슈 입력"></textarea></label>
    </div>
    <div class="form-actions"><button class="btn pri" id="fbSend" ${S.apiOk ? "" : "disabled"}>등록</button></div></div>`;
}
function bindFb(root, target) {
  const send = $("#fbSend", root);
  if (send) send.onclick = async () => {
    const body = $("#fbBody", root).value.trim();
    if (!body) return toast("내용 입력 필요");
    const payload = target
      ? { ...target, category: $("#fbCat", root).value, body }
      : { target_type: $("#fbTT", root).value, target_id: $("#fbTI", root).value.trim(), category: $("#fbCat", root).value, body };
    try { await api("feedback", { method: "POST", body: payload }); await reload("fb"); toast("등록 완료"); render(); }
    catch (e) { toast("등록 실패: " + e.message); }
  };
  root.querySelectorAll("[data-fb-edit]").forEach((b) => (b.onclick = () => {
    const f = S.fb.find((x) => String(x.id) === b.dataset.fbEdit);
    openModal(`피드백 #${f.id} 처리`, `
      <div class="fb"><div class="meta">${tag(f.category)} ${esc(f.author)} · ${esc(toKST(f.created_at))}</div><div class="body">${esc(f.body)}</div></div>
      <div class="form mt"><label>상태<select id="eSt">${opts(ENUM.fbStatus, f.status)}</select></label>
      <label>구분<select id="eCat">${opts(ENUM.fbCat, f.category)}</select></label>
      <label class="full">답변·처리 내용<textarea id="eRep">${esc(f.reply)}</textarea></label></div>
      <div class="form-actions"><button class="btn danger" id="eDel">삭제</button><span class="sp"></span><button class="btn" data-close>취소</button><button class="btn pri" id="eSave">저장</button></div>`, (el) => {
      $("#eSave", el).onclick = async () => {
        try { await api("feedback/" + f.id, { method: "PATCH", body: { status: $("#eSt", el).value, category: $("#eCat", el).value, reply: $("#eRep", el).value } }); await reload("fb"); closeModal(); toast("저장 완료"); render(); }
        catch (e) { toast("저장 실패: " + e.message); }
      };
      $("#eDel", el).onclick = async () => {
        if (!confirm("피드백 삭제")) return;
        await api("feedback/" + f.id, { method: "DELETE" }); await reload("fb"); closeModal(); render();
      };
    });
  }));
}

// ---------- pages ----------
const PAGES = {};

PAGES.dashboard = async (v) => {
  const C = S.content, P = C.project;
  const fuC = count(S.fu, "status"), gapC = count(S.req, "gap"), decC = count(S.req, "decision"), fbC = count(S.fb, "status");
  const fuOpen = S.fu.filter((f) => f.status !== "완료");
  const nextFu = fuOpen.filter((f) => f.priority === "상").concat(fuOpen.filter((f) => f.priority !== "상")).slice(0, 6);
  const seg = (obj, keys, cls) => keys.map((k, i) => `<i style="width:${((obj[k] || 0) / Math.max(1, Object.values(obj).reduce((a, b) => a + b, 0))) * 100}%;background:var(--${cls[i]})"></i>`).join("");
  let recent = [];
  if (S.apiOk) try { recent = (await api("summary")).recent; } catch {}
  v.innerHTML = `
  <div class="card"><div class="row"><div>
    <div class="muted" style="font-size:12.5px">기준일 ${esc(P.baseDate)} · 현 단계</div>
    <div style="font-size:20px;font-weight:700;margin:2px 0">${esc(P.phase)} <span class="tag t-pri">${esc(P.phaseNote)}</span></div>
    <div class="tx2">${esc(P.goal)} · 대상 ${esc(P.targets)}</div>
    <div class="muted mt8">방향: ${esc(P.direction)}</div></div></div></div>
  <div class="grid g4 mt">
    <div class="card kpi"><div class="lbl">F/U 미완료</div><div class="num">${fuOpen.length}<span class="muted" style="font-size:15px"> / ${S.fu.length}</span></div>
      <div class="hint">진행중 ${fuC["진행중"] || 0} · 보류 ${fuC["보류"] || 0}</div><div class="bar">${seg(fuC, ["완료", "진행중", "보류"], ["ok", "info", "warn"])}</div></div>
    <div class="card kpi"><div class="lbl">요구사항</div><div class="num">${S.req.length}</div>
      <div class="hint">결정 ${decC["결정"] || 0} · 요구 ${decC["요구"] || 0} · 미결 ${decC["미결"] || 0}</div></div>
    <div class="card kpi"><div class="lbl">세일즈올 현행 대비 갭</div><div class="num">${(gapC["미충족"] || 0) + (gapC["부분"] || 0)}<span class="muted" style="font-size:15px"> 건</span></div>
      <div class="hint">미충족 ${gapC["미충족"] || 0} · 부분 ${gapC["부분"] || 0} · 확인필요 ${gapC["확인필요"] || 0}</div>
      <div class="bar">${seg(gapC, ["충족", "부분", "미충족", "확인필요"], ["ok", "warn", "bad", "info"])}</div></div>
    <div class="card kpi"><div class="lbl">피드백 미처리</div><div class="num">${(fbC["접수"] || 0) + (fbC["검토중"] || 0)}</div>
      <div class="hint">전체 ${S.fb.length} · 완료 ${fbC["완료"] || 0}</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h2>일정 <span class="sub">U+ 로드맵 포함</span></h2><ul class="tl">
      ${C.schedule.map((s) => `<li><span class="dot ${s.state}"></span><span class="d">${esc(s.date)}</span><div>${esc(s.title)} ${s.kind === "U+ 로드맵" ? '<span class="tag t-info">U+</span>' : ""}${s.note ? `<span class="cue muted">※ ${esc(s.note)}</span>` : ""}</div></li>`).join("")}
    </ul></div>
    <div class="card"><h2>우선 F/U <span class="sub">미완료 · 우선순위순</span><span class="sp"></span><a href="#/fu" class="btn sm">전체</a></h2>
      ${nextFu.length ? `<ul class="tl">${nextFu.map((f) => `<li><span class="d id">${esc(f.id)}</span><div>${esc(f.title)}<span class="cue">${esc(f.owner)} · ${esc(f.due)}</span></div><div>${tag(f.status)}</div></li>`).join("")}</ul>` : `<div class="empty">${S.apiOk ? "미완료 F/U 없음" : "D1 연결 필요"}</div>`}
      <h2 class="mt">리스크·확인 필요</h2><ul class="plain">${C.risks.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    </div>
  </div>
  <div class="card mt"><h2>최근 변경 <span class="sp"></span><a href="#/log" class="btn sm">전체</a></h2>
    ${recent.length ? logTable(recent) : `<div class="empty">변경 이력 없음</div>`}</div>`;
};

PAGES.fu = (v) => {
  const f = PAGES.fu.f || (PAGES.fu.f = { status: "", q: "" });
  const rows = S.fu.filter((r) => (!f.status || (f.status === "_open" ? r.status !== "완료" : r.status === f.status)) && (!f.q || JSON.stringify(r).includes(f.q)));
  $("#topActions").innerHTML = S.apiOk ? `<button class="btn pri" id="addFu">+ F/U 등록</button>` : "";
  v.innerHTML = `
  <div class="filters">
    <select id="fSt"><option value="">상태 전체</option><option value="_open" ${f.status === "_open" ? "selected" : ""}>미완료</option>${opts(ENUM.fuStatus, f.status)}</select>
    <input type="search" id="fQ" placeholder="검색" value="${esc(f.q)}">
    <span class="sp"></span><span class="muted">${rows.length}건</span>
  </div>
  <div class="tbl-wrap"><table><thead><tr><th>ID</th><th>할 일</th><th>담당</th><th>기한</th><th>우선</th><th>상태</th><th>피드백</th></tr></thead><tbody>
  ${rows.map((r) => { const n = S.fb.filter((x) => x.target_type === "fu" && x.target_id === r.id).length; return `
    <tr class="click" data-id="${esc(r.id)}"><td class="id">${esc(r.id)}</td>
    <td>${esc(r.title)}${r.note ? `<span class="cue">※ ${esc(r.note)}</span>` : ""}${r.source ? `<span class="cue">근거: ${esc(r.source)}</span>` : ""}</td>
    <td>${esc(r.owner)}</td><td style="white-space:nowrap">${esc(r.due)}</td><td>${tag(r.priority)}</td>
    <td>${S.apiOk ? `<select class="inline-st" data-id="${esc(r.id)}" style="width:auto">${opts(ENUM.fuStatus, r.status)}</select>` : tag(r.status)}</td>
    <td>${n ? `<span class="tag">${n}</span>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">${S.apiOk ? "해당 F/U 없음" : "D1 연결 필요"}</td></tr>`}
  </tbody></table></div>
  <p class="muted mt8">행 클릭: 상세·수정 · 상태는 목록에서 바로 변경</p>`;
  $("#fSt").onchange = (e) => { f.status = e.target.value; render(); };
  $("#fQ").oninput = (e) => { f.q = e.target.value; clearTimeout(PAGES.fu.t); PAGES.fu.t = setTimeout(() => { render(); const q = $("#fQ"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
  const add = $("#addFu"); if (add) add.onclick = () => editModal("fu");
  v.querySelectorAll(".inline-st").forEach((s) => { s.onclick = (e) => e.stopPropagation(); s.onchange = async (e) => {
    try { await api("fu/" + encodeURIComponent(s.dataset.id), { method: "PATCH", body: { status: e.target.value } }); await reload("fu"); toast(`${s.dataset.id} → ${e.target.value}`); render(); } catch (er) { toast("변경 실패: " + er.message); }
  }; });
  v.querySelectorAll("tr.click").forEach((tr) => (tr.onclick = () => (location.hash = "#/fu/" + tr.dataset.id)));
};

PAGES.fuDetail = (v, id) => detailPage(v, "fu", S.fu.find((r) => r.id === id), id);

PAGES.req = (v) => {
  const f = PAGES.req.f || (PAGES.req.f = { area: "", gap: "", decision: "", source: "", q: "" });
  const areas = [...new Set(S.req.map((r) => r.area))];
  const sources = [...new Set(S.req.map((r) => r.source))];
  const rows = S.req.filter((r) => (!f.area || r.area === f.area) && (!f.gap || r.gap === f.gap) && (!f.decision || r.decision === f.decision) && (!f.source || r.source === f.source) && (!f.q || JSON.stringify(r).includes(f.q)));
  $("#topActions").innerHTML = S.apiOk ? `<button class="btn" id="csv">CSV</button><button class="btn pri" id="addReq">+ 요구사항</button>` : "";
  v.innerHTML = `
  <div class="filters">
    <select data-k="area">${opts(areas, f.area, "영역 전체")}</select>
    <select data-k="gap">${opts(ENUM.gap, f.gap, "갭 전체")}</select>
    <select data-k="decision">${opts(ENUM.decision, f.decision, "판단 전체")}</select>
    <select data-k="source">${opts(sources, f.source, "출처 전체")}</select>
    <input type="search" id="rQ" placeholder="검색" value="${esc(f.q)}">
    <span class="sp"></span><span class="muted">${rows.length}건</span>
  </div>
  <div class="tbl-wrap"><table><thead><tr><th>ID</th><th>영역</th><th>요구사항</th><th>세일즈올 현행</th><th>갭</th><th>판단</th><th>우선</th><th>진행</th></tr></thead><tbody>
  ${rows.map((r) => `<tr class="click" data-id="${esc(r.id)}"><td class="id">${esc(r.id)}</td><td style="white-space:nowrap">${esc(r.area)}</td>
    <td><b style="font-weight:600">${esc(r.title)}</b><span class="cue">${esc(r.source)}</span></td>
    <td class="tx2" style="font-size:13px;min-width:240px"><span class="pre">${esc(r.current_state)}</span> ${slideLinks(r.guide_ref)}</td>
    <td>${tag(r.gap)}</td><td>${tag(r.decision)}</td><td>${tag(r.priority)}</td><td>${tag(r.status)}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">${S.apiOk ? "해당 요구사항 없음" : "D1 연결 필요"}</td></tr>`}
  </tbody></table></div>
  <p class="muted mt8">갭: 세일즈올 가이드(2026.02) 기준 현행 기능 대비 판단 · '가이드 분석(제안)'은 회의 외 추가 검토 항목</p>`;
  v.querySelectorAll(".filters select[data-k]").forEach((s) => (s.onchange = () => { f[s.dataset.k] = s.value; render(); }));
  $("#rQ").oninput = (e) => { f.q = e.target.value; clearTimeout(PAGES.req.t); PAGES.req.t = setTimeout(() => { render(); const q = $("#rQ"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
  const add = $("#addReq"); if (add) add.onclick = () => editModal("req");
  const csv = $("#csv"); if (csv) csv.onclick = () => downloadCsv(rows);
  v.querySelectorAll("tr.click").forEach((tr) => (tr.onclick = (e) => { if (e.target.closest("a")) return; location.hash = "#/req/" + tr.dataset.id; }));
};

function downloadCsv(rows) {
  const cols = ["id", "area", "title", "detail", "source", "current_state", "guide_ref", "gap", "decision", "priority", "status", "note", "updated_at", "updated_by"];
  const head = ["ID", "영역", "요구사항", "배경·근거", "출처", "세일즈올 현행", "가이드", "갭", "판단", "우선", "진행", "비고", "수정일(UTC)", "수정자"];
  const line = (a) => a.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",");
  const csv = "﻿" + [line(head), ...rows.map((r) => line(cols.map((c) => r[c])))].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `요구사항_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

PAGES.reqDetail = (v, id) => detailPage(v, "req", S.req.find((r) => r.id === id), id);

function detailPage(v, kind, r, id) {
  const isFu = kind === "fu";
  if (!r) { v.innerHTML = `<div class="empty">${esc(id)} 없음 <a href="#/${isFu ? "fu" : "req"}">목록</a></div>`; return; }
  $("#pageTitle").textContent = `${r.id} · ${isFu ? "F/U" : "요구사항"}`;
  $("#topActions").innerHTML = `<a class="btn" href="#/${isFu ? "fu" : "req"}">목록</a>${S.apiOk ? `<button class="btn pri" id="edit">수정</button>` : ""}`;
  const fv = (k, val, html) => (val || html ? `<div class="fieldv"><div class="k">${k}</div><div class="pre">${html || esc(val)}</div></div>` : "");
  const tt = isFu ? "fu" : "requirement";
  const list = S.fb.filter((x) => x.target_type === tt && x.target_id === r.id);
  const slides = String(r.guide_ref || "").split(",").map((s) => s.trim()).filter(Boolean);
  v.innerHTML = `<div class="detail-grid">
    <div><div class="card">
      <h2 style="font-size:17px">${esc(r.title)}</h2>
      <div class="row" style="margin-bottom:14px">${isFu ? tag(r.status) + tag(r.priority) : tag(r.gap) + tag(r.decision) + tag(r.priority) + tag(r.status)}</div>
      ${isFu ? fv("담당", r.owner) + fv("기한", r.due) + fv("근거", r.source) + fv("비고", r.note)
        : fv("영역", r.area) + fv("출처", r.source) + fv("배경·근거", r.detail) + fv("세일즈올 현행 (가이드 기준)", r.current_state) + fv("가이드 슬라이드", "", slideLinks(r.guide_ref)) + fv("비고", r.note)}
      <div class="muted" style="font-size:12px">최종 수정 ${esc(toKST(r.updated_at))} · ${esc(r.updated_by)}</div>
    </div>
    ${slides.length ? `<div class="card mt"><h2>가이드 화면</h2><div class="thumbs">${slides.map((n) => { const s = S.content.guide.slides[n - 1]; return s ? `<a class="thumb" href="#/guide/${n}"><img loading="lazy" src="${s.img}" alt=""><span>p.${n} ${esc(s.title)}</span></a>` : ""; }).join("")}</div></div>` : ""}
    </div>
    <div><div class="card"><h2>피드백 <span class="sub">${list.length}건</span></h2>${threadHtml(list)}</div>${fbFormHtml({ target_type: tt, target_id: r.id })}</div>
  </div>`;
  const e = $("#edit"); if (e) e.onclick = () => editModal(kind, r);
  bindFb(v, { target_type: tt, target_id: r.id });
}

PAGES.feedback = (v) => {
  const f = PAGES.feedback.f || (PAGES.feedback.f = { status: "", cat: "", tt: "" });
  const rows = S.fb.filter((x) => (!f.status || (f.status === "_open" ? x.status !== "완료" : x.status === f.status)) && (!f.cat || x.category === f.cat) && (!f.tt || x.target_type === f.tt));
  v.innerHTML = `<div class="detail-grid"><div>
    <div class="filters">
      <select id="ffSt"><option value="">상태 전체</option><option value="_open" ${f.status === "_open" ? "selected" : ""}>미처리</option>${opts(ENUM.fbStatus, f.status)}</select>
      <select id="ffCat">${opts(ENUM.fbCat, f.cat, "구분 전체")}</select>
      <select id="ffTT"><option value="">대상 전체</option>${Object.entries(TARGET_LABEL).map(([k, l]) => `<option value="${k}" ${f.tt === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <span class="sp"></span><span class="muted">${rows.length}건</span></div>
    ${threadHtml(rows, { showTarget: true })}</div>
    <div>${fbFormHtml(null)}<p class="muted mt8">요구사항·F/U별 피드백은 각 상세 화면에서도 등록 가능</p></div></div>`;
  $("#ffSt").onchange = (e) => { f.status = e.target.value; render(); };
  $("#ffCat").onchange = (e) => { f.cat = e.target.value; render(); };
  $("#ffTT").onchange = (e) => { f.tt = e.target.value; render(); };
  bindFb(v, null);
};

PAGES.meeting = (v) => {
  const m = S.content.meetings[0];
  const list = S.fb.filter((x) => x.target_type === "meeting" && x.target_id === m.id);
  v.innerHTML = `
  <div class="card"><h2 style="font-size:17px">${esc(m.date)} · ${esc(m.title)}</h2>
    <p class="muted" style="margin-top:-6px">출처: 회의 녹음 음성인식·화자구분 결과 기반. 화자 매핑·담당자는 추정</p>
    <div class="tbl-wrap"><table><tbody>${m.overview.map(([k, val, n]) => `<tr><th style="width:110px">${esc(k)}</th><td>${esc(val)}${n ? `<span class="cue">※ ${esc(n)}</span>` : ""}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="sec-title">핵심 요약</div><div class="card"><ul class="plain">${m.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
  <div class="sec-title">안건별 논의</div>
  <div class="tbl-wrap"><table><thead><tr><th>안건</th><th>시각</th><th>현황·문제</th><th>요구사항·의견</th></tr></thead><tbody>
  ${m.agenda.map(([a, t, s, r]) => `<tr><td style="white-space:nowrap;font-weight:600">${esc(a)}</td><td class="muted">${esc(t)}</td><td class="tx2">${esc(s)}</td><td>${esc(r)}</td></tr>`).join("")}</tbody></table></div>
  <div class="grid g2 mt">
    <div class="card"><h2>결정 사항 <span class="sub">진행 방식 합의 중심</span></h2><ol class="plain">${m.decisions.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
    <div class="card"><h2>미결·확인 필요</h2><ul class="plain">${m.open.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
  </div>
  <div class="sec-title">액션 아이템 → <a href="#/fu">F/U 트래커</a>에서 관리</div>
  <div class="sec-title">화자 분석</div>
  <div class="tbl-wrap"><table><thead><tr><th>화자</th><th>발언 시간</th><th>추정 인물·역할</th><th>주요 입장</th></tr></thead><tbody>
  ${m.speakers.map(([a, b, c, d]) => `<tr><td class="id">${esc(a)}</td><td style="white-space:nowrap">${esc(b)}</td><td>${esc(c)}</td><td class="tx2">${esc(d)}</td></tr>`).join("")}</tbody></table></div>
  <div class="card mt"><h2>분석 방법·한계</h2><ul class="plain tx2">${m.method.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
  <div class="grid g2 mt"><div class="card"><h2>회의록 피드백 <span class="sub">${list.length}건</span></h2>${threadHtml(list)}</div>
  <div>${fbFormHtml({ target_type: "meeting", target_id: m.id })}</div></div>`;
  bindFb(v, { target_type: "meeting", target_id: m.id });
};

PAGES.guide = (v) => {
  const G = S.content.guide;
  const reqBySlide = {};
  S.req.forEach((r) => String(r.guide_ref || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((n) => (reqBySlide[n] = (reqBySlide[n] || []).concat(r.id))));
  v.innerHTML = `
  <div class="card"><h2 style="font-size:17px">${esc(G.title)} <span class="sub">${esc(G.file)} · ${G.pages}p</span></h2>
    <div class="tbl-wrap"><table><tbody>${G.overview.map(([k, a, b]) => `<tr><th style="width:110px">${esc(k)}</th><td>${esc(a)}${b ? `<span class="cue">※ ${esc(b)}</span>` : ""}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="sec-title">신청서 작성 단계 (Mobile 신규가입)</div>
  <div class="steps">${G.steps.map((s, i) => `<div class="step"><h3>${i + 1}. ${esc(s.name)}</h3><div style="margin:-4px 0 8px">${s.slides.map((n) => `<a class="chip-link" href="#/guide/${n}">p.${n}</a>`).join("")}</div><ul>${s.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("")}</div>
  <div class="sec-title">MVNO 적용 시사점 <span class="muted" style="font-size:13px;font-weight:400">가이드 분석(제안)</span></div>
  <div class="tbl-wrap"><table><thead><tr><th>영역</th><th>현행 → 시사점</th><th>관련 요구사항</th></tr></thead><tbody>
  ${G.implications.map(([a, b, c]) => `<tr><td style="white-space:nowrap;font-weight:600">${esc(a)}</td><td>${esc(b)}</td><td>${c.split(",").map((x) => `<a class="chip-link" href="#/req/${x.trim()}">${x.trim()}</a>`).join("")}</td></tr>`).join("")}</tbody></table></div>
  <div class="grid g2 mt">
    <div class="card"><h2>편리 기능</h2><div class="tbl-wrap"><table><tbody>${G.features.map(([a, b, n]) => `<tr><td style="white-space:nowrap;font-weight:600">${esc(a)}</td><td>${esc(b)}</td><td><a class="chip-link" href="#/guide/${n}">p.${n}</a></td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><h2>FAQ</h2><div class="tbl-wrap"><table><tbody>${G.faq.map(([q, a, b, n]) => `<tr><td class="id">${q}</td><td><b style="font-weight:600">${esc(a)}</b><span class="cue">${esc(b)}</span></td><td><a class="chip-link" href="#/guide/${n}">p.${n}</a></td></tr>`).join("")}</tbody></table></div></div>
  </div>
  <div class="sec-title">슬라이드 전체 (${G.slides.length})</div>
  <div class="thumbs">${G.slides.map((s) => `<a class="thumb" href="#/guide/${s.n}"><img loading="lazy" src="${s.img}" alt="p.${s.n}"><span>p.${s.n} ${esc(s.title)}${reqBySlide[s.n] ? " · " + reqBySlide[s.n].join(",") : ""}</span></a>`).join("")}</div>`;
};

PAGES.guideSlide = (v, n) => {
  const G = S.content.guide; n = Number(n);
  const s = G.slides[n - 1];
  if (!s) { v.innerHTML = `<div class="empty">슬라이드 없음</div>`; return; }
  $("#pageTitle").textContent = `세일즈올 가이드 p.${n}`;
  $("#topActions").innerHTML = `<a class="btn" href="#/guide">목록</a>${n > 1 ? `<a class="btn" href="#/guide/${n - 1}">◀ 이전</a>` : ""}${n < G.slides.length ? `<a class="btn" href="#/guide/${n + 1}">다음 ▶</a>` : ""}`;
  const rel = S.req.filter((r) => String(r.guide_ref || "").split(",").map((x) => x.trim()).includes(String(n)));
  const list = S.fb.filter((x) => x.target_type === "guide" && x.target_id === "p." + n);
  v.innerHTML = `<div class="detail-grid"><div class="slide-view"><img src="${s.img}" alt="p.${n}">
    ${s.text ? `<div class="card mt"><h2>슬라이드 텍스트</h2><div class="tx2" style="font-size:13px">${esc(s.text)}</div></div>` : ""}</div>
    <div><div class="card"><h2>${esc(s.title)}</h2>
      <div class="k muted" style="font-size:12px;font-weight:600">관련 요구사항</div>
      ${rel.length ? `<ul class="tl">${rel.map((r) => `<li><a class="d id" href="#/req/${r.id}">${r.id}</a><div>${esc(r.title)}</div><div>${tag(r.gap)}</div></li>`).join("")}</ul>` : `<div class="muted">없음</div>`}</div>
    <div class="card mt"><h2>피드백 <span class="sub">${list.length}건</span></h2>${threadHtml(list)}</div>
    ${fbFormHtml({ target_type: "guide", target_id: "p." + n })}</div></div>`;
  bindFb(v, { target_type: "guide", target_id: "p." + n });
};

PAGES.glossary = (v) => {
  v.innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>용어</th><th>의미</th><th>비고</th></tr></thead><tbody>
  ${S.content.glossary.map(([a, b, c]) => `<tr><td style="font-weight:600;white-space:nowrap">${esc(a)}</td><td>${esc(b)}</td><td class="tx2">${esc(c)}</td></tr>`).join("")}</tbody></table></div>
  <p class="muted mt8">녹취록 음성인식 표기 → 실제 의미 보정 포함. 용어 추가·수정 요청은 피드백(대상: 일반)으로 등록</p>`;
};

PAGES.docs = (v) => {
  v.innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>자료</th><th>설명</th><th>위치</th><th>비고</th></tr></thead><tbody>
  ${S.content.docs.map(([a, b, c, d]) => `<tr><td style="font-weight:600">${esc(a)}</td><td>${esc(b)}</td><td class="tx2">${c === "미보유" ? tag("미보유") : esc(c)}</td><td class="tx2">${esc(d)}</td></tr>`).join("")}</tbody></table></div>
  <p class="muted mt8">정적 콘텐츠 수정: public/data/content.json 편집 후 GitHub 커밋 → Cloudflare Pages 자동 배포</p>`;
};

function logTable(rows) {
  const ent = { fu: "F/U", requirement: "요구사항", feedback: "피드백" };
  const act = { create: "등록", update: "수정", delete: "삭제" };
  const link = (r) => r.entity === "fu" ? `#/fu/${r.entity_id}` : r.entity === "requirement" ? `#/req/${r.entity_id}` : "#/feedback";
  const FL = { title: "제목", status: "상태", priority: "우선", owner: "담당", due: "기한", note: "비고", source: "출처", area: "영역", detail: "배경", current_state: "현행", guide_ref: "가이드", gap: "갭", decision: "판단", reply: "답변", category: "구분", target: "대상", body: "내용", sort: "순서" };
  const diffTxt = (d) => { try { const o = JSON.parse(d || "{}"); return Object.entries(o).map(([k, [a, b]]) => `${FL[k] || k}: ${a == null ? "" : String(a).slice(0, 30)} → ${b == null ? "" : String(b).slice(0, 40)}`).join(" / "); } catch { return ""; } };
  return `<div class="tbl-wrap"><table><thead><tr><th>시각(KST)</th><th>대상</th><th>구분</th><th>변경</th><th>작업자</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td style="white-space:nowrap" class="tx2">${esc(toKST(r.at))}</td><td style="white-space:nowrap"><a href="${link(r)}">${ent[r.entity] || r.entity} ${esc(r.entity === "feedback" ? "#" + r.entity_id : r.entity_id)}</a></td>
  <td>${tag(act[r.action] || r.action)}</td><td class="tx2" style="font-size:12.5px">${esc(diffTxt(r.diff))}</td><td class="tx2">${esc(r.actor)}</td></tr>`).join("")}</tbody></table></div>`;
}
PAGES.log = async (v) => {
  if (!S.apiOk) { v.innerHTML = `<div class="empty">D1 연결 필요</div>`; return; }
  const rows = await api("changelog?limit=300");
  v.innerHTML = rows.length ? logTable(rows) : `<div class="empty">변경 이력 없음</div>`;
};

// ---------- router ----------
const TITLES = { dashboard: "대시보드", fu: "F/U 트래커", req: "요구사항", feedback: "피드백", meeting: "회의록", guide: "세일즈올 가이드", glossary: "용어집", docs: "자료 목록", log: "변경 이력" };
async function render() {
  const [r = "dashboard", id] = location.hash.replace(/^#\/?/, "").split("/");
  const route = TITLES[r] ? r : "dashboard";
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === route));
  $("#pageTitle").textContent = TITLES[route];
  $("#topActions").innerHTML = "";
  $("#side").classList.remove("open");
  const v = $("#view");
  try {
    if (id && route === "fu") await PAGES.fuDetail(v, decodeURIComponent(id));
    else if (id && route === "req") await PAGES.reqDetail(v, decodeURIComponent(id));
    else if (id && route === "guide") await PAGES.guideSlide(v, id);
    else await PAGES[route](v);
  } catch (e) { v.innerHTML = `<div class="empty">오류: ${esc(e.message)}</div>`; console.error(e); }
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
$("#menuBtn").onclick = () => $("#side").classList.toggle("open");

loadAll().then(render);
})();
