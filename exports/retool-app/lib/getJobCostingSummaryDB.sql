SELECT snapshot_time, raw_json
FROM st_job_costing_summary
ORDER BY snapshot_time DESC
LIMIT 1;