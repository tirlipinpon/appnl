import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Lesson } from '../models/lesson.model';
import { Word } from '../models/word.model';

@Injectable({
  providedIn: 'root'
})
export class LessonService {
  private supabaseService = inject(SupabaseService);

  async getLessons(): Promise<Lesson[]> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_lessons')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getLessonById(id: string): Promise<Lesson | null> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_lessons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getWordsByLesson(lessonId: string, userId?: string): Promise<Word[]> {
    // 1. Récupérer les mots de base de la leçon
    const { data: baseWords, error: baseError } = await this.supabaseService.client
      .from('nlapp_words')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true });

    if (baseError) throw baseError;

    // 2. Si pas d'utilisateur, retourner les mots de base
    if (!userId) {
      return baseWords || [];
    }

    // 3. Récupérer les modifications personnelles
    const { data: userModifications, error: modError } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .select('*')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId);

    if (modError) throw modError;

    // 4. Appliquer les modifications
    let personalizedWords = [...(baseWords || [])];

    if (userModifications && userModifications.length > 0) {
      // Créer des maps pour faciliter les recherches
      const hiddenWordIds = new Set<string>();
      const addedWordIds = new Set<string>();
      const addedWords: Word[] = [];
      const wordEdits = new Map<string, { french_text_override?: string; dutch_text_override?: string }>();

      userModifications.forEach(mod => {
        if (mod.action === 'hide' && mod.word_id) {
          hiddenWordIds.add(mod.word_id);
        } else if (mod.action === 'add') {
          if (mod.word_id) {
            // Mot existant ajouté à cette leçon
            addedWordIds.add(mod.word_id);
            // Chercher le mot dans les mots de base ou dans toutes les leçons
            const word = baseWords?.find(w => w.id === mod.word_id);
            if (word) {
              addedWords.push(word);
            } else {
              // Le mot existe dans une autre leçon, il faut le récupérer
              // On le récupérera plus tard si nécessaire
            }
          }
        } else if (mod.action === 'edit' && mod.word_id) {
          // Stocker les modifications de texte personnelles
          wordEdits.set(mod.word_id, {
            french_text_override: mod.french_text_override,
            dutch_text_override: mod.dutch_text_override
          });
        }
      });

      // Récupérer les mots ajoutés qui ne sont pas dans cette leçon
      const addedWordIdsArray = Array.from(addedWordIds).filter(id => !baseWords?.some(w => w.id === id));
      if (addedWordIdsArray.length > 0) {
        const { data: addedWordsData, error: addedError } = await this.supabaseService.client
          .from('nlapp_words')
          .select('*')
          .in('id', addedWordIdsArray);

        if (!addedError && addedWordsData) {
          addedWords.push(...addedWordsData);
        }
      }

      // Filtrer les mots masqués
      personalizedWords = personalizedWords.filter(w => !hiddenWordIds.has(w.id));

      // Ajouter les mots ajoutés (sans doublons)
      addedWords.forEach(word => {
        if (!personalizedWords.some(w => w.id === word.id)) {
          personalizedWords.push(word);
        }
      });

      // Appliquer les modifications de texte personnelles
      personalizedWords = personalizedWords.map(word => {
        const edit = wordEdits.get(word.id);
        if (edit) {
          return {
            ...word,
            french_text: edit.french_text_override !== undefined ? edit.french_text_override : word.french_text,
            dutch_text: edit.dutch_text_override !== undefined ? edit.dutch_text_override : word.dutch_text
          };
        }
        return word;
      });
    }

    return personalizedWords;
  }

  /**
   * Récupère les modifications personnelles d'un utilisateur pour une leçon
   */
  async getUserLessonModifications(userId: string, lessonId: string) {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_user_lesson_words')
      .select('*')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Normalise un titre pour la comparaison (trim + lowercase)
   */
  private normalizeTitle(title: string): string {
    return title.trim().toLowerCase();
  }

  /**
   * Extrait le titre de base d'un titre numéroté (ex: "(2) Mon titre" -> "Mon titre")
   */
  private extractBaseTitle(title: string): { baseTitle: string; number: number | null } {
    const trimmed = title.trim();
    const numberedMatch = trimmed.match(/^\((\d+)\)\s+(.+)$/);
    if (numberedMatch) {
      return {
        baseTitle: numberedMatch[2].trim(),
        number: parseInt(numberedMatch[1], 10)
      };
    }
    return {
      baseTitle: trimmed,
      number: null
    };
  }

  /**
   * Vérifie si un titre existe et génère un titre unique avec numérotation si nécessaire
   * Prend en compte les majuscules/minuscules et les espaces au début/fin
   */
  async generateUniqueTitle(proposedTitle: string): Promise<{ title: string; isDuplicate: boolean }> {
    // Trim le titre proposé dès le début
    const trimmedProposedTitle = proposedTitle.trim();
    
    // Normaliser le titre proposé
    const normalizedProposed = this.normalizeTitle(trimmedProposedTitle);
    const baseProposedTitle = this.extractBaseTitle(trimmedProposedTitle).baseTitle;
    const normalizedBaseProposed = this.normalizeTitle(baseProposedTitle);

    // Récupérer toutes les leçons pour analyser les titres
    const { data: allLessons, error: allError } = await this.supabaseService.client
      .from('nlapp_lessons')
      .select('title');

    if (allError) throw allError;

    if (!allLessons || allLessons.length === 0) {
      // Aucune leçon existante, on peut utiliser le titre tel quel (avec trim)
      return { title: trimmedProposedTitle, isDuplicate: false };
    }

    // Extraire les numéros existants pour ce titre
    const numbers: number[] = [];
    
    for (const lesson of allLessons) {
      const { baseTitle, number } = this.extractBaseTitle(lesson.title);
      const normalizedBase = this.normalizeTitle(baseTitle);
      
      // Comparer les titres normalisés (sans tenir compte des majuscules/minuscules et espaces)
      if (normalizedBase === normalizedBaseProposed) {
        if (number === null) {
          // Titre exact sans numéro, considérer comme numéro 1
          numbers.push(1);
        } else {
          // Titre numéroté avec le même titre de base
          numbers.push(number);
        }
      }
    }

    // Si aucun titre correspondant n'a été trouvé, on peut utiliser le titre tel quel (avec trim)
    if (numbers.length === 0) {
      return { title: trimmedProposedTitle, isDuplicate: false };
    }

    // Trouver le prochain numéro disponible
    numbers.sort((a, b) => a - b);
    let nextNumber = 1;
    for (const num of numbers) {
      if (num === nextNumber) {
        nextNumber++;
      } else {
        break;
      }
    }

    return { title: `(${nextNumber}) ${trimmedProposedTitle}`, isDuplicate: true };
  }

  /**
   * Échappe les caractères spéciaux pour les expressions régulières
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async createLesson(lesson: Partial<Lesson>): Promise<{ lesson: Lesson; titleWasModified: boolean; originalTitle: string }> {
    if (!lesson.title) {
      throw new Error('Le titre est requis');
    }

    // Trim le titre original
    const trimmedOriginalTitle = lesson.title.trim();
    
    // Générer un titre unique
    const { title: uniqueTitle, isDuplicate } = await this.generateUniqueTitle(trimmedOriginalTitle);
    const originalTitle = trimmedOriginalTitle;
    const titleWasModified = isDuplicate;

    // Créer la leçon avec le titre unique
    const lessonToCreate = { ...lesson, title: uniqueTitle };
    const { data, error } = await this.supabaseService.client
      .from('nlapp_lessons')
      .insert(lessonToCreate)
      .select()
      .single();

    if (error) throw error;
    return { lesson: data, titleWasModified, originalTitle };
  }

  async updateLesson(id: string, lesson: Partial<Lesson>): Promise<Lesson> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_lessons')
      .update(lesson)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

