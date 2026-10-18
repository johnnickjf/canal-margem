-- Execute as owner after creating margem_publisher NOLOGIN. Dedicated CLI identity.
GRANT USAGE ON SCHEMA ops, raw, normalized, derived, published TO margem_publisher;
GRANT SELECT ON ALL TABLES IN SCHEMA ops, raw, normalized, derived, published TO margem_publisher;
GRANT INSERT ON published.publication, published.dependency, published.activation, published.receipt TO margem_publisher;
GRANT UPDATE(generation) ON published.channel TO margem_publisher;
-- No changes to accepted values, manifests, receipts or events.
