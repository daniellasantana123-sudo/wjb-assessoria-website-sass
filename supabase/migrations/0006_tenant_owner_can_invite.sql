-- SAAS FASE 2 — "Usuários" no Portal do Cliente: o responsável (owner) de
-- uma empresa passa a poder convidar colegas para a própria empresa, sem
-- precisar da WJB pra cada convite. Editar papel/remover continua exclusivo
-- de staff (mais sensível — evita um owner se trancar fora ou remover
-- alguém sem supervisão).

drop policy "tenant_members_write_staff_only" on public.tenant_members;

create policy "tenant_members_insert_staff_or_owner"
  on public.tenant_members for insert
  with check (public.is_staff() or public.is_tenant_owner(tenant_id));

create policy "tenant_members_update_staff_only"
  on public.tenant_members for update
  using (public.is_staff());

create policy "tenant_members_delete_staff_only"
  on public.tenant_members for delete
  using (public.is_staff());
