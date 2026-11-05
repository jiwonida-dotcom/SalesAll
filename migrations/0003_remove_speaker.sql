-- 화자 표기 제거·F7 조정 (이미 0002 적용된 DB 보정용)
UPDATE fu_items SET owner = '허지원 책임', updated_at = datetime('now'), updated_by = 'migration'
  WHERE owner = '화자A (허지원 책임 추정)';
UPDATE fu_items SET owner = '미정', updated_at = datetime('now'), updated_by = 'migration'
  WHERE owner = '화자B (추정)';

-- 회의록 화자 분석 제거에 따른 F7 조정
UPDATE fu_items SET title = '회의록 참석자·발언 내용 확인 (녹취록 원문 대조)', status = '보류', priority = '하',
  note = '회의록 화자 분석 제거로 우선순위 하향', updated_at = datetime('now'), updated_by = 'migration'
  WHERE id = 'F7';
