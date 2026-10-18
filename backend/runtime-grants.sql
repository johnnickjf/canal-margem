-- Executar como administrador, após criar o grupo margem_worker NOLOGIN.
-- Criar um login próprio e conceder o grupo; nunca usar o dono do schema no cron.
GRANT USAGE ON SCHEMA ops, raw, normalized, derived TO margem_worker;
GRANT SELECT ON ALL TABLES IN SCHEMA ops, raw, normalized, derived TO margem_worker;
GRANT INSERT ON ops.run, ops.event, raw.object, raw.capture,
  normalized.observation, normalized.batch, normalized.member, normalized.receipt, normalized.provenance, derived.evaluation, derived.input TO margem_worker;
GRANT UPDATE(status,finished_at,error,batch,observations,changed) ON ops.run TO margem_worker;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ops TO margem_worker;
-- Sem DELETE, DDL, alteração dos registros aceitos, escrita published ou gestão de lock R2.
