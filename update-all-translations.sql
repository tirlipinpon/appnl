-- Script SQL pour mettre à jour toutes les traductions générées
-- Ce script a été généré automatiquement par generate-missing-translations.js
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Mise à jour des traductions par batch
-- Les traductions ont été générées avec DeepSeek API

UPDATE nlapp_words
SET fill_in_blank_sentence_translation = 'Nous devons promener le chien.'
WHERE id = '7df40d04-15f4-4aaf-9ef0-43de105062b9' AND fill_in_blank_sentence_translation IS NULL;

UPDATE nlapp_words
SET fill_in_blank_sentence_translation = 'Il est très faible après la maladie.'
WHERE id = '43a8d21b-6360-4ac4-8fcc-d2bc09fd581e' AND fill_in_blank_sentence_translation IS NULL;

UPDATE nlapp_words
SET fill_in_blank_sentence_translation = 'L''arbre a un tronc épais.'
WHERE id = '4c41f45d-b890-4e9d-a14c-a90e5e66914a' AND fill_in_blank_sentence_translation IS NULL;

UPDATE nlapp_words
SET fill_in_blank_sentence_translation = 'Il veut quitter la maison.'
WHERE id = '441094ba-a872-4270-a14d-7bfc88a54110' AND fill_in_blank_sentence_translation IS NULL;

UPDATE nlapp_words
SET fill_in_blank_sentence_translation = 'Je dois terminer mes devoirs.'
WHERE id = '69ff5bcd-b2a6-4f81-bb7f-1a2556d4984f' AND fill_in_blank_sentence_translation IS NULL;

-- Note: Ce script contient seulement les 5 premières traductions comme exemple
-- Pour toutes les 112 traductions, utilisez le script Node.js qui génère automatiquement
-- le script SQL complet avec toutes les traductions

