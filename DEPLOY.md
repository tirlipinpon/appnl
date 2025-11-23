# Guide de déploiement sur One.com

## Configuration effectuée

L'application a été configurée pour fonctionner dans le dossier `/nlapp/` à la racine de votre serveur FTP.

### Modifications apportées :

1. **`angular.json`** : Ajout de `baseHref: "/nlapp/"` dans la configuration de production
2. **`src/index.html`** : Modification de `<base href="/">` en `<base href="/nlapp/">`
3. **`.htaccess`** : Création d'un fichier pour gérer le routing Angular dans le sous-dossier

## Étapes de déploiement

### 1. Build de l'application

```bash
npm run build
```

Cela créera les fichiers dans le dossier `dist/nlapp/browser/`

### 2. Upload sur le serveur FTP

1. Connectez-vous à votre serveur FTP One.com
2. Naviguez jusqu'à la racine de votre site (généralement `public_html` ou `www`)
3. Créez un dossier `nlapp` s'il n'existe pas déjà
4. Uploadez **TOUS** les fichiers du dossier `dist/nlapp/browser/` dans le dossier `nlapp/`

**Important** : Assurez-vous que le fichier `.htaccess` est bien uploadé dans le dossier `nlapp/`

### 3. Structure finale sur le serveur

```
public_html/
  └── nlapp/
      ├── .htaccess
      ├── index.html
      ├── favicon.ico
      ├── main-*.js
      ├── polyfills-*.js
      ├── styles-*.css
      └── browser/
          └── (tous les fichiers chunk-*.js)
```

### 4. Accès à l'application

Une fois déployé, votre application sera accessible à :
- `https://votre-domaine.com/nlapp/`
- `https://votre-domaine.com/nlapp/dashboard`
- `https://votre-domaine.com/nlapp/login`
- etc.

## Vérifications

1. Vérifiez que le fichier `.htaccess` est bien présent dans le dossier `nlapp/`
2. Testez l'accès à `https://votre-domaine.com/nlapp/`
3. Testez la navigation entre les pages pour vérifier que le routing fonctionne

## Notes importantes

- Le fichier `.htaccess` est essentiel pour le routing Angular. Sans lui, les routes ne fonctionneront pas correctement.
- Si vous rencontrez des problèmes de routing, vérifiez que le module `mod_rewrite` est activé sur votre serveur One.com.
- Les fichiers avec hash (comme `main-R5WG5EKS.js`) sont normaux et nécessaires pour le cache busting.

