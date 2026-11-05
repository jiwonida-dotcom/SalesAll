# SalesAll MVNO — 프로젝트 통합관리

대리점/판매점 오프라인신청 시스템(U+ 세일즈올) MVNO 구축 프로젝트의 진행 현황·F/U·요구사항·피드백 통합관리 웹.

- 구성: Cloudflare Pages(정적) + Pages Functions(`/api/*`) + D1
- 빌드 단계 없음 (Vanilla JS)
- 접근 제어: Cloudflare Access (Zero Trust)

## 메뉴

| 메뉴 | 데이터 | 기능 |
| --- | --- | --- |
| 대시보드 | D1 + 정적 | 단계·KPI·일정·우선 F/U·리스크·최근 변경 |
| F/U 트래커 | D1 `fu_items` | 등록·수정·삭제, 목록 내 상태 변경, 피드백 |
| 요구사항 | D1 `requirements` | 세일즈올 현행 대비 갭·판단·진행 관리, 가이드 슬라이드 연결, CSV 내보내기 |
| 피드백 | D1 `feedback` | 대상(일반·F/U·요구사항·회의록·가이드)별 의견·질문·이슈·결정요청, 처리 상태·답변 |
| 회의록 | 정적 `content.json` | 2026-11-05 회의록 |
| 세일즈올 가이드 | 정적 + `public/guide/*.jpg` | U+Sales All 판매점편 요약, MVNO 시사점, 슬라이드 42장 뷰어 |
| 용어집 · 자료 목록 | 정적 | 녹취 용어 보정, 자료 위치 |
| 변경 이력 | D1 `change_log` | 모든 등록·수정·삭제 기록(작업자 = Access 이메일) |

## 디렉터리

```
public/            정적 사이트 (Pages 출력 디렉터리)
  index.html, app.js, style.css
  data/content.json   회의록·가이드 분석·용어집·일정 (정적 콘텐츠)
  guide/s-01~42.jpg   세일즈올 가이드 슬라이드 이미지
functions/api/[[path]].js   API (D1 바인딩 DB)
migrations/        D1 스키마(0001), 초기 데이터(0002)
seed/seed.json     초기 F/U·요구사항 원본 → scripts/build_seed.py 로 0002 생성
wrangler.toml
```

## 배포 (최초 1회)

1. **GitHub 푸시**
   ```bash
   git remote add origin https://github.com/jiwonida-dotcom/SalesAll.git
   git push -u origin main
   ```
2. **D1 생성·마이그레이션** (로컬 PC, Node 18+)
   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create salesall-db        # 출력된 database_id → wrangler.toml 반영 후 커밋
   npx wrangler d1 migrations apply salesall-db --remote
   ```
3. **Cloudflare Pages 프로젝트 생성**
   - Workers & Pages → Create → Pages → Connect to Git → `jiwonida-dotcom/SalesAll`
   - Framework preset: None / Build command: 비움 / Build output directory: `public`
   - Settings → Bindings → D1 database: 변수명 `DB` → `salesall-db` (Production·Preview 모두)
   - ※ `wrangler.toml` 에 바인딩이 있으면 자동 인식, 대시보드 설정과 중복 시 wrangler.toml 우선
4. **Cloudflare Access 적용**
   - Zero Trust → Access → Applications → Add → Self-hosted
   - Domain: `<프로젝트>.pages.dev` (Preview 포함 시 `*.<프로젝트>.pages.dev` 추가)
   - Policy: Allow → Emails ending in `@medialog.co.kr` (외부 참여자는 개별 이메일 추가)
   - 적용 후 API 작성자·변경 이력에 로그인 이메일 자동 기록 (`Cf-Access-Authenticated-User-Email`)

이후 `main` 푸시 시 자동 배포.

## 로컬 실행

```bash
npm install
npx wrangler d1 migrations apply salesall-db --local
npx wrangler pages dev          # http://localhost:8788
```
※ 로컬은 Access 미적용 → 작성자 `anonymous` 기록

## 운영

| 작업 | 방법 |
| --- | --- |
| F/U·요구사항·피드백 | 웹에서 직접 수정 (D1 즉시 반영, 재배포 불필요) |
| 회의록·가이드·용어집·일정 추가 | `public/data/content.json` 편집 → 커밋·푸시 |
| 신규 회의록 | `content.json` 의 `meetings` 배열에 추가 (현재 화면은 첫 번째 회의 표시) |
| 스키마 변경 | `migrations/0003_*.sql` 추가 → `npx wrangler d1 migrations apply salesall-db --remote` |
| D1 백업 | `npx wrangler d1 export salesall-db --remote --output backup.sql` |

## API

| Method | Path | 비고 |
| --- | --- | --- |
| GET | `/api/me` | 로그인 이메일 |
| GET | `/api/summary` | 대시보드 집계 |
| GET/POST | `/api/fu` | 목록 / 등록(ID 자동 F#) |
| GET/PATCH/DELETE | `/api/fu/:id` | |
| GET/POST | `/api/requirements` | 등록 시 ID 자동 R## |
| GET/PATCH/DELETE | `/api/requirements/:id` | |
| GET/POST | `/api/feedback?target_type=&target_id=` | |
| PATCH/DELETE | `/api/feedback/:id` | 상태·답변 |
| GET | `/api/changelog?limit=` | 최대 500 |

## 데이터 기준

- 기준일 2026-11-05. 회의록은 녹음 음성인식·화자구분 결과 기반, 화자 매핑·담당자는 추정
- 요구사항 R01~R17: 2026-11-05 회의 도출 / R18~R22: 세일즈올 가이드 분석 기반 추가 검토 항목(제안)
- 갭 판단: U+Sales All Guide 판매점편(2026.02) 기준
