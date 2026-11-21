-- Rollback da 0031 (homologação): volta a permissão da 0030.
grant execute on function public.has_entitlement(uuid, text) to authenticated;
