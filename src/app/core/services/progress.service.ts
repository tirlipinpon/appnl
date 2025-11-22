import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserProgress, UserLesson, QuizAttempt, QuizType, QuizDirection } from '../models/progress.model';
import { Word } from '../models/word.model';

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  private supabaseService = inject(SupabaseService);

  // Algorithme SM-2 simplifié pour répétition espacée
  private calculateNextReview(progress: UserProgress | null, isCorrect: boolean): {
    nextReviewDate: Date;
    intervalDays: number;
    easeFactor: number;
  } {
    const now = new Date();
    let intervalDays = 1;
    let easeFactor = 2.5;

    if (progress) {
      easeFactor = progress.ease_factor;
      intervalDays = progress.interval_days;
    }

    if (isCorrect) {
      // Augmenter l'intervalle et ajuster le facteur de facilité
      if (intervalDays === 1) {
        intervalDays = 3;
      } else if (intervalDays === 3) {
        intervalDays = 7;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
      easeFactor = Math.max(1.3, easeFactor + 0.1);
    } else {
      // Réinitialiser l'intervalle en cas d'erreur
      intervalDays = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    }

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
        .from('nlapp_user_progress')
        .update(updateData)
        .eq('id', existingProgress.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabaseService.client
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

  async getWordsToReview(userId: string): Promise<Word[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService.client
      .from('nlapp_user_progress')
      .select(`
        word_id,
        nlapp_words (*)
      `)
      .eq('user_id', userId)
      .lte('next_review_date', now)
      .order('next_review_date', { ascending: true });

    if (error) throw error;
    return (data || []).map((item: any) => item.nlapp_words).filter(Boolean);
  }

  async getUserLessons(userId: string): Promise<UserLesson[]> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_user_lessons')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  }

  async completeLesson(userId: string, lessonId: string): Promise<UserLesson> {
    const existing = await this.supabaseService.client
      .from('nlapp_user_lessons')
      .select('*')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (existing.data) {
      const { data, error } = await this.supabaseService.client
        .from('nlapp_user_lessons')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.data.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabaseService.client
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

      if (error) throw error;
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
    const [progressData, reviewData, lessonsData] = await Promise.all([
      this.supabaseService.client
        .from('nlapp_user_progress')
        .select('times_correct, times_incorrect')
        .eq('user_id', userId),
      this.getWordsToReview(userId),
      this.supabaseService.client
        .from('nlapp_user_lessons')
        .select('completed')
        .eq('user_id', userId)
        .eq('completed', true)
    ]);

    const progress = progressData.data || [];
    const totalCorrect = progress.reduce((sum, p) => sum + (p.times_correct || 0), 0);
    const totalIncorrect = progress.reduce((sum, p) => sum + (p.times_incorrect || 0), 0);

    return {
      totalWordsSeen: progress.length,
      totalCorrect,
      totalIncorrect,
      wordsToReview: reviewData.length,
      completedLessons: lessonsData.data?.length || 0
    };
  }
}

