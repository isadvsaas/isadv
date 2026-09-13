// Processamento de campanhas (disparo em massa) com claim atômico e bloqueio de empresa suspensa.
// Roda dentro do worker de follow-up (nenhum cron novo) e também pelo endpoint dedicado.

export async function processDueCampaigns(admin: any, maxCampaigns = 10) {
  const nowIso = new Date().toISOString();

  // Promove agendadas cuja hora chegou
  await admin
    .from("campaign")
    .update({ status: "enviando" })
    .eq("status", "agendada")
    .lte("proximo_envio_em", nowIso);

  const { data: due } = await admin
    .from("campaign")
    .select("*")
    .eq("status", "enviando")
    .lte("proximo_envio_em", nowIso)
    .limit(Math.min(25, Math.max(1, maxCampaigns)));

  const { evoSendText } = await import("@/lib/evolution.server");
  const { isCompanyOperational } = await import("@/lib/billing-guard.server");

  const processed: any[] = [];

  for (const c of (due ?? []) as any[]) {
    // Empresa suspensa/inadimplente: pausa a campanha, não envia nada.
    if (!(await isCompanyOperational(admin, c.company_id))) {
      await admin.from("campaign").update({ status: "pausada" }).eq("id", c.id);
      processed.push({ id: c.id, skipped: "empresa_suspensa" });
      continue;
    }

    const { data: inst } = await admin
      .from("whatsapp_instances")
      .select("instance_name, status")
      .eq("company_id", c.company_id)
      .maybeSingle();
    if (!inst || inst.status !== "open") {
      processed.push({ id: c.id, skipped: "sem_whatsapp" });
      continue;
    }

    // Claim atômico (FOR UPDATE SKIP LOCKED) → nunca envia 2x o mesmo destino.
    const { data: claimedRows, error: claimErr } = await admin.rpc("campaign_claim_targets", {
      _campaign_id: c.id,
      _limit: 5,
      _worker: `w-${Math.random().toString(36).slice(2, 8)}`,
    });
    if (claimErr) {
      processed.push({ id: c.id, error: claimErr.message });
      continue;
    }

    const targets = (claimedRows ?? []) as any[];
    if (!targets.length) {
      const { data: pendentes } = await admin.rpc("campaign_pending_count", { _campaign_id: c.id });
      if (!pendentes || Number(pendentes) === 0) {
        await admin
          .from("campaign")
          .update({ status: "concluida", concluido_em: new Date().toISOString() })
          .eq("id", c.id);
        processed.push({ id: c.id, done: true });
      } else {
        processed.push({ id: c.id, waiting: Number(pendentes) });
      }
      continue;
    }

    let enviados = 0;
    let falhas = 0;
    for (const t of targets) {
      try {
        const texto = String(c.mensagem || "").replace(/\{\{nome\}\}/gi, t.contato_nome || "");
        await evoSendText(inst.instance_name, t.contato_numero, texto);
        await admin
          .from("campaign_target")
          .update({ status: "enviado", enviado_em: new Date().toISOString(), erro: null })
          .eq("id", t.id);
        if (c.created_by) {
          await admin.from("mensagens").insert({
            company_id: c.company_id,
            user_id: c.created_by,
            numero: t.contato_numero,
            contato_nome: t.contato_nome,
            direcao: "saida",
            autor: "sistema",
            texto,
          });
        }
        enviados++;
      } catch (e: any) {
        const msg = String(e?.message ?? e).slice(0, 500);
        const tentativas = Number(t.tentativas ?? 1);
        await admin
          .from("campaign_target")
          .update(
            tentativas >= 3
              ? { status: "falhou", erro: msg }
              : { status: "pendente", erro: msg, locked_at: null, locked_by: null },
          )
          .eq("id", t.id);
        if (tentativas >= 3) falhas++;
      }
    }

    const minS = Math.max(2, c.intervalo_min_seg ?? 5);
    const maxS = Math.max(minS, c.intervalo_max_seg ?? 20);
    let nextDelaySeg = Math.floor(minS + Math.random() * (maxS - minS + 1));

    const totalEnviados = (c.total_enviados ?? 0) + enviados;
    const pausaApos = c.pausa_apos_envios ?? 50;
    const pausaDurMin = c.pausa_duracao_min ?? 10;
    if (pausaApos > 0 && Math.floor(totalEnviados / pausaApos) > Math.floor((c.total_enviados ?? 0) / pausaApos)) {
      nextDelaySeg = pausaDurMin * 60;
    }

    await admin
      .from("campaign")
      .update({
        total_enviados: totalEnviados,
        total_falhas: (c.total_falhas ?? 0) + falhas,
        proximo_envio_em: new Date(Date.now() + nextDelaySeg * 1000).toISOString(),
      })
      .eq("id", c.id);

    processed.push({ id: c.id, enviados, falhas });
  }

  return { processed };
}
