-- Script SQL pour diagnostiquer pourquoi les leçons complétées ne s'affichent pas
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- 1. Vérifier la structure de la table nlapp_user_lessons
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'nlapp_user_lessons'
ORDER BY ordinal_position;

-- 2. Vérifier toutes les leçons complétées (tous les utilisateurs)
SELECT 
  ul.id,
  ul.user_id,
  ul.lesson_id,
  ul.completed,
  ul.completed_at,
  ul.created_at,
  ul.updated_at,
  l.title as lesson_title
FROM nlapp_user_lessons ul
LEFT JOIN nlapp_lessons l ON ul.lesson_id = l.id
WHERE ul.completed = true
ORDER BY ul.completed_at DESC;

-- 3. Compter les leçons complétées par utilisateur
SELECT 
  ul.user_id,
  COUNT(*) as completed_count
FROM nlapp_user_lessons ul
WHERE ul.completed = true
GROUP BY ul.user_id;

-- 4. Vérifier les politiques RLS pour nlapp_user_lessons
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
WHERE tablename = 'nlapp_user_lessons';

-- 5. Vérifier si la table existe et est accessible
SELECT 
  table_name,
  table_schema
FROM information_schema.tables
WHERE table_name = 'nlapp_user_lessons';

-- 6. Test de requête similaire à celle utilisée dans getProgressStats
-- Remplacez 'USER_ID_ICI' par votre user_id réel
SELECT 
  id,
  user_id,
  lesson_id,
  completed
FROM nlapp_user_lessons
WHERE user_id = 'USER_ID_ICI'
  AND completed = true;

