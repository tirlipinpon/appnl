import { Injectable } from '@angular/core';

export type Language = 'nl' | 'fr';

interface CacheEntry {
  translation: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
  private readonly GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures
  private readonly MAX_CACHE_SIZE = 1000;
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, Promise<string>> = new Map();

  /**
   * Traduit un texte d'une langue vers une autre
   * @param text Le texte à traduire
   * @param from Langue source
   * @param to Langue cible
   * @returns La traduction
   */
  async translate(text: string, from: Language, to: Language): Promise<string> {
    const normalizedText = text.trim();
    
    if (!normalizedText || normalizedText.length < 2) {
      return normalizedText;
    }

    const cacheKey = this.getCacheKey(normalizedText, from, to);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return cached.translation;
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const translationPromise = this.fetchTranslation(normalizedText, from, to);
    this.pendingRequests.set(cacheKey, translationPromise);

    try {
      const translation = await translationPromise;
      
      if (translation !== normalizedText) {
        this.storeInCache(cacheKey, translation);
      }
      
      return translation;
    } catch (error: any) {
      console.error('[TranslationService] Erreur lors de la traduction:', error);
      throw error;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Récupère la traduction avec gestion de la longueur du texte
   */
  private async fetchTranslation(text: string, from: Language, to: Language): Promise<string> {
    const maxLength = 100;
    
    if (text.length > maxLength) {
      const words = text.split(/\s+/);
      let textToTranslate = '';
      
      for (const word of words) {
        if ((textToTranslate + ' ' + word).length <= maxLength) {
          textToTranslate += (textToTranslate ? ' ' : '') + word;
        } else {
          break;
        }
      }
      
      if (!textToTranslate) {
        textToTranslate = text.substring(0, maxLength).trim();
      }
      
      if (textToTranslate.length < text.length) {
        console.warn(`[TranslationService] Texte tronqué de ${text.length} à ${textToTranslate.length} caractères`);
      }
      
      return this.translateWithFallback(textToTranslate, from, to);
    }
    
    return this.translateWithFallback(text, from, to);
  }

  /**
   * Essaie MyMemory d'abord, puis Google Translate en fallback
   */
  private async translateWithFallback(text: string, from: Language, to: Language): Promise<string> {
    try {
      // Essayer MyMemory d'abord (gratuit, légal, fiable)
      return await this.translateWithMyMemory(text, from, to);
    } catch (error) {
      console.warn('[TranslationService] MyMemory a échoué, tentative avec Google Translate:', error);
      // Fallback sur Google Translate (non officiel mais fonctionne)
      try {
        return await this.translateWithGoogle(text, from, to);
      } catch (googleError) {
        throw new Error('Impossible de traduire. Les deux services sont indisponibles.');
      }
    }
  }

  /**
   * Traduction via MyMemory API (gratuit, 10k caractères/jour, pas de clé API requise)
   */
  private async translateWithMyMemory(text: string, from: Language, to: Language): Promise<string> {
    const langPair = `${from}|${to}`;
    const url = `${this.MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MyMemory API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return data.responseData.translatedText;
      } else {
        const errorMsg = data.responseData?.error || 'Erreur MyMemory inconnue';
        throw new Error(`MyMemory: ${errorMsg}`);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout MyMemory: La requête a pris trop de temps.');
      }
      throw error;
    }
  }

  /**
   * Traduction via Google Translate (non officiel, fallback)
   */
  private async translateWithGoogle(text: string, from: Language, to: Language): Promise<string> {
    // Mapper les codes de langue pour Google
    const googleFrom = from === 'nl' ? 'nl' : 'fr';
    const googleTo = to === 'nl' ? 'nl' : 'fr';
    
    const url = `${this.GOOGLE_TRANSLATE_URL}?client=gtx&sl=${googleFrom}&tl=${googleTo}&dt=t&q=${encodeURIComponent(text)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Google Translate error: ${response.status}`);
      }

      const data = await response.json();
      
      // Google Translate retourne un tableau complexe: [[["traduction", "original", null, null, 0]], ...]
      if (Array.isArray(data) && data[0] && Array.isArray(data[0])) {
        const translatedText = data[0]
          .map((item: any[]) => item && item[0] ? item[0] : '')
          .join('')
          .trim();
        
        if (translatedText) {
          return translatedText;
        }
      }
      
      throw new Error('Format de réponse Google Translate invalide');
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout Google Translate: La requête a pris trop de temps.');
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erreur réseau: Impossible de contacter Google Translate.');
      }
      throw error;
    }
  }

  /**
   * Génère une clé de cache unique
   */
  private getCacheKey(text: string, from: Language, to: Language): string {
    return `${from}_${to}_${text.toLowerCase()}`;
  }

  /**
   * Vérifie si une entrée de cache est valide
   */
  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_DURATION;
  }

  /**
   * Stocke une traduction dans le cache
   */
  private storeInCache(key: string, translation: string): void {
    // Nettoyer le cache si nécessaire (LRU simple)
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = Math.floor(this.MAX_CACHE_SIZE * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(key, {
      translation,
      timestamp: Date.now()
    });
  }

  /**
   * Vide le cache (utile pour les tests ou si nécessaire)
   */
  clearCache(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Obtient la taille actuelle du cache
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
