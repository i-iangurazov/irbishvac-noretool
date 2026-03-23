INSERT INTO st_goal_tracker (month_index, month_name, goal_amount, updated_at)
VALUES (
  {{ monthMap.data[select1.value] }},          -- month_index
  {{ select1.value }},                                     -- month_name
  {{ Number(numberInput1.value || 0) }},                   -- goal_amount
  now()
)
ON CONFLICT (month_index) DO UPDATE
SET
  month_name  = EXCLUDED.month_name,
  goal_amount = EXCLUDED.goal_amount,
  updated_at  = now()
RETURNING *;
