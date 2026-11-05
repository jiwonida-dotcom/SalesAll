-- 크로스 분석(가이드 × 회의록) 반영: R23~R28 신규, R01·R11·R13·R14·F2·F10 보정

INSERT OR IGNORE INTO requirements (id, area, title, detail, source, current_state, guide_ref, gap, decision, priority, status, sort, updated_by) VALUES ('R23', '신분증 스캔', '판매마당 신분증 스캔 의존 구조의 MVNO 판매점 적용 확인', '', '크로스 분석(제안)', '판매마당 PC ''전자서식스캔''에서 신분증·구비서류 스캔 후 세일즈올 불러오기
※ 종이서류는 일반서식 스캔', '4,7,10,38', '확인필요', '미결', '상', '취합', 230, 'migration');
INSERT OR IGNORE INTO requirements (id, area, title, detail, source, current_state, guide_ref, gap, decision, priority, status, sort, updated_by) VALUES ('R24', '개통 처리', '사업자별 개통 주체·신청서 전송 대상 정의', '회의: 판매점 → 대리점 확인 → 개통', '크로스 분석(제안)', '작성 완료 신청서 U+ 개통실 전송, 개통실 개통 작업
※ ''개통실 문의'' 사유는 개통실 확인', '4,11,39', '확인필요', '미결', '상', '취합', 240, 'migration');
INSERT OR IGNORE INTO requirements (id, area, title, detail, source, current_state, guide_ref, gap, decision, priority, status, sort, updated_by) VALUES ('R25', '가입 사전조회', '사업자별 가입 가능 여부 사전조회 연동 필요 여부', '', '크로스 분석(제안)', '실명확인, U+ 가입 가능여부, 보증보험 할부 가능여부 사전조회', '11', '확인필요', '미결', '중', '취합', 250, 'migration');
INSERT OR IGNORE INTO requirements (id, area, title, detail, source, current_state, guide_ref, gap, decision, priority, status, sort, updated_by) VALUES ('R26', '가입유형', '가입유형(보상기변)·사전승낙제 코드 MVNO 적용 범위', '', '크로스 분석(제안)', '신규가입·번호이동·보상기변, 개통 신청 대리점·사전승낙제 코드 선택', '9', '확인필요', '미결', '중', '취합', 260, 'migration');
INSERT OR IGNORE INTO requirements (id, area, title, detail, source, current_state, guide_ref, gap, decision, priority, status, sort, updated_by) VALUES ('R27', '카드정보', '카드번호·유효기간 별지 서식 전달과 개인정보 미저장 결정 정합성', 'R06 결정: 판매점 입력 정보 플랫폼 미저장', '크로스 분석(제안)', '제휴·일반카드 번호·유효기간, 포인트파크 내부 별지 서식 기재', '14,23', '확인필요', '미결', '중', '취합', 270, 'migration');
INSERT OR IGNORE INTO requirements (id, area, title, detail, source, current_state, guide_ref, gap, decision, priority, status, sort, updated_by) VALUES ('R28', '메인 콘텐츠', '공지사항·스마트 가이드북 사업자별 노출', '', '크로스 분석(제안)', '메인 공지사항, 스마트 가이드북(U+ 월별 주요 상품정보), 매장 연락처', '6', '확인필요', '미결', '하', '취합', 280, 'migration');
UPDATE requirements SET note = '회의 ''단말 개통 화면 우선'' 발언과 가이드 순서(가입유형/고객정보 → 서비스정보) 상이 → 회의 검토 화면(MVNO 시안) 기준 여부 확인', updated_at = datetime('now'), updated_by = 'migration' WHERE id = 'R01';
UPDATE requirements SET current_state = '법정대리인 인증·안면인증(25.12.23 도입), 구비서류 첨부 일반/미성년자·명의자/대리인 구분
※ 네트워크 차단·자녀폰지킴이 필수, 결제 서비스 제한, 신분증 미첨부 시 개통실 전송 불가', note = '증빙 서류 첨부 경로 존재. 미첨부 시 진행 차단 여부 확인 필요', updated_at = datetime('now'), updated_by = 'migration' WHERE id = 'R13';
UPDATE requirements SET note = '계정 동일 운영 충족, 사업자 직접 잠금 해제 미충족. 가이드 경로: 비밀번호 초기화 도매대리점 담당자 경유, CM은 상위 대리점 연결', updated_at = datetime('now'), updated_by = 'migration' WHERE id = 'R14';
UPDATE requirements SET note = '재고 기준: 판매점별 아닌 POS코드 매핑. 비판매 경로 일련번호 직접 입력 가능', updated_at = datetime('now'), updated_by = 'migration' WHERE id = 'R11';
UPDATE fu_items SET title = '테스트 계정 화면 사용, 항목별 요구사항 글·화면 캡처 정리', note = '크로스 분석 ''테스트 계정 검증 체크리스트'' 14항목 기준 정리', updated_at = datetime('now'), updated_by = 'migration' WHERE id = 'F2';
UPDATE fu_items SET title = '가이드·크로스 분석 기반 MVNO 확인 항목(R18~R28) U+ 문의', note = '단말 사양, 결제수단, 운영시간, 부가서비스, 개통실 문의, 신분증 스캔, 개통 주체, 사전조회, 가입유형, 카드정보, 메인 콘텐츠', updated_at = datetime('now'), updated_by = 'migration' WHERE id = 'F10';
