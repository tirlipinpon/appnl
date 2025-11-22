// Exemple de configuration - Remplacez par vos vraies valeurs
// Pour obtenir votre clé API :
// 1. Allez sur https://supabase.com/dashboard
// 2. Sélectionnez votre projet
// 3. Allez dans Settings → API
// 4. Copiez la clé "anon public" (commence par eyJ...)

export const environment = {
  production: false,
  supabase: {
    url: 'https://zmgfaiprgbawcernymqa.supabase.co',
    // ⚠️ REMPLACEZ cette clé par votre vraie clé anon_key depuis le dashboard Supabase
    // La clé doit commencer par "eyJ..." (c'est un JWT)
    anonKey: 'VOTRE_CLE_ANON_KEY_ICI'
  }
};

