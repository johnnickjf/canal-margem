-- name: CreateRawObject :exec
INSERT INTO raw.object(sha256,key,bytes) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING;
-- name: CreateCapture :exec
INSERT INTO raw.capture(id,run,object,url,status,headers) VALUES ($1,$2,$3,$4,$5,$6);
-- name: CreateEvent :exec
INSERT INTO ops.event(run,event,detail) VALUES ($1,$2,$3);
-- name: GetRunCaptures :many
SELECT o.*,c.id AS capture_id,c.status FROM raw.capture c JOIN raw.object o ON o.sha256=c.object WHERE c.run=$1 ORDER BY c.retrieved_at,c.id;
-- name: LockRun :one
SELECT * FROM ops.run WHERE id=$1 FOR UPDATE;
-- name: LatestSuccessfulRun :one
SELECT * FROM ops.run WHERE source=$1 AND status='succeeded' ORDER BY started_at DESC LIMIT 1;
-- name: BatchObservationIDs :many
SELECT observation FROM normalized.member WHERE batch=$1;
-- name: CreateBatch :exec
INSERT INTO normalized.batch(id,source,catalog,window_start,window_end) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING;
-- name: CreateObservation :exec
INSERT INTO normalized.observation(id,series,start_date,end_date,geography,value,status,context,locator) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING;
-- name: CreateMember :exec
INSERT INTO normalized.member(batch,observation) VALUES ($1,$2) ON CONFLICT DO NOTHING;
-- name: CreateReceipt :exec
INSERT INTO normalized.receipt(run,batch) VALUES ($1,$2);
-- name: CreateProvenance :exec
INSERT INTO normalized.provenance(run,observation,capture) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING;
-- name: SucceedRun :exec
UPDATE ops.run SET status='succeeded',finished_at=now(),batch=$2,observations=$3,changed=$4 WHERE id=$1 AND status='running';
-- name: FailRun :exec
UPDATE ops.run SET status='failed',finished_at=now(),error=$2 WHERE id=$1 AND status='running';
-- name: FailOrphanedRuns :exec
UPDATE ops.run SET status='failed',finished_at=now(),error='worker-lost' WHERE source=$1 AND status='running';
-- name: CreateRun :exec
INSERT INTO ops.run(id,source,catalog,status,window_start,window_end) VALUES ($1,$2,$3,'running',$4,$5);
-- name: LatestRun :one
SELECT * FROM ops.run WHERE source=$1 ORDER BY started_at DESC LIMIT 1;
-- name: RecentRunExists :one
-- A moving end date only requires coverage through the previous run's UTC day.
-- Requiring today's end would bypass weekly cadence every time the date changes.
SELECT EXISTS(SELECT 1 FROM ops.run WHERE source=$1 AND catalog=sqlc.arg(catalog) AND window_start <= sqlc.arg(window_start)::date AND window_end >= LEAST(sqlc.arg(window_end)::date, (started_at AT TIME ZONE 'UTC')::date) AND started_at > now() - (sqlc.arg(hours)::integer * interval '1 hour'));
-- name: RecentSuccessExists :one
SELECT EXISTS(SELECT 1 FROM ops.run WHERE source=$1 AND status='succeeded' AND finished_at > now() - (sqlc.arg(hours)::integer * interval '1 hour'));
-- name: BatchCoverage :many
SELECT o.series,min(start_date)::date AS first_period,max(end_date)::date AS last_period,count(*) AS observations,count(*) FILTER(WHERE status!='observed') AS unavailable FROM normalized.member m JOIN normalized.observation o ON o.id=m.observation WHERE m.batch=$1 GROUP BY o.series ORDER BY o.series;
-- name: AllRawObjects :many
SELECT * FROM raw.object ORDER BY sha256;
-- name: CountOrphanedObservations :one
SELECT count(*) FROM normalized.member m WHERE NOT EXISTS (SELECT 1 FROM normalized.receipt r JOIN normalized.provenance p ON p.run=r.run WHERE r.batch=m.batch AND p.observation=m.observation);
-- name: CreateLegacyImport :exec
INSERT INTO legacy.import(id,manifest) VALUES ($1,$2) ON CONFLICT DO NOTHING;
-- name: CreateLegacyFile :exec
INSERT INTO legacy.file(import,path,object) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING;
-- name: GetLegacyObservation :one
SELECT record FROM legacy.observation WHERE id=$1;
-- name: CreateLegacyObservation :exec
INSERT INTO legacy.observation(id,record) VALUES ($1,$2) ON CONFLICT DO NOTHING;

-- name: AcceptedSourceCoverage :many
WITH accepted AS (
 SELECT DISTINCT ON (o.series,o.start_date,o.end_date,o.geography)
   o.series,o.start_date,o.end_date,o.geography,o.status
 FROM ops.run r
 JOIN normalized.receipt receipt ON receipt.run=r.id
 JOIN normalized.member m ON m.batch=receipt.batch
 JOIN normalized.observation o ON o.id=m.observation
 WHERE r.source=$1 AND r.catalog=$2 AND r.status='succeeded'
 ORDER BY o.series,o.start_date,o.end_date,o.geography,r.started_at DESC,r.id DESC
)
SELECT series,min(start_date)::date AS first_period,max(end_date)::date AS last_period,
 count(*) AS observations,count(*) FILTER(WHERE status!='observed') AS unavailable
FROM accepted GROUP BY series ORDER BY series;

-- name: EngineNormalizedInput :one
SELECT o.id,o.series,o.start_date,o.end_date,o.geography,coalesce(o.value::text,'')::text AS value_text,o.status,o.context
FROM normalized.observation o
WHERE o.id=$1 AND EXISTS (
 SELECT 1 FROM normalized.member m JOIN normalized.receipt r ON r.batch=m.batch
 JOIN ops.run run ON run.id=r.run
 WHERE m.observation=o.id AND run.status='succeeded'
);
-- name: EngineEvaluation :one
SELECT * FROM derived.evaluation WHERE id=$1;
-- name: CreateEngineEvaluation :exec
INSERT INTO derived.evaluation(id,request,definition,result) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING;
-- name: CreateEngineInput :exec
INSERT INTO derived.input(evaluation,role,normalized_id,derived_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING;
