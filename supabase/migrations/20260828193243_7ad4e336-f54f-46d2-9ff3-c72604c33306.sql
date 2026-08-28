REVOKE ALL ON FUNCTION public.finalize_donation(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_donation(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_donation(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_donation(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;

-- The payments table is written only by the server; no client role may reach it.
REVOKE ALL ON TABLE public.payments FROM anon, authenticated;
CREATE POLICY "payments are server-only" ON public.payments FOR SELECT TO authenticated USING (false);