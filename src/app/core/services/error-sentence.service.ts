import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ErrorSentence } from '../models/error-sentence.model';
import { DeepSeekService } from './deepseek.service';

@Injectable({
  providedIn: 'root'
})
export class ErrorSentenceService {
  private supabaseService = inject(SupabaseService);
  private deepSeekService = inject(DeepSeekService);

  /**
   * Récupère toutes les phrases avec erreurs pour une leçon donnée
   */
  async getErrorSentencesByLesson(
    lessonId: string,
    direction?: 'french_to_dutch' | 'dutch_to_french'
  ): Promise<ErrorSentence[]> {
    let query = this.supabaseService.client
      .from('nlapp_error_sentences')
      .select('*')
      .eq('lesson_id', lessonId);

    if (direction) {
      query = query.eq('direction', direction);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupère toutes les phrases avec erreurs pour un mot donné
   */
  async getErrorSentencesByWord(
    wordId: string,
    direction?: 'french_to_dutch' | 'dutch_to_french'
  ): Promise<ErrorSentence[]> {
    let query = this.supabaseService.client
      .from('nlapp_error_sentences')
      .select('*')
      .eq('word_id', wordId);

    if (direction) {
      query = query.eq('direction', direction);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupère toutes les phrases avec erreurs pour les mots d'une leçon
   * Utile pour charger toutes les phrases nécessaires pour une leçon complète
   */
  async getErrorSentencesForLessonWords(
    wordIds: string[],
    direction: 'french_to_dutch' | 'dutch_to_french'
  ): Promise<ErrorSentence[]> {
    if (wordIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseService.client
      .from('nlapp_error_sentences')
      .select('*')
      .in('word_id', wordIds)
      .eq('direction', direction)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupère une phrase avec erreur par son ID
   */
  async getErrorSentenceById(id: string): Promise<ErrorSentence | null> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_error_sentences')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Crée une nouvelle phrase avec erreur
   */
  async createErrorSentence(errorSentence: Partial<ErrorSentence>): Promise<ErrorSentence> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_error_sentences')
      .insert({
        ...errorSentence,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Met à jour une phrase avec erreur existante
   */
  async updateErrorSentence(
    id: string,
    updates: Partial<ErrorSentence>
  ): Promise<ErrorSentence> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_error_sentences')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Supprime une phrase avec erreur
   */
  async deleteErrorSentence(id: string): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('nlapp_error_sentences')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Génère automatiquement une phrase avec erreur en utilisant DeepSeek
   */
  async generateErrorSentence(
    wordId: string,
    word: string,
    direction: 'french_to_dutch' | 'dutch_to_french',
    lessonId?: string,
    errorType?: string,
    frenchTranslation?: string
  ): Promise<ErrorSentence> {
    try {
      const generated = await this.deepSeekService.generateErrorSentence(
        word,
        direction,
        errorType,
        frenchTranslation
      );

      // Créer la phrase avec erreur dans la base de données
      const errorSentence: Partial<ErrorSentence> = {
        word_id: wordId,
        lesson_id: lessonId,
        sentence_with_error: generated.sentence_with_error,
        sentence_correct: generated.sentence_correct,
        error_type: errorType || generated.error_type,
        direction: direction,
        explanation: generated.explanation
      };

      return await this.createErrorSentence(errorSentence);
    } catch (error) {
      console.error('Error generating error sentence:', error);
      throw error;
    }
  }

  /**
   * Récupère toutes les phrases avec erreurs (pour l'admin)
   */
  async getAllErrorSentences(): Promise<ErrorSentence[]> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_error_sentences')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

