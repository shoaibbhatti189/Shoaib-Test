-- 1. Create a function to automatically insert a row into the public "users" table when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, username, role, updated_at)
  VALUES (new.id, new.email, 'employee', now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Enable RLS (Row Level Security) on the users table (which acts as our profiles table)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Create explicit RLS policies (deny by default, only allow specific actions)
CREATE POLICY "Users can view their own profile."
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Enable RLS on all other public tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paychecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_overrides ENABLE ROW LEVEL SECURITY;

-- Blanket policies allowing authenticated users to interact with the tables.
-- Note: Real apps would use more granular policies based on company_id, but the backend is handling auth scope anyway.
CREATE POLICY "Allow authenticated users" ON public.companies FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.employees FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.attendance FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.payroll_runs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.paychecks FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.products FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.inventory_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.cart_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.checkout_overrides FOR ALL TO authenticated USING (true);
