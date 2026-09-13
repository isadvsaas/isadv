INSERT INTO public.plan (slug, nome, descricao, preco_cents, moeda, intervalo, trial_days, limite_mensagens, limite_instancias, limite_usuarios, limite_contatos, features, destaque, ativo, ordem)
VALUES
  ('starter', 'STARTER', 'Pra autônomo testando a operação.', 9700, 'BRL', 'month', 3, 1500, 1, 1, 1000,
   '["1 número de WhatsApp","1 usuário","1.500 conversas/mês","1.000 contatos","CRM Kanban + IA Gemini","Suporte por email"]'::jsonb,
   false, true, 1),
  ('pro', 'PRO', 'Pra time que já vende todo dia. O mais escolhido.', 19700, 'BRL', 'month', 3, 6000, 1, 5, 5000,
   '["1 número de WhatsApp","5 usuários no painel","6.000 conversas/mês","5.000 contatos","IA Gemini + GPT + Claude","Google Agenda + Relatórios","Suporte prioritário"]'::jsonb,
   true, true, 2),
  ('business', 'BUSINESS', 'Pra operação alta performance e múltiplas equipes.', 49700, 'BRL', 'month', 3, 30000, 1, 20, 25000,
   '["1 número de WhatsApp","20 usuários no painel","30.000 conversas/mês","25.000 contatos","API + Webhooks","Onboarding 1:1 + Gerente dedicado","SLA 99,9% + Suporte 24/7"]'::jsonb,
   false, true, 3)
ON CONFLICT (slug) DO NOTHING;