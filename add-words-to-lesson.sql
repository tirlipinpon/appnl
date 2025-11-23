-- Script SQL pour ajouter des mots à la leçon 0e24a33c-f3a2-4452-9dee-3ed78009fb17
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Vérifier que la leçon existe
SELECT id, title FROM nlapp_lessons WHERE id = '0e24a33c-f3a2-4452-9dee-3ed78009fb17';

-- Insérer les mots dans la table nlapp_words
INSERT INTO nlapp_words (lesson_id, dutch_text, french_text)
VALUES
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'verlaten', 'quitter'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'laten', 'laisser'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'zwak', 'faible'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'stam', 'racine'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'opzeggen', 'résilier'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'scheidbaar', 'séparable'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'gedicht', 'poème'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'liedje', 'chanson'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'afbetalen', 'rembourser'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'onscheidbaar', 'inséparable'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'klinkers', 'voyelles'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'enkelvoud', 'singulier'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'tellen', 'compter'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'vertellen', 'raconter'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'opstellen', 'rédiger'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'gebaar', 'geste'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'breed', 'large'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'brede', 'large'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'uitwisselen', 'échanger'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'moestuin', 'potager'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'bedrijven', 'pratiquer'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'wantrouwen', 'se méfier'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'vertrouwen', 'confiance'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'trouw', 'fidèle'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'tolereren', 'tolérer'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'nodig hebben', 'avoir besoin'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'richting', 'direction'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'vergelijken', 'comparer'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'gemakkelijk', 'facile'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'uiteindelijk', 'finalement'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'waarschuwen', 'avertir'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'tevreden', 'satisfait'),
  ('0e24a33c-f3a2-4452-9dee-3ed78009fb17', 'bezit', 'possession')
ON CONFLICT DO NOTHING;

-- Vérifier les mots ajoutés
SELECT 
  id,
  dutch_text,
  french_text,
  created_at
FROM nlapp_words
WHERE lesson_id = '0e24a33c-f3a2-4452-9dee-3ed78009fb17'
ORDER BY created_at DESC;

