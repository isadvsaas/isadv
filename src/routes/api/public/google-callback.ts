import { createFileRoute } from "@tanstack/react-router";
import { verifyState } from "@/lib/google.server";

export const Route = createFileRoute("/api/public/google-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return new Response("missing params", { status: 400 });
        const v = verifyState(state);
        if (!v) return new Response("invalid state", { status: 400 });

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) return new Response("oauth not configured", { status: 500 });

        const redirectUri = `${url.protocol}//${url.host}/api/public/google-callback`;
        const tokRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret,
            redirect_uri: redirectUri, grant_type: "authorization_code",
          }),
        });
        const tok = await tokRes.json();
        if (!tok.access_token) {
          return new Response(`token exchange failed: ${JSON.stringify(tok)}`, { status: 400 });
        }

        // Get email
        let email: string | null = null;
        try {
          const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tok.access_token}` },
          });
          const info = await infoRes.json();
          email = info?.email ?? null;
        } catch {}

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("google_integration").upsert({
          company_id: v.companyId,
          email,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token ?? null,
          expiry: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
          calendar_id: "primary",
          conectado: true,
        }, { onConflict: "company_id" });

        return new Response(
          `<!doctype html><meta charset="utf-8"><title>Google conectado</title>
<body style="font-family:system-ui;background:#081410;color:#e5f3ea;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="text-align:center;padding:24px">
<h1>✅ Google Agenda conectado${email ? ` (${email})` : ""}</h1>
<p>Pode fechar esta aba.</p>
<script>setTimeout(()=>{window.close();location.href="/app/agente"},1500)</script>
</div></body>`,
          { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      },
    },
  },
});
