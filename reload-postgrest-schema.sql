-- Script SQL pour forcer PostgREST à recharger le schéma
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Méthode 1: Utiliser NOTIFY pour forcer le rechargement
NOTIFY pgrst, 'reload schema';

-- Méthode 2: Vérifier que la colonne existe bien
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'nlapp_lessons'
  AND column_name = 'enable_fill_in_blank';

-- Méthode 3: Vérifier toutes les colonnes de la table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'nlapp_lessons'
ORDER BY ordinal_position;

