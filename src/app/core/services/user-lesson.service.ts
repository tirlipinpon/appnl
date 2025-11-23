import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Word } from '../models/word.model';
import { UserLessonWord } from '../models/user-lesson-word.model';

@Injectable({
  providedIn: 'root'
})
export class UserLessonService {
  private supabaseService = inject(SupabaseService);

  /**
   * Masque un mot dans une leçon pour un utilisateur
   */
  async hideWord(userId: string, lessonId: string, wordId: string): Promise<void> {
    // D'abord, supprimer toute modification existante pour ce mot (edit, add) pour éviter les conflits
    await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .delete()
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .eq('word_id', wordId)
      .neq('action', 'hide'); // Ne pas supprimer les hide existants

    // Ensuite, insérer ou mettre à jour l'action 'hide'
    const { error } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        word_id: wordId,
        action: 'hide'
      }, {
        onConflict: 'user_id,lesson_id,word_id,action'
      });

    if (error) {
      console.error('Erreur lors du masquage du mot:', error);
      throw error;
    }
  }

  /**
   * Réactive un mot masqué dans une leçon pour un utilisateur
   */
  async unhideWord(userId: string, lessonId: string, wordId: string): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .delete()
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .eq('word_id', wordId)
      .eq('action', 'hide');

    if (error) throw error;
  }

  /**
   * Ajoute un mot existant à une leçon pour un utilisateur
   */
  async addWordToLesson(userId: string, lessonId: string, wordId: string): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        word_id: wordId,
        action: 'add'
      }, {
        onConflict: 'user_id,lesson_id,word_id,action'
      });

    if (error) throw error;
  }

  /**
   * Crée un nouveau mot dans la table globale et l'ajoute à la leçon personnelle de l'utilisateur
   */
  async addNewWordToLesson(userId: string, lessonId: string, word: Partial<Word>): Promise<Word> {
    // 1. Créer le mot dans la table globale
    const { data: newWord, error: createError } = await this.supabaseService.client
      .from('nlapp_words')
      .insert({
        lesson_id: lessonId, // Le mot est créé dans la leçon de base
        french_text: word.french_text,
        dutch_text: word.dutch_text,
        audio_url: word.audio_url
      })
      .select()
      .single();

    if (createError) throw createError;

    // 2. Ajouter une modification personnelle pour indiquer que ce mot est ajouté à cette leçon
    // (même si le mot est déjà dans la leçon de base, cela permet de le marquer comme ajouté par l'utilisateur)
    await this.addWordToLesson(userId, lessonId, newWord.id);

    return newWord;
  }

  /**
   * Édite un mot de manière personnelle (modifie le texte français/néerlandais pour cet utilisateur uniquement)
   */
  async editWord(userId: string, lessonId: string, wordId: string, frenchText?: string, dutchText?: string): Promise<void> {
    const updateData: any = {
      user_id: userId,
      lesson_id: lessonId,
      word_id: wordId,
      action: 'edit'
    };

    if (frenchText !== undefined) {
      updateData.french_text_override = frenchText;
    }
    if (dutchText !== undefined) {
      updateData.dutch_text_override = dutchText;
    }

    const { error } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .upsert(updateData, {
        onConflict: 'user_id,lesson_id,word_id,action'
      });

    if (error) throw error;
  }

  /**
   * Supprime une modification personnelle (masquer, ajouter ou éditer)
   */
  async removeModification(userId: string, lessonId: string, wordId: string, action: 'hide' | 'add' | 'edit'): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .delete()
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .eq('word_id', wordId)
      .eq('action', action);

    if (error) throw error;
  }

  /**
   * Récupère les modifications d'édition pour un mot dans une leçon
   */
  async getWordEdit(userId: string, lessonId: string, wordId: string): Promise<{ french_text_override?: string; dutch_text_override?: string } | null> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .select('french_text_override, dutch_text_override')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .eq('word_id', wordId)
      .eq('action', 'edit')
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  /**
   * Vérifie si un mot est masqué pour un utilisateur dans une leçon
   */
  async isWordHidden(userId: string, lessonId: string, wordId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .select('id')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .eq('word_id', wordId)
      .eq('action', 'hide')
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  /**
   * Récupère tous les mots masqués pour un utilisateur dans une leçon
   */
  async getHiddenWords(userId: string, lessonId: string): Promise<string[]> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .select('word_id')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .eq('action', 'hide');

    if (error) throw error;
    return (data || []).map(item => item.word_id).filter((id): id is string => !!id);
  }
}

