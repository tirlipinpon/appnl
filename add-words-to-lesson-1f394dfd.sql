-- Script SQL pour ajouter des mots à la leçon 1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Vérifier que la leçon existe
SELECT id, title FROM nlapp_lessons WHERE id = '1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5';

-- Insérer les mots dans la table nlapp_words
INSERT INTO nlapp_words (lesson_id, dutch_text, french_text)
VALUES
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'gegeven', 'Donnée'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'kolom', 'Colonne'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'rij', 'Ligne'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'ontwikkelaar', 'Développeur'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'oplossing', 'Correction'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'deadline', 'Délai'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'vergadering', 'Réunion'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'vereiste', 'Requirement'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'taak', 'Tâche'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'omgeving', 'Environnement'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'beveiliging', 'Sécurité'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'toegang', 'Accès'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'gebruikersnaam', 'Identifiant'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'wachtwoord', 'Mot de passe'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'bestand', 'Fichier'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'fout', 'Erreur'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'prestatie', 'Performance'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'configuratie', 'Configuration'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'ondersteuning', 'Support'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'melding', 'Notification'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'verslag', 'Rapport'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'automatisering', 'Automatisation'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'gebruikersinterface', 'Interface'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'logboek', 'Journal'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'verbinding', 'Connexion'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'kritieke fout', 'Erreur critique'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'afhankelijkheid', 'Dépendance'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'uitvoering', 'Exécution'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'geschiedenis', 'Historique'),
  ('1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5', 'prioriterin', 'Priorisation')
ON CONFLICT DO NOTHING;

-- Vérifier les mots ajoutés
SELECT COUNT(*) as total_words FROM nlapp_words WHERE lesson_id = '1f394dfd-795e-4a00-a0e3-3f4af9ab2fc5';

