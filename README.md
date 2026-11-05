# SalesAll MVNO — 프로젝트 통합관리

대리점/판매점 오프라인신청 시스템(U+ 세일즈올) MVNO 구축 프로젝트의 진행 현황·F/U·요구사항·피드백 통합관리 웹.

- 구성: Cloudflare Pages(정적) + Pages Functions(`/api/*`) + D1
- 빌드 단계 없음 (Vanilla JS)
- 접근 제어: Cloudflare Access (Zero Trust)

## 메뉴 (IA v2 · GATAG UI 스타일)

| 그룹 | 하위 메뉴 | 데이터 |
| --- | --- | --- |
| 홈 | 대시보드 (현 단계·할 일·U+ 질의·이슈 KPI, 갭 분포, 최근 결정) | D1 + 정적 |
| 실행 관리 | 할 일 · U+ 질의 · 결정 로그 · 이슈·리스크 | D1 `fu_items` `inquiries` `decisions` `issues` |
| 요구사항 | 목록 · 사업자별 매트릭스 · 갭 분석 · 검증 체크리스트 | D1 `requirements` `checks` + 정적 `cross` |
| 일정·회의 | 마일스톤 · 회의록(목록·상세, 결정·액션·요구사항 자동 연결) | 정적 `phases` `schedule` `meetings` |
| 레퍼런스 | 세일즈올 가이드 · 용어집 · 자료실 | 정적 |
| 관리 | 변경 이력 · 참여자·사업자 | D1 `change_log` + 정적 |

- 모든 상세 화면 하단 공통 코멘트 (D1 `feedback`)
- 목록 화면 상태값 바로 변경, 헤더 '등록' 버튼 → 인라인 등록 폼
- 라이트/다크 테마 전환
- 구 경로(`#/fu`, `#/req/R01`, `#/guide/9` 등) 자동 이동

## 디렉터리

```
public/            정적 사이트 (Pages 출력 디렉터리)
  index.html, app.js, style.css
  data/content.json   회의록·가이드 분석·용어집·일정 (정적 콘텐츠)
  guide/s-01~42.jpg   세일즈올 가이드 슬라이드 이미지
functions/api/[[path]].js   API (D1 바인딩 DB)
migrations/        D1 스키마(0001), 초기 데이터(0002), 보정(0003·0004), IA v2 확장(0005)
seed/seed.json     초기 데이터 원본 → scripts/build_seed.py 로 0002·0005 생성
wrangler.toml
```

## 배포 — push.cmd

| 명령 | 동작 |
| --- | --- |
| `.\push.cmd init` | 첫 배포. npm install → wrangler login → D1 `salesall-db` 생성 → `wrangler.toml` database_id 자동 반영 → 원격 마이그레이션 → 커밋·태그 v1.0.0 → GitHub 푸시 → 대시보드 설정 안내 출력 |
| `.\push.cmd` | patch 배포 (v1.0.0 → v1.0.1) |
| `.\push.cmd minor` / `major` | minor·major 배포 |
| `.\push.cmd "메시지"` | 커밋 제목 직접 지정 |
| `-y` | 확인 없이 진행 |

자동 처리
- 커밋 메시지: `[버전] 변경 영역 + 추가/수정/삭제` 제목, 본문에 배포 버전·이전 버전·일시·변경 영역·파일 목록
- 변경 영역 분류: 웹 화면, 정적 콘텐츠, 가이드 이미지, API, D1 마이그레이션, 초기 데이터, 배포 설정, 문서
- `docs/deploy-history.md` 배포 이력 행 추가, 버전 태그 생성
- 신규 `migrations/*.sql` 포함 시 푸시 전 원격 D1 적용 여부 확인 (스키마 선반영)
- `.dev.vars`, `node_modules/`, `.wrangler/`, 키·토큰 포함 파일 커밋 차단
- 로컬 기존 커밋만 있고 태그가 없는 경우: 기존 커밋 기준 v1.0.0 태그 후 푸시

### Cloudflare 대시보드 설정 (최초 1회, `init` 완료 후)

1. Workers & Pages → Create → Pages → Connect to Git → `jiwonida-dotcom/SalesAll`
   - Framework preset: None / Build command: 비움 / Build output directory: `public`
2. Settings → Bindings → D1 database: 변수명 `DB` → `salesall-db` (Production·Preview)
3. Zero Trust → Access → Applications → Self-hosted
   - Domain: `<프로젝트>.pages.dev` (Preview 포함 시 `*.<프로젝트>.pages.dev`)
   - Policy: Emails ending in `@medialog.co.kr` + 외부 참여자 개별 이메일
   - 적용 후 작성자·변경 이력에 로그인 이메일 자동 기록

이후 `main` 푸시 시 Pages 자동 재빌드.

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
| 신규 회의록 | `content.json` 의 `meetings` 배열에 추가 (`id`, `ref`: 요구사항·할 일 출처 표기와 동일하게) |
| 스키마 변경 | `migrations/0003_*.sql` 추가 → `npx wrangler d1 migrations apply salesall-db --remote` |
| D1 백업 | `npx wrangler d1 export salesall-db --remote --output backup.sql` |

## API

| Method | Path | 비고 |
| --- | --- | --- |
| GET | `/api/me` | 로그인 이메일 |
| GET | `/api/all` | 전체 운영 데이터 일괄 조회 (초기 로딩) |
| GET/POST | `/api/{fu\|requirements\|inquiries\|decisions\|issues\|checks}` | 목록 / 등록 (ID 자동: F#, R##, Q##, D##, I##, C##) |
| GET/PATCH/DELETE | `/api/{entity}/:id` | |
| GET/POST | `/api/comments?target_type=&target_id=` | 코멘트 (구 `/api/feedback` 호환) |
| PATCH/DELETE | `/api/comments/:id` | |
| GET | `/api/changelog?limit=` | 최대 500 |

## 데이터 기준

- 기준일 2026-11-05. 회의록은 녹음 음성인식 결과 기반
- 요구사항 R01~R17: 2026-11-05 회의 도출 / R18~R22: 세일즈올 가이드 분석(제안) / R23~R28: 크로스 분석(제안)
- 갭 판단: U+Sales All Guide 판매점편(2026.02) 기준
