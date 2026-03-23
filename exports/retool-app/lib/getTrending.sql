WITH trending AS (
  SELECT snapshot_time, raw_json
  FROM st_trending
  ORDER BY snapshot_time DESC
  LIMIT 1
),
goals AS (
  SELECT month_index, month_name, goal_amount, updated_at
  FROM st_goal_tracker
  /* WHERE year = 2025  -- add if you have a year column */
  ORDER BY month_index
)
SELECT
  (SELECT row_to_json(trending) FROM trending)            AS trending,
  (SELECT json_agg(row_to_json(goals)) FROM goals)        AS goals;
