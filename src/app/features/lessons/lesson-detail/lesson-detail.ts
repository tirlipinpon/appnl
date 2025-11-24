import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LessonService } from '../../../core/services/lesson.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserLessonService } from '../../../core/services/user-lesson.service';
import { WordService } from '../../../core/services/word.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Lesson } from '../../../core/models/lesson.model';
import { Word } from '../../../core/models/word.model';
import { FlashcardView } from '../flashcard-view/flashcard-view';
import { Quiz } from '../quiz/quiz';
import { TypingPractice } from '../typing-practice/typing-practice';
import { FrenchWriting } from '../french-writing/french-writing';
import { FillInTheBlank } from '../fill-in-the-blank/fill-in-the-blank';

type LessonStep = 'flashcards' | 'quiz' | 'typing' | 'frenchWriting' | 'fillInBlank' | 'completed';

@Component({
  selector: 'app-lesson-detail',
  imports: [CommonModule, FormsModule, RouterLink, FlashcardView, Quiz, TypingPractice, FrenchWriting, FillInTheBlank],
  templateUrl: './lesson-detail.html',
  styleUrl: './lesson-detail.css',
})
export class LessonDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lessonService = inject(LessonService);
  private progressService = inject(ProgressService);
  authService = inject(AuthService); // Public pour l'utiliser dans le template
  private userLessonService = inject(UserLessonService);
  private wordService = inject(WordService);
  private supabaseService = inject(SupabaseService);

  lesson: Lesson | null = null;
  words: Word[] = [];
  // Mots mélangés pour chaque jeu (ordre indépendant)
  flashcardWords: Word[] = [];
  quizWords: Word[] = [];
  typingWords: Word[] = [];
  frenchWritingWords: Word[] = [];
  fillInBlankWords: Word[] = [];
  currentStep: LessonStep = 'flashcards';
  currentFlashcardIndex = 0;
  quizScore: { correct: number; total: number } | null = null;
  typingScore: { correct: number; total: number } | null = null;
  frenchWritingScore: { correct: number; total: number } | null = null;
  fillInBlankScore: { correct: number; total: number } | null = null;
  isLoading = true;
  
  // Gestion des mots personnels
  showWordManagement = false;
  allWordsInLesson: Word[] = []; // Tous les mots de la leçon (y compris masqués)
  hiddenWordIds: Set<string> = new Set();
  isManagingWords = false;
  newWordForm = { french_text: '', dutch_text: '' };
  availableWordsToAdd: Word[] = []; // Mots d'autres leçons disponibles pour ajout
  
  // Directions pour chaque jeu
  flashcardDirection: 'french_to_dutch' | 'dutch_to_french' = 'french_to_dutch';
  quizDirection: 'french_to_dutch' | 'dutch_to_french' = 'french_to_dutch';
  typingDirection: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french';
  frenchWritingDirection: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french';
  fillInBlankDirection: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french';

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

  async ngOnInit() {
    const lessonId = this.route.snapshot.paramMap.get('id');
    if (lessonId) {
      await this.loadLesson(lessonId);
    }
  }

  async loadLesson(lessonId: string) {
    try {
      this.isLoading = true;
      const user = this.authService.getCurrentUser();
      
      // Charger la leçon
      const lesson = await this.lessonService.getLessonById(lessonId);
      this.lesson = lesson;
      
      // Charger les mots personnalisés (avec modifications appliquées : masquage + ajouts)
      // Cela inclut les mots de base (non masqués) + les mots ajoutés (non masqués)
      const personalizedWords = await this.lessonService.getWordsByLesson(lessonId, user?.id);
      
      // Pour l'interface de gestion, charger TOUS les mots (base + ajoutés) pour pouvoir les masquer/réactiver
      // On récupère les mots de base et les mots ajoutés séparément pour l'affichage
      const allBaseWords = await this.lessonService.getWordsByLesson(lessonId);
      
      // Récupérer les mots ajoutés pour cette leçon
      let addedWords: Word[] = [];
      if (user) {
        const { data: addedModifications, error: addedError } = await this.supabaseService.client
          .from('nlapp_user_lesson_words')
          .select('word_id')
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId)
          .eq('action', 'add');
        
        if (!addedError && addedModifications && addedModifications.length > 0) {
          const addedWordIds = addedModifications.map((m: any) => m.word_id).filter((id: string) => id);
          if (addedWordIds.length > 0) {
            const { data: addedWordsData, error: fetchError } = await this.supabaseService.client
              .from('nlapp_words')
              .select('*')
              .in('id', addedWordIds);
            
            if (!fetchError && addedWordsData) {
              addedWords = addedWordsData;
            }
          }
        }
      }
      
      // Combiner les mots de base et les mots ajoutés pour l'affichage dans la gestion
      this.allWordsInLesson = [...allBaseWords, ...addedWords.filter(w => !allBaseWords.some(bw => bw.id === w.id))];
      
      // Charger les mots masqués pour l'interface de gestion
      if (user) {
        const hiddenIds = await this.userLessonService.getHiddenWords(user.id, lessonId);
        this.hiddenWordIds = new Set(hiddenIds);
      } else {
        this.hiddenWordIds = new Set();
      }
      
      // Filtrer les mots pour ne garder que ceux qui nécessitent une révision
      let wordsToUse = personalizedWords;
      if (user) {
        try {
          wordsToUse = await this.progressService.filterWordsNeedingReview(user.id, personalizedWords);
          // Si aucun mot ne nécessite de révision, afficher tous les mots pour ne pas bloquer l'utilisateur
          if (wordsToUse.length === 0) {
            console.log('Aucun mot à réviser, affichage de tous les mots de la leçon');
            wordsToUse = personalizedWords;
          }
        } catch (error) {
          console.error('Error filtering words:', error);
          // En cas d'erreur, utiliser tous les mots
          wordsToUse = personalizedWords;
        }
      }
      
      this.words = wordsToUse;
      
      // Mélanger les mots de manière indépendante pour chaque jeu
      this.flashcardWords = this.shuffleArray(wordsToUse);
      this.quizWords = this.shuffleArray(wordsToUse);
      this.typingWords = this.shuffleArray(wordsToUse);
      this.frenchWritingWords = this.shuffleArray(wordsToUse);
      this.fillInBlankWords = this.shuffleArray(wordsToUse);
    } catch (error) {
      console.error('Error loading lesson:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onFlashcardNext() {
    if (this.currentFlashcardIndex < this.flashcardWords.length - 1) {
      this.currentFlashcardIndex++;
    }
  }

  onFlashcardPrevious() {
    if (this.currentFlashcardIndex > 0) {
      this.currentFlashcardIndex--;
    }
  }

  onFlashcardsFinish() {
    this.currentStep = 'quiz';
    this.currentFlashcardIndex = 0;
  }

  onFlashcardNextGameRequested() {
    // Passer directement au quiz
    this.currentStep = 'quiz';
    this.currentFlashcardIndex = 0;
  }

  onQuizCompleted(score: { correct: number; total: number }) {
    this.quizScore = score;
    this.currentStep = 'typing';
  }

  onQuizNextGameRequested() {
    // Passer directement au typing
    this.currentStep = 'typing';
  }

  onTypingCompleted(score: { correct: number; total: number }) {
    this.typingScore = score;
    this.currentStep = 'frenchWriting';
  }

  onTypingNextGameRequested() {
    this.currentStep = 'frenchWriting';
  }

  onFrenchWritingCompleted(score: { correct: number; total: number }) {
    this.frenchWritingScore = score;
    // Passer au test phrase à trous seulement si activé, sinon terminer
    if (this.lesson?.enable_fill_in_blank !== false) {
      this.currentStep = 'fillInBlank';
    } else {
      // Si le test phrase à trous est désactivé, calculer directement le score final
      this.calculateFinalScore();
    }
  }

  onFrenchWritingNextGameRequested() {
    // Passer directement au fill-in-blank ou terminer
    if (this.lesson?.enable_fill_in_blank !== false) {
      this.currentStep = 'fillInBlank';
    } else {
      // Si le test phrase à trous est désactivé, calculer directement le score final
      this.calculateFinalScore();
    }
  }

  private async calculateFinalScore() {
    const totalScore = (this.quizScore?.correct || 0) + (this.typingScore?.correct || 0) + (this.frenchWritingScore?.correct || 0);
    const totalQuestions = (this.quizScore?.total || 0) + (this.typingScore?.total || 0) + (this.frenchWritingScore?.total || 0);
    const successRate = totalQuestions > 0 ? (totalScore / totalQuestions) * 100 : 0;

    console.log(`Calculating final score: ${totalScore}/${totalQuestions} = ${Math.round(successRate)}%`);

    if (successRate >= 70) {
      console.log(`Score suffisant (${Math.round(successRate)}%), marquant la leçon comme complétée.`);
      const user = this.authService.getCurrentUser();
      if (user && this.lesson) {
        await this.progressService.completeLesson(user.id, this.lesson.id);
      } else {
        console.error('Cannot complete lesson: user or lesson is null', { user, lesson: this.lesson });
      }
      this.currentStep = 'completed';
    } else {
      console.log(`Score insuffisant (${Math.round(successRate)}%), redémarrant la leçon.`);
      alert(`Score insuffisant (${Math.round(successRate)}%). Veuillez réessayer.`);
      this.currentStep = 'flashcards';
      this.currentFlashcardIndex = 0;
    }
  }

  onFillInBlankNextGameRequested() {
    // C'est le dernier jeu, donc terminer la leçon
    this.calculateFinalScore();
  }

  async onFillInBlankCompleted(score: { correct: number; total: number }) {
    this.fillInBlankScore = score;
    
    // Marquer la leçon comme complétée si le score global est réussi (par exemple, > 70%)
    const totalScore = (this.quizScore?.correct || 0) + (this.typingScore?.correct || 0) + (this.frenchWritingScore?.correct || 0) + score.correct;
    const totalQuestions = (this.quizScore?.total || 0) + (this.typingScore?.total || 0) + (this.frenchWritingScore?.total || 0) + score.total;
    const successRate = totalQuestions > 0 ? (totalScore / totalQuestions) * 100 : 0;

    console.log(`Fill-in-blank completed. Calculating final score: ${totalScore}/${totalQuestions} = ${Math.round(successRate)}%`);

    if (successRate >= 70) {
      console.log(`Score suffisant (${Math.round(successRate)}%), marquant la leçon comme complétée.`);
      const user = this.authService.getCurrentUser();
      if (user && this.lesson) {
        await this.progressService.completeLesson(user.id, this.lesson.id);
      } else {
        console.error('Cannot complete lesson: user or lesson is null', { user, lesson: this.lesson });
      }
      this.currentStep = 'completed';
    } else {
      console.log(`Score insuffisant (${Math.round(successRate)}%), redémarrant la leçon.`);
      // Recommencer si le score est trop bas
      alert(`Score insuffisant (${Math.round(successRate)}%). Veuillez réessayer.`);
      this.currentStep = 'flashcards';
      this.currentFlashcardIndex = 0;
    }
  }

  async restartLesson() {
    this.currentStep = 'flashcards';
    this.currentFlashcardIndex = 0;
    this.quizScore = null;
    this.typingScore = null;
    this.fillInBlankScore = null;
    // Réinitialiser les directions
    this.flashcardDirection = 'french_to_dutch';
    this.quizDirection = 'french_to_dutch';
    this.typingDirection = 'dutch_to_french';
    this.frenchWritingDirection = 'dutch_to_french';
    this.fillInBlankDirection = 'dutch_to_french';
    
    // Recharger et filtrer les mots à réviser
    if (this.lesson) {
      await this.loadLesson(this.lesson.id);
    } else if (this.words.length > 0) {
      // Si pas de leçon mais des mots existent, juste remélanger
      this.flashcardWords = this.shuffleArray(this.words);
      this.quizWords = this.shuffleArray(this.words);
      this.typingWords = this.shuffleArray(this.words);
      this.fillInBlankWords = this.shuffleArray(this.words);
    }
  }

  onFlashcardReverseRequested() {
    // Inverser la direction et remélanger les mots pour les flashcards
    this.flashcardDirection = this.flashcardDirection === 'french_to_dutch' ? 'dutch_to_french' : 'french_to_dutch';
    this.flashcardWords = this.shuffleArray(this.words);
    this.currentFlashcardIndex = 0;
    // Forcer la recréation du composant en changeant temporairement l'étape
    const currentStep = this.currentStep;
    this.currentStep = 'quiz';
    setTimeout(() => {
      this.currentStep = currentStep;
    }, 0);
  }

  onQuizReverseRequested() {
    // Inverser la direction et remélanger les mots pour le quiz
    this.quizDirection = this.quizDirection === 'french_to_dutch' ? 'dutch_to_french' : 'french_to_dutch';
    this.quizWords = this.shuffleArray(this.words);
    this.quizScore = null;
    // Forcer la recréation du composant en changeant temporairement l'étape
    const currentStep = this.currentStep;
    this.currentStep = 'flashcards';
    setTimeout(() => {
      this.currentStep = currentStep;
    }, 0);
  }

  onTypingReverseRequested() {
    // Inverser la direction et remélanger les mots pour l'exercice de frappe
    this.typingDirection = this.typingDirection === 'french_to_dutch' ? 'dutch_to_french' : 'french_to_dutch';
    this.typingWords = this.shuffleArray(this.words);
    this.typingScore = null;
    // Forcer la recréation du composant en changeant temporairement l'étape
    const currentStep = this.currentStep;
    this.currentStep = 'quiz';
    setTimeout(() => {
      this.currentStep = currentStep;
    }, 0);
  }

  onFrenchWritingReverseRequested() {
    // Inverser la direction et remélanger les mots pour l'écriture en français
    this.frenchWritingDirection = this.frenchWritingDirection === 'french_to_dutch' ? 'dutch_to_french' : 'french_to_dutch';
    this.frenchWritingWords = this.shuffleArray(this.words);
    this.frenchWritingScore = null;
    // Forcer la recréation du composant en changeant temporairement l'étape
    const currentStep = this.currentStep;
    this.currentStep = 'typing';
    setTimeout(() => {
      this.currentStep = currentStep;
    }, 0);
  }

  onFillInBlankReverseRequested() {
    // Inverser la direction et remélanger les mots pour les phrases à trous
    this.fillInBlankDirection = this.fillInBlankDirection === 'french_to_dutch' ? 'dutch_to_french' : 'french_to_dutch';
    this.fillInBlankWords = this.shuffleArray(this.words);
    this.fillInBlankScore = null;
    // Forcer la recréation du composant en changeant temporairement l'étape
    const currentStep = this.currentStep;
    this.currentStep = 'frenchWriting';
    setTimeout(() => {
      this.currentStep = currentStep;
    }, 0);
  }

  // Méthodes pour gérer les mots personnels
  toggleWordManagement() {
    this.showWordManagement = !this.showWordManagement;
    if (this.showWordManagement && this.lesson) {
      this.loadAvailableWordsToAdd();
    }
  }

  async loadAvailableWordsToAdd() {
    try {
      // Charger tous les mots de toutes les leçons sauf ceux déjà dans cette leçon
      const allWords = await this.wordService.getAllWords();
      const currentWordIds = new Set(this.allWordsInLesson.map(w => w.id));
      this.availableWordsToAdd = allWords.filter(w => !currentWordIds.has(w.id));
    } catch (error) {
      console.error('Error loading available words:', error);
      this.availableWordsToAdd = [];
    }
  }

  async hideWord(wordId: string) {
    const user = this.authService.getCurrentUser();
    if (!user || !this.lesson) return;

    try {
      await this.userLessonService.hideWord(user.id, this.lesson.id, wordId);
      this.hiddenWordIds.add(wordId);
      // Recharger la leçon pour mettre à jour les mots
      await this.loadLesson(this.lesson.id);
    } catch (error) {
      console.error('Error hiding word:', error);
      alert('Erreur lors du masquage du mot');
    }
  }

  async unhideWord(wordId: string) {
    const user = this.authService.getCurrentUser();
    if (!user || !this.lesson) return;

    try {
      await this.userLessonService.unhideWord(user.id, this.lesson.id, wordId);
      this.hiddenWordIds.delete(wordId);
      // Recharger la leçon pour mettre à jour les mots
      await this.loadLesson(this.lesson.id);
    } catch (error) {
      console.error('Error unhiding word:', error);
      alert('Erreur lors de la réactivation du mot');
    }
  }

  async addExistingWordToLesson(wordId: string) {
    const user = this.authService.getCurrentUser();
    if (!user || !this.lesson) return;

    try {
      await this.userLessonService.addWordToLesson(user.id, this.lesson.id, wordId);
      // Recharger la leçon pour mettre à jour les mots
      await this.loadLesson(this.lesson.id);
      // Recharger les mots disponibles
      await this.loadAvailableWordsToAdd();
    } catch (error) {
      console.error('Error adding word to lesson:', error);
      alert('Erreur lors de l\'ajout du mot');
    }
  }

  async addNewWordToLesson() {
    const user = this.authService.getCurrentUser();
    if (!user || !this.lesson) return;

    if (!this.newWordForm.french_text.trim() || !this.newWordForm.dutch_text.trim()) {
      alert('Veuillez remplir les deux champs');
      return;
    }

    try {
      await this.userLessonService.addNewWordToLesson(user.id, this.lesson.id, {
        french_text: this.newWordForm.french_text.trim(),
        dutch_text: this.newWordForm.dutch_text.trim()
      });
      // Réinitialiser le formulaire
      this.newWordForm = { french_text: '', dutch_text: '' };
      // Recharger la leçon pour mettre à jour les mots
      await this.loadLesson(this.lesson.id);
      // Recharger les mots disponibles
      await this.loadAvailableWordsToAdd();
    } catch (error) {
      console.error('Error adding new word:', error);
      alert('Erreur lors de la création du mot');
    }
  }

  isWordHidden(wordId: string): boolean {
    return this.hiddenWordIds.has(wordId);
  }
}
