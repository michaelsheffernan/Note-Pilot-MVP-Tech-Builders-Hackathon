
-- Add preferences column to uploads
ALTER TABLE public.uploads ADD COLUMN preferences jsonb DEFAULT '{}'::jsonb;

-- Allow users to delete their own study plans (needed for regeneration)
CREATE POLICY "Users can delete own study plans"
ON public.study_plans FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to update their own flashcards (needed for regeneration)
CREATE POLICY "Users can update own flashcards"
ON public.flashcards FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to delete their own flashcards (needed for regeneration)
CREATE POLICY "Users can delete own flashcards"
ON public.flashcards FOR DELETE
USING (auth.uid() = user_id);
