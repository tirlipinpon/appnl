# Guide de dépannage

## Problème : "relation does not exist" dans l'API REST

### Cause
PostgREST (l'API REST de Supabase) n'a pas encore rechargé le schéma après la création des tables. C'est un problème temporaire.

### Solutions

#### Solution 1 : Attendre (Recommandé)
PostgREST se recharge automatiquement toutes les 1-2 minutes. Attendez simplement.

#### Solution 2 : Redémarrer le projet Supabase
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Settings** → **General**
4. Cliquez sur **Restart project**
5. Attendez 1-2 minutes

#### Solution 3 : Tester l'application Angular
L'application Angular utilise le client Supabase JavaScript qui peut fonctionner même si l'API REST directe échoue :

```bash
cd nlapp
ng serve
```

Puis allez sur http://localhost:4200 et testez l'application. Elle devrait fonctionner correctement.

### Vérification

Pour vérifier que les tables existent bien :
1. Allez dans le dashboard Supabase
2. **Table Editor**
3. Vous devriez voir les tables `nlapp_*`

### Note importante

- **Localhost n'est PAS le problème** - L'application Angular communique avec Supabase via Internet
- Les tables existent bien dans la base de données
- Les permissions sont correctes
- C'est juste PostgREST qui doit se recharger

