CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS normalized;
CREATE SCHEMA IF NOT EXISTS derived;
CREATE SCHEMA IF NOT EXISTS published;
CREATE TABLE IF NOT EXISTS ops.catalog (
 id text PRIMARY KEY, definition jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops.run (
 id uuid PRIMARY KEY, source text NOT NULL, catalog text NOT NULL REFERENCES ops.catalog(id),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
 window_start date NOT NULL, window_end date NOT NULL, error text, batch text,
 observations integer, changed integer
);
CREATE INDEX IF NOT EXISTS run_source_time ON ops.run(source, started_at DESC);
CREATE TABLE IF NOT EXISTS raw.object (
 sha256 text PRIMARY KEY CHECK(length(sha256)=64), key text UNIQUE NOT NULL,
 bytes bigint NOT NULL CHECK(bytes >= 0)
);
CREATE TABLE IF NOT EXISTS raw.capture (
 id uuid PRIMARY KEY, run uuid NOT NULL REFERENCES ops.run(id),
 object text NOT NULL REFERENCES raw.object(sha256), url text NOT NULL,
 retrieved_at timestamptz NOT NULL DEFAULT now(), status integer NOT NULL,
 headers jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS ops.event (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 run uuid NOT NULL REFERENCES ops.run(id), at timestamptz NOT NULL DEFAULT now(),
 event text NOT NULL, detail jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS normalized.observation (
 id text PRIMARY KEY, series text NOT NULL, start_date date NOT NULL, end_date date NOT NULL,
 geography text NOT NULL, value numeric, status text NOT NULL,
 context jsonb NOT NULL, locator text NOT NULL,
 CHECK(start_date <= end_date),
 CHECK(status IN ('observed','missing','not_applicable','suppressed')),
 CHECK((status='observed') = (value IS NOT NULL)),
 CHECK(value IS NULL OR value NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))
);
CREATE INDEX IF NOT EXISTS observation_lookup ON normalized.observation(series,start_date,end_date,geography);
CREATE TABLE IF NOT EXISTS normalized.batch (
 id text PRIMARY KEY, source text NOT NULL, catalog text NOT NULL REFERENCES ops.catalog(id),
 accepted_at timestamptz NOT NULL DEFAULT now(), window_start date NOT NULL, window_end date NOT NULL
);
CREATE TABLE IF NOT EXISTS normalized.member (
 batch text NOT NULL REFERENCES normalized.batch(id), observation text NOT NULL REFERENCES normalized.observation(id),
 PRIMARY KEY(batch, observation)
);
CREATE TABLE IF NOT EXISTS normalized.receipt (
 run uuid PRIMARY KEY REFERENCES ops.run(id), batch text NOT NULL REFERENCES normalized.batch(id),
 accepted_at timestamptz NOT NULL DEFAULT now()
);
-- Um lote reutilizado mantém também as capturas de cada nova tentativa, via recibo/run.
-- Sem seleção pública implícita: derived/published são fronteiras para as fases 8 e 9.
-- Papel de runtime não recebe UPDATE/DELETE em catálogo, raw ou normalized.
CREATE TABLE IF NOT EXISTS normalized.provenance (
 run uuid NOT NULL REFERENCES normalized.receipt(run),
 observation text NOT NULL REFERENCES normalized.observation(id),
 capture uuid NOT NULL REFERENCES raw.capture(id),
 PRIMARY KEY(run, observation, capture)
);
CREATE SCHEMA IF NOT EXISTS legacy;
CREATE TABLE IF NOT EXISTS legacy.import (
 id text PRIMARY KEY, manifest jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS legacy.file (
 import text NOT NULL REFERENCES legacy.import(id), path text NOT NULL,
 object text NOT NULL REFERENCES raw.object(sha256), PRIMARY KEY(import,path)
);
CREATE TABLE IF NOT EXISTS legacy.observation (
 id text PRIMARY KEY, record jsonb NOT NULL
);
