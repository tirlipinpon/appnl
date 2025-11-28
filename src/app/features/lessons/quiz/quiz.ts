import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { WordService } from '../../../core/services/word.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { QuizDirection } from '../../../core/models/progress.model';
import { AudioService } from '../../../core/services/audio.service';
import { DeepSeekService } from '../../../core/services/deepseek.service';

@Component({
  selector: 'app-quiz',
  imports: [CommonModule],
  templateUrl: './quiz.html',
  styleUrl: './quiz.css',
})
export class Quiz implements OnInit {
  private wordService = inject(WordService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  audioService = inject(AudioService);
  private deepSeekService = inject(DeepSeekService);

  @Input() words: Word[] = [];
  @Input() direction: QuizDirection = 'french_to_dutch';
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();
  @Output() reverseRequested = new EventEmitter<void>();
  @Output() nextGameRequested = new EventEmitter<void>();

  currentIndex = 0;
  currentWord: Word | null = null;
  choices: string[] = [];
  correctAnswer: string = '';
  selectedAnswer: string = '';
  showResult = false;
  isCorrect = false;
  score = { correct: 0, total: 0 };
  selectedWordTranslation: string = ''; // Traduction du mot cliqué si incorrect
  
  // Propriétés pour l'aide
  showHelpExplanation = false;
  helpExplanation = '';
  isLoadingHelp = false;
  helpError: string | null = null;

  async ngOnInit() {
    if (this.words.length > 0) {
      await this.loadQuestion();
    }
  }

  async loadQuestion() {
    if (this.currentIndex >= this.words.length) {
      this.completed.emit(this.score);
      return;
    }

    this.currentWord = this.words[this.currentIndex];
    this.showResult = false;
    this.selectedAnswer = '';
    this.selectedWordTranslation = '';

    if (this.direction === 'french_to_dutch') {
      this.correctAnswer = this.currentWord.dutch_text;
      await this.generateChoices(this.currentWord.dutch_text);
    } else {
      this.correctAnswer = this.currentWord.french_text;
      await this.generateChoices(this.currentWord.french_text);
    }
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

  // Stocker les mots correspondants aux choix pour pouvoir afficher les traductions
  choicesWords: Map<string, Word> = new Map();

  async generateChoices(correct: string) {
    const excludeIds = this.words.map(w => w.id);
    this.choicesWords.clear();
    
    // Stocker le mot correct
    if (this.currentWord) {
      const correctText = this.direction === 'french_to_dutch' 
        ? this.currentWord.dutch_text 
        : this.currentWord.french_text;
      this.choicesWords.set(correctText, this.currentWord);
    }
    
    // Sélectionner des mots similaires de la DB au lieu de mots complètement aléatoires
    const similarWords = await this.wordService.getSimilarWords(
      correct, 
      3, 
      excludeIds,
      this.direction
    );
    
    const wrongAnswers: string[] = [];
    similarWords.forEach(w => {
      const answerText = this.direction === 'french_to_dutch' ? w.dutch_text : w.french_text;
      wrongAnswers.push(answerText);
      this.choicesWords.set(answerText, w);
    });

    // Si on n'a pas assez de mots similaires dans la DB, compléter avec des mots aléatoires
    if (wrongAnswers.length < 3) {
      const randomWords = await this.wordService.getRandomWords(
        3 - wrongAnswers.length, 
        [...excludeIds, ...similarWords.map(w => w.id)]
      );
      randomWords.forEach(w => {
        const answerText = this.direction === 'french_to_dutch' ? w.dutch_text : w.french_text;
        wrongAnswers.push(answerText);
        this.choicesWords.set(answerText, w);
      });
    }

    // Mélanger les choix de manière aléatoire avec Fisher-Yates
    const allChoices = [correct, ...wrongAnswers.slice(0, 3)];
    this.choices = this.shuffleArray(allChoices);
  }

  selectAnswer(answer: string) {
    if (this.showResult) return;

    this.selectedAnswer = answer;
    this.isCorrect = answer === this.correctAnswer;
    this.showResult = true;
    this.score.total++;

    // Si la réponse est incorrecte, trouver la traduction du mot cliqué
    if (!this.isCorrect) {
      const selectedWord = this.choicesWords.get(answer);
      if (selectedWord) {
        // Afficher la traduction du mot cliqué
        this.selectedWordTranslation = this.direction === 'french_to_dutch' 
          ? selectedWord.french_text 
          : selectedWord.dutch_text;
      } else {
        this.selectedWordTranslation = '';
      }
    } else {
      this.selectedWordTranslation = '';
    }

    if (this.isCorrect) {
      this.score.correct++;
    }

    // Enregistrer la tentative
    const user = this.authService.getCurrentUser();
    if (user && this.currentWord) {
      this.progressService.recordQuizAttempt(
        user.id,
        this.currentWord.id,
        'multiple_choice',
        this.direction,
        answer,
        this.correctAnswer,
        this.isCorrect
      );
    }
  }

  previousQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.loadQuestion();
    }
  }

  nextQuestion() {
    this.currentIndex++;
    this.loadQuestion();
  }

  skipQuestion() {
    if (this.currentIndex === this.words.length - 1) {
      // Si c'est la dernière question, afficher la section de résultat avec les options de fin
      this.showResult = true;
      this.isCorrect = false;
      // Ne pas incrémenter le score car on passe sans répondre
    } else {
      // Passer à la question suivante sans répondre
      this.currentIndex++;
      this.loadQuestion();
    }
  }

  getQuestionText(): string {
    if (!this.currentWord) return '';
    return this.direction === 'french_to_dutch' 
      ? this.currentWord.french_text 
      : this.currentWord.dutch_text;
  }

  getQuestionLabel(): string {
    return this.direction === 'french_to_dutch' 
      ? 'Traduisez en néerlandais :' 
      : 'Traduisez en français :';
  }

  playAudio(): void {
    if (!this.currentWord) return;
    // Toujours lire la réponse correcte en néerlandais (la langue qu'on apprend)
    // Peu importe la direction, on veut entendre la réponse en néerlandais
    if (this.direction === 'french_to_dutch') {
      // La réponse correcte est en néerlandais
      if (this.correctAnswer) {
        this.audioService.speak(this.correctAnswer, 'nl-NL');
      }
    } else {
      // Direction dutch_to_french : la question est en néerlandais, mais on veut entendre la réponse correcte
      // Ici la réponse correcte est en français, donc on lit le néerlandais de la question
      if (this.currentWord.dutch_text) {
        this.audioService.speak(this.currentWord.dutch_text, 'nl-NL');
      }
    }
  }

  /**
   * Vérifie si le bouton d'aide doit être affiché
   * (toujours affiché car on peut toujours obtenir le mot néerlandais)
   */
  shouldShowHelpButton(): boolean {
    return !!this.currentWord?.dutch_text;
  }

  /**
   * Récupère le mot néerlandais à expliquer selon la direction
   */
  getDutchWordToExplain(): string | null {
    if (!this.currentWord) return null;
    // Toujours retourner le mot néerlandais car c'est ce qu'on apprend
    return this.currentWord.dutch_text || null;
  }

  /**
   * Demande une explication du mot en néerlandais
   */
  async requestWordHelp() {
    const dutchWord = this.getDutchWordToExplain();
    if (!dutchWord || !this.currentWord || this.isLoadingHelp) {
      return;
    }

    this.isLoadingHelp = true;
    this.helpError = null;
    this.showHelpExplanation = true;

    try {
      const explanation = await this.deepSeekService.getOrGenerateWordExplanation(
        this.currentWord.id,
        dutchWord
      );
      this.helpExplanation = explanation;
    } catch (error) {
      console.error('Error getting word explanation:', error);
      this.helpError = 'Erreur lors du chargement de l\'explication. Veuillez réessayer.';
      this.helpExplanation = '';
    } finally {
      this.isLoadingHelp = false;
    }
  }

  /**
   * Ferme l'affichage de l'explication
   */
  closeHelpExplanation() {
    this.showHelpExplanation = false;
    this.helpExplanation = '';
    this.helpError = null;
  }

  /**
   * Formate l'explication pour l'affichage
   */
  formatExplanation(text: string): string {
    if (!text) return '';
    
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const paragraphs = formatted.split(/\n\n+/);
    
    const formattedParagraphs = paragraphs.map(para => {
      para = para.trim();
      if (!para) return '';
      
      const lines = para.split('\n');
      const isList = lines.some(line => /^[-*]\s+/.test(line.trim()));
      
      if (isList) {
        const listItems = lines
          .filter(line => /^[-*]\s+/.test(line.trim()))
          .map(line => {
            const content = line.replace(/^[-*]\s+/, '').trim();
            return `<li>${content}</li>`;
          });
        return `<ul>${listItems.join('')}</ul>`;
      } else {
        para = para.replace(/\n/g, '<br>');
        return `<p>${para}</p>`;
      }
    });
    
    return formattedParagraphs.filter(p => p).join('');
  }
}
