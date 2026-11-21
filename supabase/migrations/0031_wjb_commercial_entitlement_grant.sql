-- WJB AI - Fase 8: has_entitlement() só para o servidor.
--
-- A 0030 liberava a função para `authenticated`. Como ela é SECURITY DEFINER
-- e recebe a empresa por parâmetro, qualquer usuário logado que soubesse o id
-- de outra empresa descobriria se ela tem plano de emissão ou relação de
-- contabilidade. A aplicação só chama a função pelo servidor (service role,
-- src/lib/commercial/repo.ts), então o acesso de usuário logado é retirado.
-- Aditiva: não altera tabela nem dado. Rollback: 15_rollback_0031.sql.
revoke execute on function public.has_entitlement(uuid, text) from authenticated;
grant execute on function public.has_entitlement(uuid, text) to service_role;
