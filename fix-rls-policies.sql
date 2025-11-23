-- Script SQL pour ajouter les politiques RLS manquantes pour INSERT et UPDATE
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Politiques pour nlapp_words (INSERT et UPDATE)
CREATE POLICY "Authenticated users can insert words"
  ON nlapp_words FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update words"
  ON nlapp_words FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete words"
  ON nlapp_words FOR DELETE
  TO authenticated
  USING (true);

-- Politiques pour nlapp_lessons (INSERT et UPDATE)
CREATE POLICY "Authenticated users can insert lessons"
  ON nlapp_lessons FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update lessons"
  ON nlapp_lessons FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lessons"
  ON nlapp_lessons FOR DELETE
  TO authenticated
  USING (true);

-- Vérifier que les politiques existent
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('nlapp_words', 'nlapp_lessons')
ORDER BY tablename, policyname;




