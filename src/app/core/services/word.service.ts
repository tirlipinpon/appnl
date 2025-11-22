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
    const shuffled = (data || []).sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}

