-- Script SQL pour diagnostiquer les problèmes de langues inversées dans nlapp_words
-- Exécutez ce script dans l'éditeur SQL de Supabase pour vérifier vos données

-- 1. Afficher tous les mots d'une leçon spécifique pour vérifier les données
SELECT 
  id,
  lesson_id,
  french_text,
  dutch_text,
  created_at
FROM nlapp_words
WHERE lesson_id = 'efeb5d2c-3e15-4055-8de2-a3d746b3412b'  -- Remplacez par votre lesson_id
ORDER BY created_at;

-- 2. Comparer avec la leçon de référence qui fonctionne
SELECT 
  id,
  lesson_id,
  french_text,
  dutch_text,
  created_at
FROM nlapp_words
WHERE lesson_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at;

-- 3. Vérifier s'il y a des mots avec des valeurs NULL ou vides
SELECT 
  id,
  lesson_id,
  french_text,
  dutch_text,
  CASE 
    WHEN french_text IS NULL OR french_text = '' THEN 'french_text vide'
    WHEN dutch_text IS NULL OR dutch_text = '' THEN 'dutch_text vide'
    ELSE 'OK'
  END as status
FROM nlapp_words
WHERE lesson_id = 'efeb5d2c-3e15-4055-8de2-a3d746b3412b';

-- 4. Si vous avez identifié des mots avec les langues inversées, utilisez cette requête pour les corriger
-- ATTENTION: Ne décommentez et n'exécutez cette requête QUE si vous êtes sûr que les données sont inversées
-- Remplacez 'WORD_ID' par l'ID du mot à corriger

/*
UPDATE nlapp_words
SET 
  french_text = dutch_text,
  dutch_text = french_text
WHERE id = 'WORD_ID';
*/

-- 5. Pour corriger tous les mots d'une leçon (si vous êtes sûr qu'ils sont tous inversés)
-- ATTENTION: Utilisez avec précaution, sauvegardez d'abord vos données !

/*
UPDATE nlapp_words
SET 
  french_text = dutch_text,
  dutch_text = french_text
WHERE lesson_id = 'efeb5d2c-3e15-4055-8de2-a3d746b3412b';
*/

