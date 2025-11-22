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

  async getWordsByLesson(lessonId: string): Promise<Word[]> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_words')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createLesson(lesson: Partial<Lesson>): Promise<Lesson> {
    const { data, error } = await this.supabaseService.client
      .from('nlapp_lessons')
      .insert(lesson)
      .select()
      .single();

    if (error) throw error;
    return data;
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

