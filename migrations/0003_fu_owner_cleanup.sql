-- 액션 아이템 담당에서 화자 표기 제거 (이미 0002 적용된 DB 보정용)
UPDATE fu_items SET owner = '허지원 책임', updated_at = datetime('now'), updated_by = 'migration'
  WHERE owner = '화자A (허지원 책임 추정)';
UPDATE fu_items SET owner = '미정', updated_at = datetime('now'), updated_by = 'migration'
  WHERE owner = '화자B (추정)';
