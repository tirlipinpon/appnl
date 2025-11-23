import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { LessonService } from './lesson.service';
import { UserProgress, UserLesson, QuizAttempt, QuizType, QuizDirection } from '../models/progress.model';
import { Word } from '../models/word.model';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  private supabaseService = inject(SupabaseService);
  private lessonService = inject(LessonService);
  
  // Subject pour notifier les changements de progression
  private progressUpdated$ = new Subject<{ userId: string; wordId: string }>();
  public onProgressUpdated$ = this.progressUpdated$.asObservable();

  // Algorithme SM-2 simplifié pour répétition espacée
  private calculateNextReview(progress: UserProgress | null, isCorrect: boolean): {
    nextReviewDate: Date;
    intervalDays: number;
    easeFactor: number;
  } {
    const now = new Date();
    let intervalDays = 1;
    let easeFactor = 2.5;
    const MAX_INTERVAL_DAYS = 10; // Limite maximale à 10 jours

    if (progress) {
      easeFactor = progress.ease_factor;
      intervalDays = progress.interval_days;
    }

    if (isCorrect) {
      // Augmenter l'intervalle progressivement mais limiter à 10 jours max
      if (intervalDays === 1) {
        intervalDays = 2; // Réduit de 3 à 2 jours
      } else if (intervalDays === 2) {
        intervalDays = 5; // Réduit de 7 à 5 jours
      } else if (intervalDays === 5) {
        intervalDays = 10; // Limite à 10 jours maximum
      } else {
        // Ne pas augmenter au-delà de 10 jours
        intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.round(intervalDays * 1.2));
      }
      // Réduire l'augmentation du facteur de facilité
      easeFactor = Math.max(1.3, Math.min(2.5, easeFactor + 0.05)); // Limité à 2.5 max
    } else {
      // Réinitialiser l'intervalle en cas d'erreur
      intervalDays = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    }

    // S'assurer que l'intervalle ne dépasse jamais 10 jours
    intervalDays = Math.min(MAX_INTERVAL_DAYS, intervalDays);

    const nextReviewDate = new Date(now);
    nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

    return { nextReviewDate, intervalDays, easeFactor };
  }

  async getUserProgress(userId: string, wordId: string): Promise<UserProgress | null> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_user_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('word_id', wordId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updateProgress(
    userId: string,
    wordId: string,
    isCorrect: boolean
  ): Promise<UserProgress> {
    const existingProgress = await this.getUserProgress(userId, wordId);
    const { nextReviewDate, intervalDays, easeFactor } = this.calculateNextReview(
      existingProgress,
      isCorrect
    );

    const updateData: Partial<UserProgress> = {
      times_seen: (existingProgress?.times_seen || 0) + 1,
      times_correct: isCorrect
        ? (existingProgress?.times_correct || 0) + 1
        : (existingProgress?.times_correct || 0),
      times_incorrect: !isCorrect
        ? (existingProgress?.times_incorrect || 0) + 1
        : (existingProgress?.times_incorrect || 0),
      next_review_date: nextReviewDate.toISOString(),
      interval_days: intervalDays,
      ease_factor: easeFactor,
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingProgress) {
      const { data, error } = await this.supabaseService.client
        .schema('public')
        .from('nlapp_user_progress')
        .update(updateData)
        .eq('id', existingProgress.id)
        .select()
        .single();

      if (error) throw error;
      
      // Notifier que la progression a été mise à jour
      this.progressUpdated$.next({ userId, wordId });
      
      return data;
    } else {
      const { data, error } = await this.supabaseService.client
        .schema('public')
        .from('nlapp_user_progress')
        .insert({
          user_id: userId,
          word_id: wordId,
          ...updateData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      // Notifier que la progression a été mise à jour
      this.progressUpdated$.next({ userId, wordId });
      
      return data;
    }
  }

  async recordQuizAttempt(
    userId: string,
    wordId: string,
    quizType: QuizType,
    direction: QuizDirection,
    userAnswer: string,
    correctAnswer: string,
    isCorrect: boolean
  ): Promise<QuizAttempt> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_quiz_attempts')
      .insert({
        user_id: userId,
        word_id: wordId,
        quiz_type: quizType,
        direction: direction,
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        is_correct: isCorrect,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour la progression
    await this.updateProgress(userId, wordId, isCorrect);

    return data;
  }

  async getExistingSentences(wordId: string, userId?: string): Promise<string[]> {
    try {
      let query = this.supabaseService.client
        .from('nlapp_quiz_attempts')
        .select('user_answer')
        .eq('word_id', wordId)
        .eq('quiz_type', 'fill_in_blank')
        .order('created_at', { ascending: false })
        .limit(10);

      // Si userId fourni, récupérer seulement pour cet utilisateur
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching existing sentences:', error);
        return [];
      }

      // Extraire les phrases uniques (on peut utiliser user_answer comme proxy pour les phrases)
      // Note: On devrait idéalement stocker la phrase dans la DB, mais pour l'instant on récupère les tentatives
      return [];
    } catch (error) {
      console.error('Error in getExistingSentences:', error);
      return [];
    }
  }

  async getWordsToReview(userId: string): Promise<Word[]> {
    const now = new Date().toISOString();
    const { data: progressData, error: progressError } = await this.supabaseService.client
      .from('nlapp_user_progress')
      .select('word_id')
      .eq('user_id', userId)
      .lte('next_review_date', now)
      .order('next_review_date', { ascending: true });

    if (progressError) throw progressError;
    
    if (!progressData || progressData.length === 0) {
      return [];
    }

    const wordIds = progressData.map((p: any) => p.word_id);
    const { data: wordsData, error: wordsError } = await this.supabaseService.client
      .from('nlapp_words')
      .select('*')
      .in('id', wordIds);

    if (wordsError) throw wordsError;
    return wordsData || [];
  }

  /**
   * Filtre les mots d'une leçon pour ne garder que ceux qui nécessitent une révision
   * Retourne :
   * - Les mots jamais vus
   * - Les mots avec next_review_date <= aujourd'hui (date de révision arrivée)
   * 
   * Les mots avec next_review_date dans le futur sont exclus car ils sont maîtrisés
   * et ne doivent pas être révisés avant leur date de révision.
   */
  async filterWordsNeedingReview(userId: string, lessonWords: Word[]): Promise<Word[]> {
    if (lessonWords.length === 0) {
      return [];
    }

    const wordIds = lessonWords.map(w => w.id);
    const now = new Date().toISOString();

    // Récupérer la progression pour tous les mots de la leçon
    const { data: progressData, error: progressError } = await this.supabaseService.client
      .from('nlapp_user_progress')
      .select('word_id, next_review_date')
      .eq('user_id', userId)
      .in('word_id', wordIds);

    if (progressError) {
      console.error('Error fetching progress for lesson words:', progressError);
      // En cas d'erreur, retourner tous les mots pour ne pas bloquer l'utilisateur
      return lessonWords;
    }

    const progressMap = new Map<string, any>();
    if (progressData) {
      progressData.forEach((p: any) => {
        progressMap.set(p.word_id, p);
      });
    }

    // Filtrer les mots qui nécessitent une révision
    const wordsToReview = lessonWords.filter(word => {
      const progress = progressMap.get(word.id);

      // Si le mot n'a jamais été vu, il faut le réviser
      if (!progress) {
        return true;
      }

      // Si next_review_date est null, inclure le mot (cas de sécurité)
      if (!progress.next_review_date) {
        return true;
      }

      // Convertir les dates en objets Date pour comparaison précise
      const reviewDate = new Date(progress.next_review_date);
      const nowDate = new Date(now);

      // Si la date de révision est dans le futur, le mot est maîtrisé et ne doit PAS être inclus
      // Même si vous refaites la leçon plusieurs fois, le mot ne réapparaîtra pas avant sa date
      if (reviewDate > nowDate) {
        return false;
      }

      // Si la date de révision est aujourd'hui ou dans le passé, il faut le réviser
      return true;
    });

    return wordsToReview;
  }

  async getUserLessons(userId: string): Promise<UserLesson[]> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_user_lessons')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Désactive une leçon pour un utilisateur spécifique
   * Si l'enregistrement n'existe pas, il est créé avec disabled = true
   */
  async disableLesson(userId: string, lessonId: string): Promise<UserLesson> {
    const existing = await this.supabaseService.client
      .from('nlapp_user_lessons')
      .select('*')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (existing.error && existing.error.code !== 'PGRST116') {
      throw existing.error;
    }

    if (existing.data) {
      // Mettre à jour l'enregistrement existant
      const { data, error } = await this.supabaseService.client
        .from('nlapp_user_lessons')
        .update({
          disabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.data.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Créer un nouvel enregistrement avec disabled = true
      const { data, error } = await this.supabaseService.client
        .from('nlapp_user_lessons')
        .insert({
          user_id: userId,
          lesson_id: lessonId,
          disabled: true,
          completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  /**
   * Réactive une leçon pour un utilisateur spécifique
   */
  async enableLesson(userId: string, lessonId: string): Promise<UserLesson> {
    const existing = await this.supabaseService.client
      .from('nlapp_user_lessons')
      .select('*')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (existing.error && existing.error.code !== 'PGRST116') {
      throw existing.error;
    }

    if (existing.data) {
      // Mettre à jour l'enregistrement existant
      const { data, error } = await this.supabaseService.client
        .from('nlapp_user_lessons')
        .update({
          disabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.data.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Si l'enregistrement n'existe pas, créer un nouvel enregistrement avec disabled = false
      const { data, error } = await this.supabaseService.client
        .from('nlapp_user_lessons')
        .insert({
          user_id: userId,
          lesson_id: lessonId,
          disabled: false,
          completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  /**
   * Vérifie si une leçon est désactivée pour un utilisateur
   */
  async isLessonDisabled(userId: string, lessonId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_user_lessons')
      .select('disabled')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Si l'enregistrement n'existe pas, la leçon n'est pas désactivée
    return data?.disabled === true;
  }

  /**
   * Obtient les statistiques d'une leçon pour un utilisateur
   * Retourne : total de mots, mots maîtrisés, mots restants, pourcentage de réussite
   */
  async getLessonStats(userId: string, lessonId: string): Promise<{
    totalWords: number;
    masteredWords: number;
    remainingWords: number;
    successRate: number;
  }> {
    // Utiliser LessonService pour obtenir les mots personnalisés (avec masquage et ajouts appliqués)
    // Cela inclut les mots de base (non masqués) + les mots ajoutés (non masqués)
    const personalizedWords = await this.lessonService.getWordsByLesson(lessonId, userId);
    
    const totalWords = personalizedWords.length;
    if (totalWords === 0) {
      return { totalWords: 0, masteredWords: 0, remainingWords: 0, successRate: 0 };
    }

    const wordIds = personalizedWords.map(w => w.id);
    const now = new Date().toISOString();

    // Récupérer la progression pour tous les mots personnalisés (base + ajoutés, non masqués)
    const { data: progressData, error: progressError } = await this.supabaseService.client
      .from('nlapp_user_progress')
      .select('word_id, next_review_date')
      .eq('user_id', userId)
      .in('word_id', wordIds);

    if (progressError) {
      console.error('Error fetching progress for lesson:', progressError);
      return { totalWords, masteredWords: 0, remainingWords: totalWords, successRate: 0 };
    }

    // Compter les mots maîtrisés (next_review_date dans au moins 2 jours)
    let masteredWords = 0;
    if (progressData) {
      const nowDate = new Date(now);
      const twoDaysFromNow = new Date(nowDate);
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
      twoDaysFromNow.setHours(0, 0, 0, 0);
      
      masteredWords = progressData.filter((p: any) => {
        if (!p.next_review_date) return false;
        const reviewDate = new Date(p.next_review_date);
        reviewDate.setHours(0, 0, 0, 0);
        return reviewDate >= twoDaysFromNow;
      }).length;
    }

    const remainingWords = totalWords - masteredWords;
    const successRate = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;

    return {
      totalWords,
      masteredWords,
      remainingWords,
      successRate
    };
  }

  async completeLesson(userId: string, lessonId: string): Promise<UserLesson> {
    console.log(`Attempting to complete lesson ${lessonId} for user ${userId}`);
    
    const existing = await this.supabaseService.client
      .from('nlapp_user_lessons')
      .select('*')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (existing.error) {
      console.error('Error checking existing user lesson:', existing.error);
      throw existing.error;
    }

    if (existing.data) {
      console.log(`Updating existing user lesson ${existing.data.id} as completed.`);
      const { data, error } = await this.supabaseService.client
        .schema('public')
        .from('nlapp_user_lessons')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.data.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user lesson:', error);
        throw error;
      }
      console.log(`User lesson ${data.id} updated successfully.`);
      return data;
    } else {
      console.log(`Inserting new user lesson for lesson ${lessonId}.`);
      const { data, error } = await this.supabaseService.client
        .schema('public')
        .from('nlapp_user_lessons')
        .insert({
          user_id: userId,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting user lesson:', error);
        throw error;
      }
      console.log(`New user lesson ${data.id} inserted successfully.`);
      return data;
    }
  }

  async getProgressStats(userId: string): Promise<{
    totalWordsSeen: number;
    totalCorrect: number;
    totalIncorrect: number;
    wordsToReview: number;
    completedLessons: number;
  }> {
    const [progressResult, reviewData, lessonsResult] = await Promise.all([
      this.supabaseService.client
        .schema('public')
        .from('nlapp_user_progress')
        .select('times_correct, times_incorrect')
        .eq('user_id', userId),
      this.getWordsToReview(userId),
      this.supabaseService.client
        .from('nlapp_user_lessons')
        .select('id')
        .eq('user_id', userId)
        .eq('completed', true)
    ]);

    // Vérifier les erreurs
    if (progressResult.error) {
      console.error('Error fetching progress:', progressResult.error);
    }
    if (lessonsResult.error) {
      console.error('Error fetching completed lessons:', lessonsResult.error);
    }

    // Log pour déboguer
    console.log('getProgressStats - lessonsResult:', {
      data: lessonsResult.data,
      error: lessonsResult.error,
      count: lessonsResult.data?.length || 0
    });

    const progress = progressResult.data || [];
    const totalCorrect = progress.reduce((sum, p) => sum + (p.times_correct || 0), 0);
    const totalIncorrect = progress.reduce((sum, p) => sum + (p.times_incorrect || 0), 0);

    const completedLessonsCount = lessonsResult.data?.length || 0;
    console.log(`getProgressStats - completedLessons count: ${completedLessonsCount}`);

    return {
      totalWordsSeen: progress.length,
      totalCorrect,
      totalIncorrect,
      wordsToReview: reviewData.length,
      completedLessons: completedLessonsCount
    };
  }
}

