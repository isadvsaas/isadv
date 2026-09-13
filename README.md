# AtendAi

Crie um app web LIMPO, single-tenant e funcional chamado "AtendeZap" — um agente de IA que atende no WhatsApp e organiza um CRM em kanban. Idioma: português do Brasil. Stack: React + TypeScript + Tailwind + shadcn + Lovable Cloud (Supabase). SEM travas, SEM paywall, SEM cobrança, SEM dependências de servidores de terceiros além do que eu configurar.

PRODUTO (mantenha básico, porém bem feito e realmente funcional):

1) AUTENTICAÇÃO: login/cadastro email+senha (Supabase Auth), rotas protegidas, logout. Cada conta enxerga só os próprios dados (RLS user_id = auth.uid()).

2) CONEXÃO WHATSAPP VIA EVOLUTION API (QR CODE) — o WhatsApp conecta por um servidor Evolution API externo (self-hosted). Crie uma edge function `evolution` que conversa com o Evolution usando os secrets EVOLUTION_API_URL e EVOLUTION_API_KEY (peça esses secrets na configuração). Use as convenções do Evolution API v2 (ajuste o formato conforme a versão):
   - create: POST {EVOLUTION_API_URL}/instance/create (header apikey), body { instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true }.
   - connect/gerar QR: GET {EVOLUTION_API_URL}/instance/connect/{instanceName} → retorna base64 do QR Code.
   - status: GET {EVOLUTION_API_URL}/instance/connectionState/{instanceName} → state open|connecting|close.
   - sendText: POST {EVOLUTION_API_URL}/message/sendText/{instanceName} body { number, text }.
   - setWebhook: aponta o webhook da instância para a edge function `whatsapp-webhook`, evento MESSAGES_UPSERT, base64 false.
   - logout/delete.
   Tela "Conexão": botão "Conectar WhatsApp" → cria a instância (nome derivado do user id) → exibe o QR CODE grande na tela com instrução (WhatsApp > Aparelhos conectados > Conectar aparelho) → faz polling do status a cada 5s → quando "open", marca conectado e configura o webhook automaticamente. Badge de status, botão Reconectar e Desconectar. Salve em `whatsapp_instances` (user_id, instance_name, numero, status, updated_at).

3) IA QUE RESPONDE (edge function `whatsapp-webhook`): recebe os eventos MESSAGES_UPSERT do Evolution. Normalize o payload, ignore mensagens fromMe, de grupo e sem texto. Ache o dono pela instância em `whatsapp_instances`. Monte o system prompt a partir da `agent_config` do usuário. Chame a Lovable AI (POST https://ai.gateway.lovable.dev/v1/chat/completions, header Authorization Bearer do secret LOVABLE_API_KEY, modelo "google/gemini-2.5-flash") com system = prompt do agente e user = texto recebido. Envie a resposta de volta via Evolution sendText. Salve tudo em `mensagens` (user_id, numero, contato_nome, direcao entrada|saida, autor ia|humano|contato, texto, created_at). Respeite palavra_pausar/palavra_despausar do agent_config: se o dono mandar a palavra de pausa no chat daquele contato, a IA para de responder aquele contato até a palavra de despausa (controle por uma flag por contato).

4) CONFIGURAÇÃO DO AGENTE (`agent_config`, 1 por usuário): formulário com nome_agente, nome_empresa, papel_objetivo, estilo_comunicacao, sobre_empresa, produtos_servicos, pode_fazer, nao_pode_fazer, telefone_transferencia, palavra_pausar, palavra_despausar. Mostre um preview do prompt montado a partir desses campos. Botão "Testar resposta da IA" que roda a Lovable AI com uma mensagem de exemplo e mostra o retorno.

5) CRM KANBAN (`crm_cards`: user_id, numero, nome, status, ultima_mensagem, ultima_em, observacao) — 4 colunas: Conversas → Negociando → Ganho → Perda.
   - O usuário ARRASTA cards entre colunas (drag-and-drop, atualiza status), pode editar nome/observação, remover, e "Adicionar do WhatsApp" (lista conversas recentes e joga em Conversas).
   - A IA MOVE o card automaticamente: na `whatsapp-webhook`, depois de responder, classifique o estágio da conversa (palavras-chave OU uma segunda chamada curta à IA retornando só: conversas|negociando|ganho|perda) e faça upsert em `crm_cards` daquele número atualizando status, ultima_mensagem e ultima_em. Assim o card anda sozinho conforme a conversa — mas o humano também pode arrastar a qualquer momento.
   - REALTIME: a tela do kanban assina mudanças em `crm_cards` (Supabase realtime) e reflete ao vivo quando a IA move um card.

6) DASHBOARD simples: status do agente (conectado/desconectado), contadores (conversas, em negociação, ganhos, perdas) e um feed das últimas mensagens.

DESIGN: moderno, limpo, tema claro, verde estilo WhatsApp como cor de destaque, mobile-first, shadcn, micro-interações suaves. Branding centralizado em src/config/brand.ts (nome "AtendeZap" + cor) pra trocar fácil.

Loading states e toasts (sonner) em todas as ações. Ao final, liste exatamente os SECRETS que preciso configurar (EVOLUTION_API_URL, EVOLUTION_API_KEY, LOVABLE_API_KEY) e quaisquer pendências/limitações.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://atendzap.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fb4fa60f-d0e7-4f7b-b13a-9f67ed198ca9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
