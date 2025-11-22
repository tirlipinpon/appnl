# Application d'apprentissage du néerlandais

Application web Angular pour apprendre le néerlandais depuis le français avec flashcards, quiz interactifs, pratique d'écriture et système de répétition espacée.

## Fonctionnalités

- **Authentification** : Inscription, connexion et réinitialisation de mot de passe via Supabase Auth
- **Dashboard** : Vue d'ensemble de la progression, statistiques et mots à revoir
- **Leçons** : Système de leçons organisées avec flashcards, quiz et pratique d'écriture
- **Flashcards** : Apprentissage visuel avec flip français/néerlandais et prononciation audio
- **Quiz à choix multiples** : Test de mémorisation avec 4 choix et feedback immédiat
- **Pratique d'écriture** : Mode écriture avec validation caractère par caractère
- **Répétition espacée** : Algorithme SM-2 pour optimiser la mémorisation
- **Administration** : Page admin pour ajouter/modifier/supprimer des mots et leçons

## Prérequis

- Node.js 18+ et npm
- Compte Supabase avec projet créé
- Angular CLI 20+

## Installation

1. Installer les dépendances :
```bash
npm install
```

2. Configurer Supabase :
   - Créer un projet sur [Supabase](https://supabase.com)
   - Exécuter le script SQL `supabase-migrations.sql` dans l'éditeur SQL de Supabase
   - Copier l'URL du projet et la clé anonyme

3. Configurer l'environnement :
   - **Récupérer votre clé API Supabase** :
     - Allez sur https://supabase.com/dashboard
     - Sélectionnez votre projet
     - Allez dans **Settings → API**
     - Copiez la clé **"anon public"** (elle commence par `eyJ...` - c'est un JWT)
   
   - Modifier `src/environments/environment.ts` avec vos credentials Supabase :
   ```typescript
   export const environment = {
     production: false,
     supabase: {
       url: 'https://zmgfaiprgbawcernymqa.supabase.co',
       anonKey: 'VOTRE_CLE_ANON_KEY_ICI' // ⚠️ Doit commencer par eyJ...
     }
   };
   ```
   
   ⚠️ **Important** : La clé anon_key doit être un JWT qui commence par `eyJ...`. Si votre clé ne commence pas par `eyJ`, ce n'est pas la bonne clé.

## Démarrage

```bash
ng serve
```

L'application sera accessible sur `http://localhost:4200`

## Structure du projet

```
src/
├── app/
│   ├── core/
│   │   ├── auth/          # Guards d'authentification
│   │   ├── models/         # Interfaces TypeScript
│   │   └── services/       # Services (Supabase, Auth, Progress, etc.)
│   ├── features/
│   │   ├── auth/           # Composants d'authentification
│   │   ├── dashboard/      # Tableau de bord
│   │   ├── lessons/        # Composants de leçons
│   │   └── admin/          # Administration
│   └── shared/             # Composants partagés
└── environments/           # Configuration
```

## Base de données

Les tables suivantes sont créées avec le préfixe `nlapp_` :

- `nlapp_profiles` : Profils utilisateurs
- `nlapp_lessons` : Leçons
- `nlapp_words` : Mots/flashcards
- `nlapp_user_progress` : Progression des utilisateurs
- `nlapp_user_lessons` : Leçons complétées
- `nlapp_quiz_attempts` : Tentatives de quiz

## Utilisation

1. **Inscription** : Créer un compte avec email et mot de passe
2. **Dashboard** : Consulter la progression et les mots à revoir
3. **Leçons** : Sélectionner une leçon pour commencer
4. **Flashcards** : Visualiser les mots français/néerlandais
5. **Quiz** : Répondre aux questions à choix multiples
6. **Écriture** : Pratiquer l'écriture des mots
7. **Révisions** : Les mots mal répondus sont ajoutés à la pile de révision

## Administration

Accéder à `/admin/words` pour gérer les mots et leçons (nécessite des permissions admin dans Supabase).

## Technologies utilisées

- Angular 20+
- TypeScript
- Supabase (Auth, Database)
- Web Speech API (prononciation audio)
- RxJS

## Notes

- L'audio utilise la Web Speech API du navigateur (gratuit mais qualité variable selon le navigateur)
- La répétition espacée utilise un algorithme SM-2 simplifié
- Les leçons sont marquées complètes si le taux de réussite est ≥ 70%
