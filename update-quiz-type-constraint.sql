-- Script SQL pour mettre à jour la contrainte CHECK sur quiz_type
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- 1. Supprimer l'ancienne contrainte CHECK
ALTER TABLE nlapp_quiz_attempts 
  DROP CONSTRAINT IF EXISTS nlapp_quiz_attempts_quiz_type_check;

-- 2. Ajouter la nouvelle contrainte CHECK avec 'find_error' et 'reorder_sentence'
ALTER TABLE nlapp_quiz_attempts 
  ADD CONSTRAINT nlapp_quiz_attempts_quiz_type_check 
  CHECK (quiz_type IN ('multiple_choice', 'typing', 'fill_in_blank', 'reorder_sentence', 'find_error'));

-- Vérifier que la contrainte a été mise à jour
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'nlapp_quiz_attempts'::regclass
  AND conname LIKE '%quiz_type%';

