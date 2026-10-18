-- Execute as owner after creating margem_api NOLOGIN. Public server identity.
GRANT USAGE ON SCHEMA published TO margem_api;
GRANT SELECT ON published.publication, published.activation TO margem_api;
-- Object-store credentials for this process can read PUBLIC_BUCKET only.
