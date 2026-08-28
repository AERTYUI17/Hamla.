-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
          NEW.email,
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  story text,
  cover_image text,
  goal_amount numeric(14,2) NOT NULL DEFAULT 0,
  raised_amount numeric(14,2) NOT NULL DEFAULT 0,
  donor_count integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'DZD',
  category text,
  organizer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organizer_name text NOT NULL DEFAULT '',
  organizer_avatar text,
  organizer_relation text,
  beneficiary text,
  location text,
  status text NOT NULL DEFAULT 'published',
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO anon, authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published campaigns are public" ON public.campaigns FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DONATIONS
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'DZD',
  donor_name text,
  donor_email text,
  anonymous boolean NOT NULL DEFAULT false,
  message text,
  status text NOT NULL DEFAULT 'PENDING',
  reference text NOT NULL UNIQUE,
  payment_provider text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own donations read" ON public.donations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER donations_updated_at BEFORE UPDATE ON public.donations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX donations_campaign_idx ON public.donations (campaign_id, created_at DESC);

-- PAYMENTS
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_transaction_id text,
  status text NOT NULL DEFAULT 'PENDING',
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'DZD',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE UNIQUE INDEX payments_provider_txn_idx ON public.payments (provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;

-- INVOICES
CREATE SEQUENCE public.invoice_seq START 1000;
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL UNIQUE REFERENCES public.donations(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  reference text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'DZD',
  issued_at timestamptz NOT NULL DEFAULT now(),
  emailed_at timestamptz
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invoices read" ON public.invoices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.donations d WHERE d.id = donation_id AND d.user_id = auth.uid()));

-- Safe public donor list (never exposes emails or anonymous names)
CREATE OR REPLACE FUNCTION public.campaign_donations(_slug text, _limit integer DEFAULT 20, _order text DEFAULT 'recent')
RETURNS TABLE (id uuid, donor_name text, amount numeric, message text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id,
         CASE WHEN d.anonymous OR d.donor_name IS NULL THEN NULL ELSE d.donor_name END,
         d.amount, d.message, d.created_at
  FROM public.donations d
  JOIN public.campaigns c ON c.id = d.campaign_id
  WHERE c.slug = _slug AND d.status = 'PAID'
  ORDER BY
    CASE WHEN _order = 'top' THEN d.amount END DESC NULLS LAST,
    d.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit,20),1),100);
$$;
GRANT EXECUTE ON FUNCTION public.campaign_donations(text, integer, text) TO anon, authenticated;

-- Seed demo campaign
INSERT INTO public.campaigns (title, slug, description, story, cover_image, goal_amount, raised_amount, donor_count, category, organizer_name, organizer_relation, beneficiary, location, verified)
VALUES (
  'ساعدوا عائلة أحمد على تجاوز محنتهم',
  'aid-ahmed-family',
  'حملة تضامنية لمساعدة عائلة أحمد على إعادة بناء منزلها وتغطية مصاريف العلاج بعد الحريق الذي أتى على كل ما تملك.',
  E'في ليلة الثاني عشر من الشهر الماضي، اندلع حريق في منزل عائلة أحمد بحي المرجة، والتهم كل ما تملكه العائلة خلال أقل من ساعة. نجا الجميع بأعجوبة، لكن الأب أصيب بحروق من الدرجة الثانية ولا يزال يتلقى العلاج في المستشفى.\n\n## لماذا نحتاج مساعدتكم\n\nالعائلة تعيش اليوم في غرفة واحدة لدى الأقارب، وهي مكونة من الأب والأم وأربعة أطفال أصغرهم في الثالثة من عمره. لا يملكون أثاثاً ولا ملابس شتوية، ومصاريف العلاج تتجاوز قدرتهم بكثير.\n\n## أين تذهب تبرعاتكم\n\n- تغطية مصاريف العلاج والأدوية للأب\n- كراء سكن مؤقت لمدة ستة أشهر\n- إعادة تهيئة المنزل وتأثيثه بالضروريات\n- مستلزمات الدراسة للأطفال الأربعة\n\nكل دينار يصل مباشرة إلى العائلة، ونلتزم بنشر تحديثات دورية مرفقة بالفواتير والصور حتى تطمئنوا على وجهة تبرعاتكم.\n\nشكراً لكل من ساهم، ولكل من شارك الحملة. مشاركتكم لا تقل أهمية عن التبرع.',
  '',
  3500000, 0, 0, 'إغاثة عائلية', 'محمد بن علي', 'ابن عم العائلة والمشرف على الحملة', 'عائلة أحمد بن يوسف', 'الجزائر العاصمة', true
);