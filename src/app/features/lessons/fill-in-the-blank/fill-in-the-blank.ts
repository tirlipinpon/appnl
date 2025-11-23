import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Word } from '../../../core/models/word.model';
import { DeepSeekService, FillInTheBlankSentence } from '../../../core/services/deepseek.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-fill-in-the-blank',
  imports: [CommonModule, FormsModule],
  templateUrl: './fill-in-the-blank.html',
  styleUrl: './fill-in-the-blank.css',
})
export class FillInTheBlank implements OnInit {
  private deepSeekService = inject(DeepSeekService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);

  @Input() words: Word[] = [];
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();

  currentIndex = 0;
  currentSentence: FillInTheBlankSentence | null = null;
  userInput: string = '';
  showResult = false;
  isCorrect = false;
  score = { correct: 0, total: 0 };
  isLoading = false;
  sentences: FillInTheBlankSentence[] = [];

  async ngOnInit() {
    await this.loadSentences();
  }

  async loadSentences() {
    this.isLoading = true;
    try {
      const user = this.authService.getCurrentUser();
      
      // Générer une phrase pour chaque mot
      this.sentences = [];
      const generatedSentences: { [wordId: string]: string[] } = {};
      
      for (const word of this.words) {
        // Récupérer les phrases déjà générées dans cette session pour ce mot
        const sessionSentences = generatedSentences[word.id] || [];
        
        // Récupérer les phrases déjà utilisées pour ce mot depuis la DB
        let existingSentences: string[] = [];
        if (user) {
          try {
            // Récupérer les tentatives précédentes pour ce mot
            // Note: On pourrait stocker la phrase dans la DB, mais pour l'instant
            // on utilise une approche basée sur les tentatives précédentes
            const { data } = await this.supabaseService.client
              .from('nlapp_quiz_attempts')
              .select('correct_answer')
              .eq('word_id', word.id)
              .eq('quiz_type', 'fill_in_blank')
              .order('created_at', { ascending: false })
              .limit(5);
            
            // Pour varier, on peut utiliser le nombre de tentatives précédentes
            // comme indicateur pour demander une variation
            if (data && data.length > 0) {
              // On indique qu'il y a déjà eu des tentatives pour varier
              existingSentences = [`Phrase précédente pour "${word.dutch_text}"`];
            }
          } catch (error) {
            console.error('Error fetching existing sentences:', error);
          }
        }
        
        // Combiner les phrases de la session et celles de la DB
        const allExisting = [...sessionSentences, ...existingSentences];
        
        const sentence = await this.deepSeekService.generateFillInTheBlankSentence(
          word.dutch_text,
          allExisting
        );
        
        // Stocker la phrase générée pour éviter les répétitions dans cette session
        if (!generatedSentences[word.id]) {
          generatedSentences[word.id] = [];
        }
        generatedSentences[word.id].push(sentence.sentence);
        
        this.sentences.push(sentence);
      }
      
      if (this.sentences.length > 0) {
        this.currentSentence = this.sentences[0];
      }
    } catch (error) {
      console.error('Error loading sentences:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async checkAnswer() {
    if (this.showResult || !this.userInput.trim()) return;
    
    const currentWord = this.words[this.currentIndex];
    // Comparaison insensible à la casse
    this.isCorrect = this.userInput.trim().toLowerCase() === currentWord.dutch_text.toLowerCase();
    this.showResult = true;
    this.score.total++;
    
    if (this.isCorrect) {
      this.score.correct++;
    }

    // Enregistrer la tentative dans Supabase pour la répétition espacée
    const user = this.authService.getCurrentUser();
    if (user && currentWord) {
      await this.progressService.recordQuizAttempt(
        user.id,
        currentWord.id,
        'fill_in_blank',
        'dutch_to_french', // Direction pour phrases à trous (on teste le néerlandais)
        this.userInput.trim(),
        currentWord.dutch_text,
        this.isCorrect
      );
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.currentSentence = this.sentences[this.currentIndex];
      this.userInput = '';
      this.showResult = false;
      this.isCorrect = false;
    } else {
      this.completed.emit(this.score);
    }
  }

  getCurrentWord(): Word | null {
    return this.words[this.currentIndex] || null;
  }

  getSentenceWithBlank(): string {
    if (!this.currentSentence) return '';
    let sentence = this.currentSentence.sentence;
    // Remplacer [MOT] ou toute autre variante par _____
    sentence = sentence.replace(/\[MOT\]/gi, '_____');
    sentence = sentence.replace(/\{MOT\}/gi, '_____');
    // Si la phrase ne contient pas déjà de blank, ajouter _____ à la fin
    if (!sentence.includes('_____') && !sentence.includes('___')) {
      sentence += ' _____';
    }
    return sentence;
  }
}

