-- Script SQL pour vérifier les phrases sans traduction
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- ============================================
-- 1. Compter le nombre de phrases sans traduction
-- ============================================
SELECT 
  COUNT(*) as phrases_sans_traduction_neerlandaises
FROM nlapp_words
WHERE fill_in_blank_sentence IS NOT NULL 
  AND fill_in_blank_sentence_translation IS NULL;

-- ============================================
-- 2. Liste détaillée des phrases néerlandaises sans traduction française
-- ============================================
SELECT 
  id,
  dutch_text as mot_neerlandais,
  french_text as mot_francais,
  fill_in_blank_sentence as phrase_neerlandaise,
  fill_in_blank_sentence_translation as traduction_francaise,
  created_at as date_creation,
  CASE 
    WHEN fill_in_blank_sentence IS NOT NULL AND fill_in_blank_sentence_translation IS NULL 
    THEN '❌ Traduction manquante'
    ELSE '✅ OK'
  END as status
FROM nlapp_words
WHERE fill_in_blank_sentence IS NOT NULL 
  AND fill_in_blank_sentence_translation IS NULL
ORDER BY created_at DESC;

-- ============================================
-- 3. Statistiques par leçon
-- ============================================
SELECT 
  l.title as lecon,
  COUNT(*) as phrases_sans_traduction
FROM nlapp_words w
LEFT JOIN nlapp_lessons l ON w.lesson_id = l.id
WHERE w.fill_in_blank_sentence IS NOT NULL 
  AND w.fill_in_blank_sentence_translation IS NULL
GROUP BY l.id, l.title
ORDER BY phrases_sans_traduction DESC;

-- ============================================
-- 4. Vérifier aussi les phrases françaises sans traduction néerlandaise
-- ============================================
SELECT 
  COUNT(*) as phrases_francaises_sans_traduction
FROM nlapp_words
WHERE fill_in_blank_sentence_fr IS NOT NULL 
  AND fill_in_blank_sentence_fr_translation IS NULL;

-- ============================================
-- NOTE IMPORTANTE :
-- Les nouvelles phrases générées par l'IA incluront automatiquement 
-- leur traduction. Ce script sert uniquement à vérifier les phrases 
-- anciennes qui ont été créées avant l'ajout de cette fonctionnalité.
-- ============================================

