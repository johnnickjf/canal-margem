-- Engine evaluations are immutable and never activate a public projection.
CREATE TABLE derived.evaluation (
 id text PRIMARY KEY CHECK(length(id)=64),
 request jsonb NOT NULL,
 definition jsonb NOT NULL,
 result jsonb NOT NULL,
 calculated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE derived.input (
 evaluation text NOT NULL REFERENCES derived.evaluation(id),
 role text NOT NULL,
 normalized_id text REFERENCES normalized.observation(id),
 derived_id text REFERENCES derived.evaluation(id),
 CHECK ((normalized_id IS NOT NULL)::int + (derived_id IS NOT NULL)::int = 1),
 PRIMARY KEY(evaluation,role)
);
CREATE INDEX ON derived.input(normalized_id) WHERE normalized_id IS NOT NULL;
CREATE INDEX ON derived.input(derived_id) WHERE derived_id IS NOT NULL;
