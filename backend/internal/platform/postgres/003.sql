-- Publication data is append-only; only the channel pointer can advance.
CREATE TABLE published.publication (
 id text PRIMARY KEY CHECK(length(id)=64),
 manifest jsonb NOT NULL,
 catalog_revision text NOT NULL,
 data_cutoff timestamptz NOT NULL,
 base_activation bigint NOT NULL CHECK(base_activation>=0),
 prepared_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 projection_key text UNIQUE NOT NULL,
 projection_sha256 text NOT NULL,
 projection_bytes bigint NOT NULL CHECK(projection_bytes BETWEEN 1 AND 16777216)
);
CREATE TABLE published.dependency (
 publication text NOT NULL REFERENCES published.publication(id),
 id text NOT NULL,
 normalized_id text REFERENCES normalized.observation(id),
 derived_id text REFERENCES derived.evaluation(id),
 CHECK ((normalized_id IS NOT NULL)::int + (derived_id IS NOT NULL)::int = 1),
 CHECK(id=coalesce(normalized_id,derived_id)),
 PRIMARY KEY(publication,id)
);
CREATE TABLE published.channel (
 id text PRIMARY KEY CHECK(id='public'),
 generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0)
);
INSERT INTO published.channel(id) VALUES ('public');
CREATE TABLE published.activation (
 generation bigint PRIMARY KEY CHECK(generation>0),
 publication text NOT NULL REFERENCES published.publication(id),
 previous_activation bigint NOT NULL,
 activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor text NOT NULL, reason text NOT NULL
);
CREATE TABLE published.receipt (
 operation text NOT NULL CHECK(operation IN ('prepare','activate','return')),
 actor text NOT NULL, key text NOT NULL, fingerprint text NOT NULL,
 result jsonb NOT NULL,
 PRIMARY KEY(operation,actor,key)
);
