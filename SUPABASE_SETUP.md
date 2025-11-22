# Guide de configuration Supabase

## Étape 1 : Accéder au SQL Editor

1. Allez sur https://supabase.com/dashboard
2. Connectez-vous à votre compte
3. Sélectionnez votre projet : **zmgfaiprgbawcernymqa**
4. Dans le menu de gauche, cliquez sur **SQL Editor**

## Étape 2 : Exécuter le script de migration

1. Cliquez sur **New Query** (Nouvelle requête)
2. Ouvrez le fichier `supabase-migrations.sql` dans votre éditeur
3. **Copiez TOUT le contenu** du fichier
4. Collez-le dans l'éditeur SQL de Supabase
5. Cliquez sur **Run** (ou appuyez sur Ctrl+Enter)

## Étape 3 : Vérifier que les tables sont créées

1. Dans le menu de gauche, cliquez sur **Table Editor**
2. Vous devriez voir les tables suivantes avec le préfixe `nlapp_` :
   - `nlapp_profiles`
   - `nlapp_lessons`
   - `nlapp_words`
   - `nlapp_user_progress`
   - `nlapp_user_lessons`
   - `nlapp_quiz_attempts`

## Étape 4 : Vérifier les données de démonstration

1. Dans **Table Editor**, ouvrez la table `nlapp_lessons`
2. Vous devriez voir 3 leçons :
   - Leçon 1: Salutations
   - Leçon 2: Nombres
   - Leçon 3: Couleurs

3. Ouvrez la table `nlapp_words`
4. Vous devriez voir 26 mots répartis dans les 3 leçons

## Si vous rencontrez des erreurs

### Erreur : "relation already exists"
- Les tables existent déjà, c'est normal si vous avez déjà exécuté le script
- Vous pouvez ignorer cette erreur ou supprimer les tables existantes d'abord

### Erreur : "permission denied"
- Assurez-vous d'être connecté avec un compte ayant les droits administrateur
- Vérifiez que vous êtes bien dans le bon projet

### Erreur : "function already exists"
- La fonction `update_updated_at_column()` existe déjà
- C'est normal, vous pouvez ignorer cette erreur

## Alternative : Exécuter le script par parties

Si le script complet ne fonctionne pas, vous pouvez l'exécuter en plusieurs parties :

1. **Partie 1** : Créer les tables (lignes 4-73)
2. **Partie 2** : Créer les index (lignes 75-83)
3. **Partie 3** : Créer les fonctions et triggers (lignes 85-108)
4. **Partie 4** : Configurer RLS (lignes 110-176)
5. **Partie 5** : Insérer les données (lignes 183-222)

## Vérification finale

Après avoir exécuté le script, testez l'application :

1. Lancez `ng serve`
2. Allez sur http://localhost:4200/register
3. Créez un compte
4. Connectez-vous et vérifiez que le dashboard charge les leçons

