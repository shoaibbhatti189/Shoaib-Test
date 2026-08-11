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
