// Bloqueio de empresas suspensas/inadimplentes em toda automação (IA, follow-up, campanhas, lembretes).
// Fonte da verdade no banco: public.is_company_operational(company_id).

const cache = new Map<string, { ok: boolean; at: number }>();
const TTL_MS = 30_000;

/**
 * true = empresa pode consumir automações (ativa, ou trial/pendente dentro do prazo).
 * Em caso de erro de leitura, retorna false (fail-closed) para não gastar crédito de empresa suspensa.
 */
export async function isCompanyOperational(admin: any, companyId: string): Promise<boolean> {
  if (!companyId) return false;
  const hit = cache.get(companyId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ok;

  try {
    const { data, error } = await admin.rpc("is_company_operational", { _company_id: companyId });
    if (error) throw error;
    const ok = data === true;
    cache.set(companyId, { ok, at: Date.now() });
    return ok;
  } catch (e: any) {
    console.error("[billing-guard]", companyId, e?.message);
    return false;
  }
}
