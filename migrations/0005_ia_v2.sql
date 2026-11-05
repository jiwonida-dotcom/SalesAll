-- IA v2: U+ 질의 대장, 결정 로그, 이슈·리스크, 검증 체크리스트, 요구사항 사업자·범위
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

INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q01', '요구사항 문서 양식·테스트 계정 발급 요청', '참석자별 테스트 계정 필요', '', 'F1', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 10, 'seed');
INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q02', '외국인(여권) 개통 가능 여부, 외부 접속 테스트 가능 여부', '', 'R17', 'F4', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 20, 'seed');
INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q03', '선불 전용 화면 필요 여부', '충전은 플랫폼 외부 처리', 'R17', '', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 30, 'seed');
INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q04', '마케팅 동의 항목값 연동 방식·사업자 개발 범위', '동의 1·2·3번 항목값 API 수신', 'R05', '', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 40, 'seed');
INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q05', '청구정보 인증의 계좌 명의자 검증 범위', '오류코드 B102·0051·0122·D101 기준', 'R08', '', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 50, 'seed');
INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q06', '개통 단계 고객 입력값 수정 가능 여부', '', 'R15', '', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 60, 'seed');
INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q07', 'MVNO 개통 주체·신청서 전송 대상', '가이드: U+ 개통실 전송 / 회의: 판매점 → 대리점 확인 → 개통', 'R24', 'F10', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 70, 'seed');
INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q08', '판매마당 신분증 스캔 의존 구조의 MVNO 판매점 적용', '', 'R23', 'F10', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 80, 'seed');
INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q09', '가입 사전조회(실명·가입 가능여부) 사업자별 연동', '', 'R25', 'F10', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 90, 'seed');
INSERT OR IGNORE INTO inquiries (id, title, detail, reqs, fu_ref, to_party, status, owner, asked_at, answered_at, answer, sort, updated_by) VALUES ('Q10', '카드번호 별지 서식 전달과 개인정보 미저장 정합성', '', 'R27,R06', 'F10', 'U+ 시스템 구축 담당', '작성', '허지원 책임', '', '', '', 100, 'seed');

INSERT OR IGNORE INTO decisions (id, title, rationale, decided_at, source, status, reqs, sort, updated_by) VALUES ('D01', 'U+ 테스트 계정 직접 사용 후 요구사항 확정', '화면 자료만으로 판단 불가', '2026-11-05', 'M20261105', '확정', '', 10, 'seed');
INSERT OR IGNORE INTO decisions (id, title, rationale, decided_at, source, status, reqs, sort, updated_by) VALUES ('D02', '요구사항은 문서(글 또는 PPT 화면 캡처)로 취합·전달', '', '2026-11-05', 'M20261105', '확정', '', 20, 'seed');
INSERT OR IGNORE INTO decisions (id, title, rationale, decided_at, source, status, reqs, sort, updated_by) VALUES ('D03', '현 단계 공수 미고려, 요구사항 전량 취합 → 범위 조정은 취합 후', '', '2026-11-05', 'M20261105', '확정', '', 30, 'seed');
INSERT OR IGNORE INTO decisions (id, title, rationale, decided_at, source, status, reqs, sort, updated_by) VALUES ('D04', '계정 운영은 판매마당과 동일, 잠금 해제 사업자 직접 처리는 요구', '', '2026-11-05', 'M20261105', '확정', 'R14', 40, 'seed');
INSERT OR IGNORE INTO decisions (id, title, rationale, decided_at, source, status, reqs, sort, updated_by) VALUES ('D05', '판매점 입력 정보 플랫폼 미저장, U+ 시스템 직접 전달', '개인정보', '2026-11-05', 'M20261105', '확정', 'R06', 50, 'seed');
INSERT OR IGNORE INTO decisions (id, title, rationale, decided_at, source, status, reqs, sort, updated_by) VALUES ('D06', '단말 재고 기능 미요구, 사업자 지정 노출 단말 기능만 요구', '헬로는 U+ 시스템 재고 미관리', '2026-11-05', 'M20261105', '확정', 'R11', 60, 'seed');

INSERT OR IGNORE INTO issues (id, title, type, impact, status, owner, action, reqs, sort, updated_by) VALUES ('I01', '출시 일정 불일치', '리스크', '상', '열림', '허지원 책임', '녹음 25:44 ''11월까지 출시'' 언급 vs 2027-1Q 개발 목표 → 일정 확인', '', 10, 'seed');
INSERT OR IGNORE INTO issues (id, title, type, impact, status, owner, action, reqs, sort, updated_by) VALUES ('I02', '요구사항 과다 시 2027-1Q 개발 곤란, 범위 축소 요청 가능', '리스크', '상', '열림', '허지원 책임', '요구사항 범위(필수/선택) 분류', '', 20, 'seed');
INSERT OR IGNORE INTO issues (id, title, type, impact, status, owner, action, reqs, sort, updated_by) VALUES ('I03', '마케팅 동의 연동 사업자 측 개발 공수', '리스크', '중', '열림', '', '연동 방식 U+ 확인(Q04)', 'R05', 30, 'seed');
INSERT OR IGNORE INTO issues (id, title, type, impact, status, owner, action, reqs, sort, updated_by) VALUES ('I04', '요금제·약관 사업자 직접 운영 시 운영 공수 부담', '리스크', '중', '열림', '', '운영 주체 결정', 'R03,R04', 40, 'seed');
INSERT OR IGNORE INTO issues (id, title, type, impact, status, owner, action, reqs, sort, updated_by) VALUES ('I05', '회의 녹취록 원문 미보유', '이슈', '하', '열림', '허지원 책임', '02·03 txt 확보(F11)', '', 50, 'seed');

INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C01', '화면 흐름', '가입 시작 화면 구성, 사업자·유심/단말 선택 위치', 'R01', '미확인', '', '', '', 10, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C02', '요금제', '요금제 목록 건수·검색·정렬, 요금제명 표시 길이', 'R04', '미확인', '', '', '', 20, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C03', '약관·동의', '약관 동의 항목 구성, 마케팅·결합할인 동의 항목 존재', 'R03,R05', '미확인', '', '', '', 30, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C04', '납부·청구', '지로 선택지 노출, 청구서 기본값, 이메일+App 선택', 'R09,R10', '미확인', '', '', '', 40, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C05', '계좌 인증', '예금주 불일치 계좌 입력 시 결과', 'R08', '미확인', '', '', '', 50, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C06', '메모', '메모란 계좌번호·연락처 입력 시 처리', 'R07', '미확인', '', '', '', 60, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C07', '단말', '판매/비판매 선택, 일련번호 직접 입력, 재고 조회 결과', 'R11', '미확인', '', '', '', 70, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C08', '지원금', '공시지원금·그 외 지원금 입력·자동 반영', 'R16', '미확인', '', '', '', 80, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C09', '임시저장', '이어하기 조회, 보관 기간', 'R12', '미확인', '', '', '', 90, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C10', '미성년자', '법정대리인 서류 미첨부 상태 전송 가능 여부', 'R13', '미확인', '', '', '', 100, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C11', '외국인', '외국인 유형 선택 시 인증 수단(여권)', 'R17', '미확인', '', '', '', 110, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C12', '개통 처리', '전송 후 수신 주체, 수신 측 입력값 수정 가능 여부', 'R15,R24', '미확인', '', '', '', 120, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C13', '사전조회', '실명확인·가입 가능여부 조회 대상 사업자', 'R25', '미확인', '', '', '', 130, 'seed');
INSERT OR IGNORE INTO checks (id, area, item, reqs, result, note, checked_by, checked_at, sort, updated_by) VALUES ('C14', '계정', '로그인 가능 시간, 비밀번호 오류 잠금·해제 경로', 'R14,R20', '미확인', '', '', '', 140, 'seed');
