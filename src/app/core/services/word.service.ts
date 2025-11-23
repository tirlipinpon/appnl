import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Word } from '../models/word.model';

@Injectable({
  providedIn: 'root'
})
export class WordService {
  private supabaseService = inject(SupabaseService);

  async getAllWords(): Promise<Word[]> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_words')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getWordById(id: string): Promise<Word | null> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_words')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async createWord(word: Partial<Word>): Promise<Word> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_words')
      .insert(word)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateWord(id: string, word: Partial<Word>): Promise<Word> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_words')
      .update(word)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteWord(id: string): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('nlapp_words')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getRandomWords(count: number, excludeWordIds: string[] = []): Promise<Word[]> {
    let query = this.supabaseService.client
      .from('nlapp_words')
      .select('*');

    if (excludeWordIds.length > 0) {
      query = query.not('id', 'in', `(${excludeWordIds.join(',')})`);
    }

    const { data, error } = await query.limit(count);

    if (error) throw error;
    
    // Mélanger et retourner le nombre demandé
    const shuffled = this.shuffleArray(data || []);
    return shuffled.slice(0, count);
  }

  /**
   * Calcule la similarité entre deux mots (basée sur la longueur et les lettres communes)
   */
  private calculateSimilarity(word1: string, word2: string): number {
    const len1 = word1.length;
    const len2 = word2.length;
    
    // Pénalité pour la différence de longueur (max 3 lettres de différence tolérées)
    const lengthDiff = Math.abs(len1 - len2);
    if (lengthDiff > 3) return 0;
    const lengthScore = 1 - (lengthDiff / 3);
    
    // Score basé sur les lettres communes
    const letters1 = new Set(word1.toLowerCase().split(''));
    const letters2 = new Set(word2.toLowerCase().split(''));
    const commonLetters = [...letters1].filter(l => letters2.has(l));
    const letterScore = commonLetters.length / Math.max(letters1.size, letters2.size);
    
    // Score combiné (60% longueur, 40% lettres communes)
    return (lengthScore * 0.6) + (letterScore * 0.4);
  }

  /**
   * Trouve des mots similaires à un mot donné dans la DB
   * Sélectionne des mots existants qui ressemblent au mot cible
   */
  async getSimilarWords(
    targetWord: string, 
    count: number, 
    excludeWordIds: string[] = [],
    direction: 'french_to_dutch' | 'dutch_to_french' = 'french_to_dutch'
  ): Promise<Word[]> {
    // Récupérer tous les mots disponibles de la DB
    const { data, error } = await this.supabaseService.client
      .from('nlapp_words')
      .select('*');
    
    if (error) throw error;
    if (!data || data.length === 0) return [];
    
    // Filtrer les mots exclus et calculer la similarité avec chaque mot de la DB
    const candidates = data
      .filter(w => !excludeWordIds.includes(w.id))
      .map(w => {
        const wordToCompare = direction === 'french_to_dutch' ? w.dutch_text : w.french_text;
        return {
          word: w,
          similarity: this.calculateSimilarity(targetWord, wordToCompare)
        };
      })
      .filter(item => item.similarity > 0) // Exclure les mots trop différents
      .sort((a, b) => b.similarity - a.similarity) // Trier par similarité décroissante
      .slice(0, count * 2) // Prendre plus de candidats pour avoir du choix
      .map(item => item.word);
    
    // Mélanger et retourner le nombre demandé
    const shuffled = this.shuffleArray(candidates);
    return shuffled.slice(0, count);
  }

  /**
   * Mélange un tableau de manière aléatoire (algorithme Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

