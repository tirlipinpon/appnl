# Guide pour générer les traductions manquantes

Ce guide explique comment générer automatiquement les traductions manquantes pour les 112 phrases identifiées.

## Prérequis

1. Node.js installé (version 16 ou supérieure)
2. Accès à votre projet Supabase
3. Clé API DeepSeek (déjà configurée dans le code)

## Méthode 1 : Script Node.js (Recommandé)

### Étape 1 : Installer les dépendances

```bash
npm install @supabase/supabase-js
```

### Étape 2 : Configurer les variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
SUPABASE_URL=votre_url_supabase
SUPABASE_KEY=votre_cle_anon_supabase
DEEPSEEK_API_KEY=sk-db6617f690b04336b0469ffa1c6bf839
```

Ou modifiez directement les variables dans `generate-missing-translations.js` :

```javascript
const SUPABASE_URL = 'votre_url_supabase';
const SUPABASE_KEY = 'votre_cle_anon_supabase';
const DEEPSEEK_API_KEY = 'sk-db6617f690b04336b0469ffa1c6bf839';
```

### Étape 3 : Exécuter le script

```bash
node generate-missing-translations.js
```

Le script va :
- Récupérer toutes les phrases sans traduction (112 phrases)
- Générer la traduction française pour chacune avec DeepSeek
- Sauvegarder les traductions dans la base de données
- Afficher un résumé avec le nombre de succès/erreurs

**Temps estimé** : ~2-3 minutes (500ms entre chaque requête pour ne pas surcharger l'API)

## Méthode 2 : Via l'application (Manuel)

Si vous préférez générer les traductions au fur et à mesure :

1. Allez dans l'application
2. Ouvrez une leçon avec des phrases sans traduction
3. Les phrases seront automatiquement régénérées avec leur traduction lors de la prochaine utilisation

## Vérification

Après l'exécution du script, vous pouvez vérifier les résultats avec :

```sql
SELECT COUNT(*) as phrases_sans_traduction
FROM nlapp_words
WHERE fill_in_blank_sentence IS NOT NULL 
  AND fill_in_blank_sentence_translation IS NULL;
```

Ce nombre devrait être 0 (ou proche de 0 si certaines phrases ont échoué).

## Notes importantes

- Le script attend 500ms entre chaque requête pour ne pas surcharger l'API DeepSeek
- Les nouvelles phrases générées incluront automatiquement leur traduction
- Si une traduction échoue, le script continue avec les autres phrases
- Vous pouvez relancer le script pour traiter uniquement les phrases qui ont échoué

