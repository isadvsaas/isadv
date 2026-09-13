# 📘 Manual do Clonador — AtendeZap AI

Guia passo a passo para colocar sua cópia no ar. **Siga na ordem.** Onde tiver bloco `> PROMPT`, **copie e cole no chat do Lovable** exatamente como está.

---

## ✅ Passo 1 — Ativar o backend (Lovable Cloud)

O backend (banco, autenticação, storage) **não vem junto na clonagem**. Você precisa criar o seu.

**Cole no chat do Lovable:**

> **PROMPT 1:**
> ```
> Ative o Lovable Cloud neste projeto e rode todas as migrations existentes em supabase/migrations na ordem. Confirme quando todas as tabelas (company, company_user, user_roles, plan, agent_config, mensagens, whatsapp_instances, google_integration, crm_stage, crm_cards, etc.) estiverem criadas.
> ```

⏱ Aguarde ~30s. O Lovable vai criar o backend e aplicar todas as migrations.

---

## ✅ Passo 2 — Configurar os Secrets obrigatórios

**Cole no chat:**

> **PROMPT 2:**
> ```
> Preciso configurar os secrets do projeto. Abra o formulário para eu inserir os valores destes secrets:
> - EVOLUTION_API_URL
> - EVOLUTION_API_KEY
> - GOOGLE_CLIENT_ID
> - GOOGLE_CLIENT_SECRET
> ```

| Secret | Onde obter |
|---|---|
| `EVOLUTION_API_URL` | URL da sua instância Evolution API (ex: `https://evo.seudominio.com`) |
| `EVOLUTION_API_KEY` | API key gerada no painel da Evolution |
| `GOOGLE_CLIENT_ID` / `SECRET` | Google Cloud Console → Credenciais OAuth 2.0 |

> `LOVABLE_API_KEY` já é injetado automaticamente. Paddle só se for usar cobrança automática.

---

## ✅ Passo 3 — Tornar-se o Super Admin (Master)

⚠️ **Isso tem que ser feito ANTES de qualquer outra pessoa se cadastrar.** O sistema promove automaticamente o **primeiro usuário** a `super_admin`.

1. Abra a URL pública do seu projeto (canto superior direito do Lovable → "Open Preview")
2. Clique em **"Entrar"** → **"Criar conta"**
3. Cadastre com o e-mail que será o Master (ex: `admin@suamarca.com`)
4. Confirme o e-mail (caixa de entrada)
5. Faça login → acesse `/master/painel` → você é o Master ✅

### Se errou (outra pessoa virou master antes)

**Cole no chat:**

> **PROMPT 3 (recuperação):**
> ```
> Rode esta query SQL no banco para me promover a super_admin:
>
> INSERT INTO public.user_roles (user_id, role)
> SELECT id, 'super_admin'::app_role FROM auth.users WHERE email = 'SEU@EMAIL.COM'
> ON CONFLICT (user_id, role) DO NOTHING;
>
> UPDATE public.app_config SET super_admin_emails = ARRAY['SEU@EMAIL.COM'] WHERE id = true;
> ```
> (substitua `SEU@EMAIL.COM` pelo seu e-mail real antes de enviar)

---

## ✅ Passo 4 — Personalizar a marca

**Cole no chat:**

> **PROMPT 4:**
> ```
> Quero personalizar a marca do sistema. Abra o arquivo src/config/brand.ts e troque:
> - nome do produto para "MEU PRODUTO"
> - cor primária para #HEXAQUI
> - logo (se eu enviar uma imagem depois)
> Depois quero que você ajuste o favicon e o <title> da página em src/routes/__root.tsx.
> ```

---

## ✅ Passo 5 — Criar os Planos comerciais

1. No app, vá em `/master/planos`
2. Clique **"Novo plano"**
3. Defina: nome, preço mensal, limite de mensagens/mês, nº de atendentes, features liberadas
4. Crie pelo menos 1 plano "Trial" gratuito (7 dias) e 1 pago

---

## ✅ Passo 6 — Criar a primeira empresa-cliente

Em `/master/nova-empresa`:
- Nome da empresa
- E-mail do dono (owner)
- Plano (do passo 5)
- Sistema envia senha provisória por e-mail

O cliente faz login → troca a senha → completa o **onboarding (4 passos)** → conecta WhatsApp via QR Code.

---

## ✅ Passo 7 — (Opcional) Cobrança automática via Paddle

Só faça se quiser cobrar cartão automaticamente.

**Cole no chat:**

> **PROMPT 7:**
> ```
> Quero ativar a cobrança automática via Paddle. Me ajude a:
> 1. Configurar o secret PADDLE_LIVE_API_KEY (ou PADDLE_SANDBOX_API_KEY para testar)
> 2. Configurar o webhook do Paddle apontando para /api/public/billing/webhook
> 3. Mapear meus planos do passo 5 com os price IDs do Paddle
> ```

---

## ✅ Passo 8 — (Opcional) Integração Google Agenda

Já está pronta no código. Só precisa do **Passo 2** ter sido feito + adicionar o redirect URI no Google Cloud Console:

```
https://atendezap.live/api/public/google-callback
```

Cada cliente conecta a própria conta em `/app/agente/avancado` → botão "Conectar Google Agenda".

---

## ✅ Passo 9 — Publicar

No topo do Lovable → botão **"Publish"** → confirme.

Sua URL: `https://atendezap.live`
Para domínio próprio: Project Settings → Domains.

---

# 🗺️ Guia rápido de uso

## Como Master (`/master/*`)
| Tela | O que faz |
|---|---|
| **Painel** | KPIs gerais: MRR, empresas ativas, churn |
| **Empresas** | Listar, suspender, **impersonar** (entrar como a empresa pra dar suporte) |
| **Assinaturas** | Ver cobranças, marcar manual como paga |
| **Planos** | Criar/editar planos comerciais e limites |
| **Nova empresa** | Cadastro manual de cliente |
| **Configurações** | Branding global, lista de super admins |

## Como Cliente (`/app/*`)
| Tela | O que faz |
|---|---|
| **Dashboard** | KPIs do dia, conversas em andamento |
| **Conexão** | Escanear QR Code WhatsApp (⚠ não feche durante o scan) |
| **Agente** | Tom de voz, conhecimento, horário |
| **Agente Avançado** | Prompt customizado + Google Agenda |
| **Conversas** | Inbox unificada, pausar IA por contato |
| **CRM** | Kanban: Conversas → Negociando → Ganho/Perda |
| **Contatos** | Base de leads, tags |
| **Relatórios** | Conversões, tempo médio, ranking |
| **Equipe** | Convidar atendentes (owner/admin/atendente) |
| **Configurações** | Dados da empresa, identidade visual, plano |

---

# ⚠️ Boas práticas WhatsApp (evitar banimento)

Já implementado no código, mas oriente seus clientes:

- ✅ **Aquecer chip novo** — 1 a 2 semanas só recebendo antes de disparar
- ✅ **Não fazer disparo em massa** para contatos que nunca falaram (sistema bloqueia fora da janela de 24h)
- ✅ **Respeitar opt-out** — palavras "parar", "cancelar", "stop" pausam a IA automaticamente
- ✅ **Rate limit ativo** — 6 msgs/10min por contato, 20/min por empresa
- ❌ Não use o sistema para spam frio — risco alto de banimento permanente do número

Para volumes grandes ou clientes premium, considere migrar para a **WhatsApp Business Cloud API oficial** (sem risco de ban).

---

# 🆘 Comandos SQL úteis

Cole no chat:

> **PROMPT SQL:**
> ```
> Rode esta query: <COLE A QUERY AQUI>
> ```

```sql
-- Ver todos os super admins
SELECT u.email FROM auth.users u
JOIN user_roles r ON r.user_id = u.id WHERE r.role = 'super_admin';

-- Resetar onboarding de uma empresa
UPDATE company SET onboarding_completed = false WHERE id = '<uuid>';

-- Suspender empresa por inadimplência
UPDATE company SET status_cobranca = 'suspenso' WHERE id = '<uuid>';

-- Reativar empresa
UPDATE company SET status_cobranca = 'ativo' WHERE id = '<uuid>';

-- Listar empresas com nº de mensagens do mês
SELECT c.nome, COUNT(m.id) AS msgs_mes
FROM company c
LEFT JOIN mensagens m ON m.company_id = c.id
  AND m.created_at >= date_trunc('month', now())
GROUP BY c.id ORDER BY msgs_mes DESC;
```

---

# ❓ FAQ

**Posso mudar o nome do produto?** Sim, Passo 4 ou edite `src/config/brand.ts`.

**Como adicionar um novo super admin?** Use o PROMPT 3 com o e-mail dele (depois que ele já tiver criado conta).

**O QR Code do WhatsApp fica caindo.** Já corrigido — só conecte 1x. Se persistir, delete a instância em `/app/conexao` e reconecte.

**Como faço backup do banco?** No chat: `"Me dê um dump SQL de todas as tabelas do schema public"`.

**Posso revender?** Sim, este é o objetivo — você é dono da sua cópia.

---

Pronto. Em ~15 min seu SaaS está no ar. 🚀
