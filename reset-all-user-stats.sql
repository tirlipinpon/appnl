-- Script pour réinitialiser toutes les statistiques utilisateur
-- Ce script supprime toutes les données de progression sans toucher aux mots et aux leçons

-- 1. Supprimer toutes les tentatives de quiz
DELETE FROM nlapp_quiz_attempts;

-- 2. Supprimer toutes les leçons complétées par les utilisateurs
DELETE FROM nlapp_user_lessons;

-- 3. Supprimer toute la progression des utilisateurs sur les mots
DELETE FROM nlapp_user_progress;

-- Vérification : Afficher le nombre de lignes supprimées (optionnel, pour confirmation)
-- SELECT 
--   (SELECT COUNT(*) FROM nlapp_quiz_attempts) as quiz_attempts_count,
--   (SELECT COUNT(*) FROM nlapp_user_lessons) as user_lessons_count,
--   (SELECT COUNT(*) FROM nlapp_user_progress) as user_progress_count;

