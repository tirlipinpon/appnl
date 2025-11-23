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
      // Générer une phrase pour chaque mot
      this.sentences = [];
      
      for (const word of this.words) {
        // Récupérer ou générer la phrase (avec vérification DB et enregistrement automatique)
        // Si une phrase existe déjà dans la DB, elle sera utilisée
        // Sinon, DeepSeek génère une nouvelle phrase et l'enregistre
        const sentence = await this.deepSeekService.getOrGenerateFillInTheBlankSentence(
          word.id,
          word.dutch_text,
          [] // Pas besoin de passer existingSentences car on réutilise la phrase de la DB
        );
        
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

