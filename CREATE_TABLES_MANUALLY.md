# Guide : Créer les tables manuellement via l'interface Supabase

## Pourquoi cette méthode ?

Les tables créées via l'interface Supabase (Table Editor) sont immédiatement reconnues par PostgREST, contrairement aux tables créées via migration SQL qui ont un problème de cache.

## Instructions étape par étape

### 1. Aller dans Table Editor

1. Ouvrez https://supabase.com/dashboard
2. Sélectionnez votre projet (`zmgfaiprgbawcernymqa`)
3. Cliquez sur **"Table Editor"** dans le menu de gauche

### 2. Supprimer les anciennes tables (si elles existent)

1. Dans Table Editor, cherchez les tables `nlapp_*`
2. Pour chaque table, cliquez sur les 3 points (⋮) à droite
3. Sélectionnez **"Delete table"**
4. Confirmez la suppression

### 3. Créer la table `nlapp_profiles`

1. Cliquez sur **"New table"**
2. **Table name** : `nlapp_profiles`
3. **Description** : (optionnel) "Profils utilisateurs"
4. Cliquez sur **"Add column"** pour chaque colonne :

   | Column name           | Type          | Default value | Is nullable | Is primary | Foreign key      |
   | --------------------- | ------------- | ------------- | ----------- | ---------- | ---------------- |
   | `user_id`             | `uuid`        | -             | ❌ No       | ✅ Yes     | `auth.users(id)` |
   | `progression_globale` | `jsonb`       | `{}`          | ✅ Yes      | ❌ No      | -                |
   | `created_at`          | `timestamptz` | `now()`       | ✅ Yes      | ❌ No      | -                |
   | `updated_at`          | `timestamptz` | `now()`       | ✅ Yes      | ❌ No      | -                |

5. Cliquez sur **"Save"**

### 4. Créer la table `nlapp_lessons`

1. Cliquez sur **"New table"**
2. **Table name** : `nlapp_lessons`
3. **Description** : (optionnel) "Leçons d'apprentissage"
4. Ajoutez les colonnes :

   | Column name   | Type          | Default value       | Is nullable | Is primary |
   | ------------- | ------------- | ------------------- | ----------- | ---------- |
   | `id`          | `uuid`        | `gen_random_uuid()` | ❌ No       | ✅ Yes     |
   | `title`       | `text`        | -                   | ❌ No       | ❌ No      |
   | `description` | `text`        | -                   | ✅ Yes      | ❌ No      |
   | `order_index` | `int4`        | `0`                 | ❌ No       | ❌ No      |
   | `created_at`  | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      |
   | `updated_at`  | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      |

5. Cliquez sur **"Save"**

### 5. Créer la table `nlapp_words`

1. Cliquez sur **"New table"**
2. **Table name** : `nlapp_words`
3. **Description** : (optionnel) "Mots/flashcards"
4. Ajoutez les colonnes :

   | Column name   | Type          | Default value       | Is nullable | Is primary | Foreign key         |
   | ------------- | ------------- | ------------------- | ----------- | ---------- | ------------------- |
   | `id`          | `uuid`        | `gen_random_uuid()` | ❌ No       | ✅ Yes     | -                   |
   | `lesson_id`   | `uuid`        | -                   | ✅ Yes      | ❌ No      | `nlapp_lessons(id)` |
   | `french_text` | `text`        | -                   | ❌ No       | ❌ No      | -                   |
   | `dutch_text`  | `text`        | -                   | ❌ No       | ❌ No      | -                   |
   | `audio_url`   | `text`        | -                   | ✅ Yes      | ❌ No      | -                   |
   | `created_at`  | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      | -                   |
   | `updated_at`  | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      | -                   |

5. Cliquez sur **"Save"**

### 6. Créer la table `nlapp_user_progress`

1. Cliquez sur **"New table"**
2. **Table name** : `nlapp_user_progress`
3. **Description** : (optionnel) "Progression des utilisateurs"
4. Ajoutez les colonnes :

   | Column name        | Type          | Default value       | Is nullable | Is primary | Foreign key       |
   | ------------------ | ------------- | ------------------- | ----------- | ---------- | ----------------- |
   | `id`               | `uuid`        | `gen_random_uuid()` | ❌ No       | ✅ Yes     | -                 |
   | `user_id`          | `uuid`        | -                   | ✅ Yes      | ❌ No      | `auth.users(id)`  |
   | `word_id`          | `uuid`        | -                   | ✅ Yes      | ❌ No      | `nlapp_words(id)` |
   | `times_seen`       | `int4`        | `0`                 | ✅ Yes      | ❌ No      | -                 |
   | `times_correct`    | `int4`        | `0`                 | ✅ Yes      | ❌ No      | -                 |
   | `times_incorrect`  | `int4`        | `0`                 | ✅ Yes      | ❌ No      | -                 |
   | `next_review_date` | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      | -                 |
   | `interval_days`    | `int4`        | `1`                 | ✅ Yes      | ❌ No      | -                 |
   | `ease_factor`      | `numeric`     | `2.5`               | ✅ Yes      | ❌ No      | -                 |
   | `last_reviewed_at` | `timestamptz` | -                   | ✅ Yes      | ❌ No      | -                 |
   | `created_at`       | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      | -                 |
   | `updated_at`       | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      | -                 |

5. Après avoir créé la table, allez dans **"Table Editor"** → `nlapp_user_progress` → **"Indexes"**
6. Cliquez sur **"Add index"**
7. Créez un index unique sur `(user_id, word_id)` :
   - **Index name** : `nlapp_user_progress_user_id_word_id_key`
   - **Columns** : `user_id`, `word_id`
   - **Is unique** : ✅ Yes
8. Cliquez sur **"Save"**

### 7. Créer la table `nlapp_user_lessons`

1. Cliquez sur **"New table"**
2. **Table name** : `nlapp_user_lessons`
3. **Description** : (optionnel) "Leçons complétées par les utilisateurs"
4. Ajoutez les colonnes :

   | Column name    | Type          | Default value       | Is nullable | Is primary | Foreign key         |
   | -------------- | ------------- | ------------------- | ----------- | ---------- | ------------------- |
   | `id`           | `uuid`        | `gen_random_uuid()` | ❌ No       | ✅ Yes     | -                   |
   | `user_id`      | `uuid`        | -                   | ✅ Yes      | ❌ No      | `auth.users(id)`    |
   | `lesson_id`    | `uuid`        | -                   | ✅ Yes      | ❌ No      | `nlapp_lessons(id)` |
   | `completed`    | `bool`        | `false`             | ✅ Yes      | ❌ No      | -                   |
   | `completed_at` | `timestamptz` | -                   | ✅ Yes      | ❌ No      | -                   |
   | `created_at`   | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      | -                   |
   | `updated_at`   | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      | -                   |

5. Créez un index unique sur `(user_id, lesson_id)` comme pour `nlapp_user_progress`
6. Cliquez sur \*\*"Save"`

### 8. Créer la table `nlapp_quiz_attempts`

1. Cliquez sur **"New table"**
2. **Table name** : `nlapp_quiz_attempts`
3. **Description** : (optionnel) "Tentatives de quiz"
4. Ajoutez les colonnes :

   | Column name      | Type          | Default value       | Is nullable | Is primary | Foreign key       |
   | ---------------- | ------------- | ------------------- | ----------- | ---------- | ----------------- |
   | `id`             | `uuid`        | `gen_random_uuid()` | ❌ No       | ✅ Yes     | -                 |
   | `user_id`        | `uuid`        | -                   | ✅ Yes      | ❌ No      | `auth.users(id)`  |
   | `word_id`        | `uuid`        | -                   | ✅ Yes      | ❌ No      | `nlapp_words(id)` |
   | `quiz_type`      | `text`        | -                   | ❌ No       | ❌ No      | -                 |
   | `direction`      | `text`        | -                   | ❌ No       | ❌ No      | -                 |
   | `user_answer`    | `text`        | -                   | ❌ No       | ❌ No      | -                 |
   | `correct_answer` | `text`        | -                   | ❌ No       | ❌ No      | -                 |
   | `is_correct`     | `bool`        | -                   | ❌ No       | ❌ No      | -                 |
   | `created_at`     | `timestamptz` | `now()`             | ✅ Yes      | ❌ No      | -                 |

5. Pour `quiz_type`, ajoutez une contrainte CHECK :
   - Cliquez sur la colonne `quiz_type`
   - Dans "Check constraint", ajoutez : `quiz_type IN ('multiple_choice', 'typing')`
6. Pour `direction`, ajoutez une contrainte CHECK :
   - Cliquez sur la colonne `direction`
   - Dans "Check constraint", ajoutez : `direction IN ('french_to_dutch', 'dutch_to_french')`
7. Cliquez sur **"Save"**

### 9. Configurer RLS (Row Level Security)

Pour chaque table créée :

1. Allez dans **"Table Editor"** → Sélectionnez la table
2. Cliquez sur l'onglet **"Policies"** en haut
3. Cliquez sur **"Enable RLS"** si ce n'est pas déjà fait
4. Cliquez sur **"New Policy"** pour créer les policies suivantes :

#### Pour `nlapp_profiles` :

- **Policy name** : `Users can view own profile`
- **Allowed operation** : `SELECT`
- **Policy definition** : `auth.uid() = user_id`

- **Policy name** : `Users can update own profile`
- **Allowed operation** : `UPDATE`
- **Policy definition** : `auth.uid() = user_id`

#### Pour `nlapp_lessons` :

- **Policy name** : `Anyone can view lessons`
- **Allowed operation** : `SELECT`
- **Policy definition** : `true`

#### Pour `nlapp_words` :

- **Policy name** : `Anyone can view words`
- **Allowed operation** : `SELECT`
- **Policy definition** : `true`

#### Pour `nlapp_user_progress` :

- **Policy name** : `Users can manage own progress`
- **Allowed operation** : `ALL`
- **Policy definition** : `auth.uid() = user_id`

#### Pour `nlapp_user_lessons` :

- **Policy name** : `Users can manage own lessons`
- **Allowed operation** : `ALL`
- **Policy definition** : `auth.uid() = user_id`

#### Pour `nlapp_quiz_attempts` :

- **Policy name** : `Users can create own quiz attempts`
- **Allowed operation** : `INSERT`
- **Policy definition** : `auth.uid() = user_id`

- **Policy name** : `Users can view own quiz attempts`
- **Allowed operation** : `SELECT`
- **Policy definition** : `auth.uid() = user_id`

### 10. Insérer les données de test

1. Allez dans **"SQL Editor"**
2. Exécutez ce script :

```sql
-- Insérer les leçons
INSERT INTO nlapp_lessons (id, title, description, order_index) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Leçon 1: Salutations', 'Apprenez les salutations de base en néerlandais', 1),
  ('00000000-0000-0000-0000-000000000002', 'Leçon 2: Nombres', 'Apprenez les nombres de 1 à 20', 2),
  ('00000000-0000-0000-0000-000000000003', 'Leçon 3: Couleurs', 'Apprenez les couleurs de base', 3);

-- Insérer les mots
INSERT INTO nlapp_words (lesson_id, french_text, dutch_text) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Bonjour', 'Hallo'),
  ('00000000-0000-0000-0000-000000000001', 'Au revoir', 'Tot ziens'),
  ('00000000-0000-0000-0000-000000000001', 'Merci', 'Dank je'),
  ('00000000-0000-0000-0000-000000000002', 'Un', 'Een'),
  ('00000000-0000-0000-0000-000000000002', 'Deux', 'Twee'),
  ('00000000-0000-0000-0000-000000000002', 'Trois', 'Drie'),
  ('00000000-0000-0000-0000-000000000003', 'Rouge', 'Rood'),
  ('00000000-0000-0000-0000-000000000003', 'Bleu', 'Blauw'),
  ('00000000-0000-0000-0000-000000000003', 'Vert', 'Groen');
```

### 11. Tester l'application

1. Attendez 30 secondes (les tables créées via l'interface sont reconnues immédiatement)
2. Ouvrez votre application Angular : http://localhost:4200
3. Ouvrez la console du navigateur (F12 → Console)
4. Connectez-vous ou allez sur le dashboard
5. Vérifiez si les erreurs "relation does not exist" ont disparu

## ✅ Résultat attendu

Si tout fonctionne, vous devriez voir :

- ✅ Les leçons se chargent dans l'application
- ✅ Plus d'erreurs "relation does not exist" dans la console
- ✅ L'application fonctionne normalement

## ❌ Si ça ne fonctionne toujours pas

Si après avoir créé les tables via l'interface Supabase, vous avez toujours les erreurs :

1. Vérifiez que les tables apparaissent bien dans Table Editor
2. Vérifiez que RLS est activé et que les policies sont créées
3. Contactez le support Supabase avec ces informations







