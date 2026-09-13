ALTER TABLE public.agent_config
  ADD COLUMN IF NOT EXISTS prompt_custom text NOT NULL DEFAULT '';

GRANT SELECT (prompt_custom), INSERT (prompt_custom), UPDATE (prompt_custom) ON public.agent_config TO authenticated;
GRANT ALL ON public.agent_config TO service_role;