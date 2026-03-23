SELECT snapshot_time, raw_json
FROM st_per_csr
ORDER BY snapshot_time DESC
LIMIT 1;
