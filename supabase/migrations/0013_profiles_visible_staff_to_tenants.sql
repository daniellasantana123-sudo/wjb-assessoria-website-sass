-- SAAS FASE 3/4 — "Tickets": mesma classe de bug já corrigida em
-- 0007_profiles_visible_to_tenant_colleagues.sql, agora do outro lado.
-- `ticket_messages` embute `profiles(full_name, is_wjb_staff)` pra mostrar
-- quem respondeu — quando quem responde é staff, a policy original de
-- `profiles` bloqueia o cliente de ver esse perfil (staff não é
-- `tenant_member` de nenhuma empresa, então `profiles_select_tenant_colleagues`
-- não cobre esse caso), e o embed do Supabase volta `null`: a resposta da
-- WJB aparecia como "Pessoa sem nome" pro cliente. Achado testando de
-- ponta a ponta no navegador, não em revisão de código.
--
-- Fix: policy adicional (permissiva, soma com as existentes via OR) —
-- qualquer usuário autenticado pode ver o profile de quem é staff da WJB.
-- Não é dado sensível (é literalmente "quem do time WJB está te
-- atendendo"), mesmo racional de aceitação de MVP do 0007.

create policy "profiles_select_staff_visible_to_authenticated"
  on public.profiles for select
  to authenticated
  using (is_wjb_staff = true);
