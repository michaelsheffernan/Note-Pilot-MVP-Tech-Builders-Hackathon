-- Fix uploads RLS: change SELECT, INSERT, DELETE policies from public to authenticated
DROP POLICY IF EXISTS "Users can view own uploads" ON public.uploads;
CREATE POLICY "Users can view own uploads" ON public.uploads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own uploads" ON public.uploads;
CREATE POLICY "Users can create own uploads" ON public.uploads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own uploads" ON public.uploads;
CREATE POLICY "Users can delete own uploads" ON public.uploads
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Fix notes storage: add UPDATE policy and restrict all to authenticated
DROP POLICY IF EXISTS "Users can view own notes" ON storage.objects;
CREATE POLICY "Users can view own notes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'notes' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload own notes" ON storage.objects;
CREATE POLICY "Users can upload own notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notes' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own notes" ON storage.objects;
CREATE POLICY "Users can delete own notes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'notes' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Add missing UPDATE policy for notes storage
CREATE POLICY "Users can update own notes" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'notes' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'notes' AND (auth.uid())::text = (storage.foldername(name))[1]);