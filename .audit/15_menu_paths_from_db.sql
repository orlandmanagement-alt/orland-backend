SELECT
  id,
  code,
  label,
  path,
  parent_id,
  sort_order,
  icon
FROM menus
ORDER BY sort_order ASC, created_at ASC;
