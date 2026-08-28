CREATE OR REPLACE FUNCTION public.finalize_donation(_reference text, _status text, _provider_txn text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.donations%ROWTYPE;
  inv public.invoices%ROWTYPE;
BEGIN
  IF _status NOT IN ('PENDING','PROCESSING','PAID','FAILED','CANCELLED','REFUNDED') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT * INTO d FROM public.donations WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Idempotent: a donation already settled as PAID is never re-applied.
  IF d.status = 'PAID' THEN
    SELECT * INTO inv FROM public.invoices WHERE donation_id = d.id;
    RETURN jsonb_build_object('found', true, 'status', d.status, 'invoice_number', inv.invoice_number, 'already', true);
  END IF;

  IF _status = 'PAID' THEN
    UPDATE public.donations SET status = 'PAID', paid_at = now() WHERE id = d.id;
    UPDATE public.campaigns
      SET raised_amount = raised_amount + d.amount,
          donor_count = donor_count + 1
      WHERE id = d.campaign_id;
    INSERT INTO public.invoices (donation_id, invoice_number, reference, amount, currency)
    VALUES (d.id, 'HAMLA-INV-' || lpad(nextval('public.invoice_seq')::text, 8, '0'), d.reference, d.amount, d.currency)
    ON CONFLICT (donation_id) DO NOTHING;
    SELECT * INTO inv FROM public.invoices WHERE donation_id = d.id;
  ELSE
    UPDATE public.donations SET status = _status WHERE id = d.id;
  END IF;

  UPDATE public.payments
    SET status = _status,
        provider_transaction_id = COALESCE(_provider_txn, provider_transaction_id)
    WHERE donation_id = d.id;

  RETURN jsonb_build_object('found', true, 'status', _status, 'invoice_number', inv.invoice_number, 'already', false);
END; $$;

REVOKE EXECUTE ON FUNCTION public.finalize_donation(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_donation(text, text, text) TO service_role;