import { Component, Input, Output, EventEmitter, OnInit, inject, ViewChildren, QueryList, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Word } from '../../../core/models/word.model';
import { DeepSeekService, FillInTheBlankSentence } from '../../../core/services/deepseek.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AudioService } from '../../../core/services/audio.service';
import { LessonService } from '../../../core/services/lesson.service';
import { TextSelectionDirective } from '../../../shared/directives/text-selection.directive';

@Component({
  selector: 'app-fill-in-the-blank',
  imports: [CommonModule, FormsModule, TextSelectionDirective],
  templateUrl: './fill-in-the-blank.html',
  styleUrl: './fill-in-the-blank.css',
})
export class FillInTheBlank implements OnInit, AfterViewInit, OnDestroy {
  private deepSeekService = inject(DeepSeekService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);
  private lessonService = inject(LessonService);
  audioService = inject(AudioService);
  
  // Cache pour les descriptions de leçons
  private lessonDescriptions: Map<string, string> = new Map();

  @Input() words: Word[] = [];
  @Input() direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french';
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();
  @Output() reverseRequested = new EventEmitter<void>();
  @Output() nextGameRequested = new EventEmitter<void>();

  @ViewChildren('letterInput') letterInputElements!: QueryList<ElementRef<HTMLInputElement>>;

  currentIndex = 0;
  currentSentence: FillInTheBlankSentence | null = null;
  userInput: string = '';
  letterInputs: string[] = [];
  showResult = false;
  isCorrect = false;
  score = { correct: 0, total: 0 };
  isLoading = false;
  isLoadingNext = false;
  sentences: FillInTheBlankSentence[] = [];
  sentencePromises: Map<number, Promise<FillInTheBlankSentence>> = new Map();

  /**
   * Normalise une lettre en supprimant les accents pour la comparaison
   * Exemple: é -> e, à -> a, ç -> c
   */
  private normalizeLetter(letter: string): string {
    if (!letter) return '';
    return letter.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  ngAfterViewInit() {
    // S'assurer que les inputs sont bien initialisés
    this.focusFirstInput();
  }

  ngOnDestroy() {
    // Nettoyage si nécessaire
  }

  focusFirstInput(): void {
    // Mettre le focus sur le premier input après un court délai pour s'assurer que la vue est rendue
    setTimeout(() => {
      const inputs = this.letterInputElements.toArray();
      if (inputs.length > 0 && inputs[0]) {
        inputs[0].nativeElement.focus();
      }
    }, 100);
  }

  async ngOnInit() {
    await this.loadSentences();
  }

  async loadSentences() {
    this.isLoading = true;
    this.sentences = [];
    this.sentencePromises.clear();
    
    try {
      // Initialiser le tableau de phrases avec des valeurs null
      this.sentences = new Array(this.words.length).fill(null);
      
      // Charger immédiatement la première phrase
      await this.loadSentenceForIndex(0);
      
      // Charger la première phrase dans le composant
      if (this.sentences[0]) {
        this.currentSentence = this.sentences[0];
        this.initializeLetterInputs();
        setTimeout(() => {
          this.focusFirstInput();
        }, 200);
      }
      
      // Charger les phrases suivantes en arrière-plan (lazy loading)
      this.preloadNextSentences();
    } catch (error) {
      console.error('Error loading sentences:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Charge une phrase pour un index spécifique
   */
  private async loadSentenceForIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.words.length) {
      return;
    }

    // Si la phrase est déjà chargée, ne rien faire
    if (this.sentences[index]) {
      return;
    }

    // Si une promesse de chargement existe déjà, attendre qu'elle se termine
    if (this.sentencePromises.has(index)) {
      await this.sentencePromises.get(index);
      return;
    }

    const word = this.words[index];
    if (!word) {
      return;
    }

    // Créer une promesse pour charger cette phrase
    const promise = (async () => {
      try {
        // Récupérer le contexte (description de la leçon)
        const context = await this.getLessonDescription(word.lesson_id);
        
        let sentence: FillInTheBlankSentence;
        
        if (this.direction === 'dutch_to_french') {
          // Phrase en néerlandais avec mot néerlandais manquant
          // On passe aussi la traduction française pour clarifier le contexte
          sentence = await this.deepSeekService.getOrGenerateFillInTheBlankSentence(
            word.id,
            word.dutch_text,
            'dutch_to_french',
            [],
            word.french_text,
            context
          );
        } else {
          // Phrase en français avec mot français manquant
          sentence = await this.deepSeekService.getOrGenerateFillInTheBlankSentence(
            word.id,
            word.french_text,
            'french_to_dutch',
            [],
            undefined,
            context
          );
        }
        
        // Stocker la phrase dans le tableau
        this.sentences[index] = sentence;
        return sentence;
      } catch (error) {
        console.error(`Error loading sentence for index ${index}:`, error);
        // En cas d'erreur, créer une phrase de fallback
        const fallbackSentence: FillInTheBlankSentence = {
          sentence: `_____`,
          missingWord: this.direction === 'dutch_to_french' ? word.dutch_text : word.french_text
        };
        this.sentences[index] = fallbackSentence;
        return fallbackSentence;
      } finally {
        // Retirer la promesse une fois terminée
        this.sentencePromises.delete(index);
      }
    })();

    // Stocker la promesse
    this.sentencePromises.set(index, promise);
    
    // Attendre que la promesse se termine
    await promise;
  }

  /**
   * Précharge les phrases suivantes en arrière-plan
   */
  private preloadNextSentences(): void {
    // Précharger les 2-3 prochaines phrases en arrière-plan
    for (let i = 1; i < Math.min(4, this.words.length); i++) {
      // Ne pas bloquer, charger en arrière-plan
      this.loadSentenceForIndex(i).catch(error => {
        console.error(`Error preloading sentence ${i}:`, error);
      });
    }
  }

  /**
   * Récupère la description de la leçon (contexte) pour un mot
   */
  private async getLessonDescription(lessonId: string): Promise<string | undefined> {
    // Vérifier le cache d'abord
    if (this.lessonDescriptions.has(lessonId)) {
      return this.lessonDescriptions.get(lessonId);
    }
    
    try {
      const lesson = await this.lessonService.getLessonById(lessonId);
      const description = lesson?.description;
      if (description) {
        this.lessonDescriptions.set(lessonId, description);
      }
      return description;
    } catch (error) {
      console.error('Error fetching lesson description:', error);
      return undefined;
    }
  }

  async checkAnswer() {
    if (this.showResult) return;
    
    const userAnswer = this.letterInputs.join('').trim();
    if (!userAnswer) return;
    
    const currentWord = this.words[this.currentIndex];
    const correctAnswer = this.getCorrectAnswer();
    
    this.isCorrect = this.normalizeLetter(userAnswer) === this.normalizeLetter(correctAnswer);
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
        this.direction,
        userAnswer,
        correctAnswer,
        this.isCorrect
      );
    }
  }

  async skipQuestion(): Promise<void> {
    // Si c'est le dernier mot, afficher les options de fin d'exercice
    if (this.currentIndex === this.words.length - 1) {
      // Afficher la section de résultat avec les options de fin
      this.showResult = true;
      this.isCorrect = false;
      // Ne pas incrémenter le score car on passe sans valider
    } else {
      // Passer au mot suivant sans valider
      await this.nextQuestion();
    }
  }

  async previousQuestion() {
    if (this.currentIndex > 0) {
      const prevIndex = this.currentIndex - 1;
      
      // Vérifier si la phrase précédente est déjà chargée
      if (!this.sentences[prevIndex]) {
        // Si la phrase n'est pas encore chargée, attendre qu'elle soit prête
        this.isLoadingNext = true;
        try {
          await this.loadSentenceForIndex(prevIndex);
        } catch (error) {
          console.error('Error loading previous sentence:', error);
        } finally {
          this.isLoadingNext = false;
        }
      }
      
      // Passer à la phrase précédente
      this.currentIndex = prevIndex;
      this.currentSentence = this.sentences[this.currentIndex];
      this.userInput = '';
      this.showResult = false;
      this.isCorrect = false;
      this.initializeLetterInputs();
      // Mettre le focus sur le premier input du nouveau mot
      this.focusFirstInput();
    }
  }

  async nextQuestion() {
    if (this.currentIndex < this.words.length - 1) {
      const nextIndex = this.currentIndex + 1;
      
      // Vérifier si la phrase suivante est déjà chargée
      if (!this.sentences[nextIndex]) {
        // Si la phrase n'est pas encore chargée, attendre qu'elle soit prête
        this.isLoadingNext = true;
        try {
          await this.loadSentenceForIndex(nextIndex);
        } catch (error) {
          console.error('Error loading next sentence:', error);
        } finally {
          this.isLoadingNext = false;
        }
      }
      
      // Précharger les phrases suivantes en arrière-plan
      const preloadIndex = nextIndex + 1;
      if (preloadIndex < this.words.length) {
        this.loadSentenceForIndex(preloadIndex).catch(error => {
          console.error(`Error preloading sentence ${preloadIndex}:`, error);
        });
      }
      
      // Passer à la phrase suivante
      this.currentIndex = nextIndex;
      this.currentSentence = this.sentences[this.currentIndex];
      this.userInput = '';
      this.showResult = false;
      this.isCorrect = false;
      this.initializeLetterInputs();
      // Mettre le focus sur le premier input du nouveau mot
      this.focusFirstInput();
    } else {
      // Si on est déjà au dernier mot, afficher les options de fin
      this.showResult = true;
      this.isCorrect = false;
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

  getCorrectAnswer(): string {
    const currentWord = this.words[this.currentIndex];
    if (!currentWord) return '';
    return this.direction === 'dutch_to_french' 
      ? currentWord.dutch_text 
      : currentWord.french_text;
  }

  /**
   * Retourne la traduction complète avec le mot manquant rempli
   */
  getCompleteTranslation(): string {
    if (!this.currentSentence?.translation) return '';
    
    const currentWord = this.words[this.currentIndex];
    if (!currentWord) return this.currentSentence.translation;
    
    // Remplacer le "_____" par le mot français manquant
    let translation = this.currentSentence.translation;
    
    if (this.direction === 'dutch_to_french') {
      // Le mot manquant est le mot français
      translation = translation
        .replace(/_____/g, currentWord.french_text)
        .replace(/\[MOT\]/gi, currentWord.french_text)
        .replace(/\{MOT\}/gi, currentWord.french_text);
    } else {
      // Le mot manquant est le mot néerlandais
      translation = translation
        .replace(/_____/g, currentWord.dutch_text)
        .replace(/\[MOT\]/gi, currentWord.dutch_text)
        .replace(/\{MOT\}/gi, currentWord.dutch_text);
    }
    
    return translation;
  }

  playAudio(): void {
    if (this.currentSentence && this.audioService.isSupported()) {
      // Reconstruire la phrase complète en remplaçant "_____" par le mot manquant
      const completeSentence = this.currentSentence.sentence.replace(/_____/g, this.currentSentence.missingWord)
        .replace(/\[MOT\]/gi, this.currentSentence.missingWord)
        .replace(/\{MOT\}/gi, this.currentSentence.missingWord);
      
      // Lire dans la langue selon la direction
      if (this.direction === 'dutch_to_french') {
        // Phrase en néerlandais
        this.audioService.speak(completeSentence, 'nl-NL');
      } else {
        // Phrase en français
        this.audioService.speak(completeSentence, 'fr-FR');
      }
    }
  }

  playTranslationAudio(): void {
    if (this.currentSentence?.translation && this.audioService.isSupported()) {
      // Lire uniquement le mot français à chercher
      const currentWord = this.words[this.currentIndex];
      if (currentWord && this.direction === 'dutch_to_french') {
        // Lire seulement le mot français manquant
        this.audioService.speak(currentWord.french_text, 'fr-FR');
      }
    }
  }

  initializeLetterInputs(): void {
    const correctAnswer = this.getCorrectAnswer();
    this.letterInputs = new Array(correctAnswer.length).fill('');
  }

  getLetterStatus(index: number): 'correct' | 'incorrect' | 'empty' {
    if (this.showResult) {
      const correctAnswer = this.getCorrectAnswer();
      const userLetter = this.letterInputs[index] || '';
      const correctLetter = correctAnswer[index] || '';
      
      if (!userLetter) return 'empty';
      return this.normalizeLetter(userLetter) === this.normalizeLetter(correctLetter) ? 'correct' : 'incorrect';
    }
    
    // En temps réel pendant la saisie
    const correctAnswer = this.getCorrectAnswer();
    const userLetter = this.letterInputs[index] || '';
    const correctLetter = correctAnswer[index] || '';
    
    if (!userLetter) return 'empty';
    return this.normalizeLetter(userLetter) === this.normalizeLetter(correctLetter) ? 'correct' : 'incorrect';
  }

  getCorrectLettersCount(): number {
    const correctAnswer = this.getCorrectAnswer();
    let count = 0;
    for (let i = 0; i < correctAnswer.length; i++) {
      const userLetter = this.letterInputs[i] || '';
      const correctLetter = correctAnswer[i] || '';
      if (this.normalizeLetter(userLetter) === this.normalizeLetter(correctLetter)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Trouve le premier index avec une lettre incorrecte
   * Retourne -1 si toutes les lettres sont correctes ou vides
   */
  getFirstIncorrectIndex(): number {
    const correctAnswer = this.getCorrectAnswer();
    for (let i = 0; i < correctAnswer.length; i++) {
      const userLetter = this.letterInputs[i] || '';
      const correctLetter = correctAnswer[i] || '';
      if (userLetter && this.normalizeLetter(userLetter) !== this.normalizeLetter(correctLetter)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Vérifie si un input à un index donné peut être modifié
   * Un input ne peut être modifié que si tous les inputs précédents sont corrects
   */
  canEditInput(index: number): boolean {
    const correctAnswer = this.getCorrectAnswer();
    // Vérifier que tous les inputs précédents sont corrects
    for (let i = 0; i < index; i++) {
      const userLetter = this.letterInputs[i] || '';
      const correctLetter = correctAnswer[i] || '';
      if (!userLetter || this.normalizeLetter(userLetter) !== this.normalizeLetter(correctLetter)) {
        return false;
      }
    }
    return true;
  }

  onLetterInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    // Ne garder que la dernière lettre si plusieurs caractères sont entrés
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    // Vérifier si la lettre est correcte AVANT de mettre à jour le tableau
    const correctAnswer = this.getCorrectAnswer();
    const isCorrect = this.normalizeLetter(value) === this.normalizeLetter(correctAnswer[index] || '');
    
    // Mettre à jour uniquement cet index dans le tableau
    const newLetterInputs = [...this.letterInputs];
    newLetterInputs[index] = value;
    this.letterInputs = newLetterInputs;
    
    // Forcer la mise à jour de la valeur de l'input actuel immédiatement
    input.value = value;
    
    // Vider tous les inputs suivants si la lettre actuelle est incorrecte
    if (!isCorrect && value) {
      for (let i = index + 1; i < this.letterInputs.length; i++) {
        newLetterInputs[i] = '';
      }
      this.letterInputs = newLetterInputs;
    }
    
    // S'assurer que les autres inputs ne sont PAS affectés par le binding
    setTimeout(() => {
      const inputs = this.letterInputElements.toArray();
      // Vérifier et corriger chaque input pour s'assurer qu'il correspond au tableau
      inputs.forEach((inputRef, i) => {
        const expectedValue = this.letterInputs[i] || '';
        if (inputRef.nativeElement.value !== expectedValue && i !== index) {
          // Si la valeur de l'input ne correspond pas au tableau, la corriger
          inputRef.nativeElement.value = expectedValue;
        }
      });
      
      // Trouver le premier input incorrect
      const firstIncorrectIndex = this.getFirstIncorrectIndex();
      
      // IMPORTANT: Ne passer au suivant QUE si la lettre est correcte ET qu'il n'y a pas d'erreur avant
      if (value && isCorrect && firstIncorrectIndex === -1 && index < this.letterInputs.length - 1) {
        // Vider explicitement l'input suivant dans le tableau
        const updatedInputs = [...this.letterInputs];
        updatedInputs[index + 1] = '';
        this.letterInputs = updatedInputs;
        
        if (inputs[index + 1]) {
          const nextInput = inputs[index + 1].nativeElement;
          // S'assurer que l'input suivant est vide
          nextInput.value = '';
          nextInput.focus();
        }
      } else {
        // Si la lettre est incorrecte, forcer le focus sur le premier input incorrect
        if (firstIncorrectIndex !== -1) {
          const incorrectInput = inputs[firstIncorrectIndex];
          if (incorrectInput) {
            incorrectInput.nativeElement.focus();
            incorrectInput.nativeElement.select();
          }
        } else if (!isCorrect && value) {
          // Si cette lettre est incorrecte, garder le focus dessus
          input.focus();
          input.select();
        } else if (!value) {
          // Si l'input est vide, garder le focus
          input.focus();
        }
      }
      
      // Vérifier si tous les inputs sont remplis ET corrects pour valider automatiquement
      if (this.isWordCompleteAndCorrect()) {
        // Attendre un peu pour que l'utilisateur voie la dernière lettre correcte
        setTimeout(() => {
          this.checkAnswer();
        }, 300);
      }
    }, 0);
    
    // Vérifier si tous les inputs sont remplis pour activer le bouton vérifier
    this.userInput = this.letterInputs.join('');
  }

  /**
   * Vérifie si le mot est complètement rempli et correct
   */
  isWordCompleteAndCorrect(): boolean {
    if (this.showResult) return false; // Ne pas valider si déjà validé
    
    const correctAnswer = this.getCorrectAnswer();
    if (this.letterInputs.length !== correctAnswer.length) return false;
    
    // Vérifier que tous les inputs sont remplis et corrects
    for (let i = 0; i < correctAnswer.length; i++) {
      const userLetter = this.letterInputs[i] || '';
      const correctLetter = correctAnswer[i] || '';
      if (!userLetter || this.normalizeLetter(userLetter) !== this.normalizeLetter(correctLetter)) {
        return false;
      }
    }
    
    return true;
  }

  onInputFocus(index: number, event: Event): void {
    // Empêcher le focus sur un input qui ne peut pas être modifié
    if (!this.canEditInput(index)) {
      event.preventDefault();
      const firstIncorrectIndex = this.getFirstIncorrectIndex();
      if (firstIncorrectIndex !== -1) {
        setTimeout(() => {
          const inputs = this.letterInputElements.toArray();
          if (inputs[firstIncorrectIndex]) {
            inputs[firstIncorrectIndex].nativeElement.focus();
            inputs[firstIncorrectIndex].nativeElement.select();
          }
        }, 0);
      }
    }
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    
    // Empêcher le collage (Ctrl+V)
    if (event.ctrlKey && event.key === 'v') {
      event.preventDefault();
      // Gérer le collage manuellement
      navigator.clipboard.readText().then(text => {
        if (text && text.length > 0) {
          const inputs = this.letterInputElements.toArray();
          // Distribuer les caractères dans les inputs
          for (let i = 0; i < text.length && (index + i) < this.letterInputs.length; i++) {
            const char = text[i].toUpperCase();
            this.letterInputs[index + i] = char;
            if (inputs[index + i]) {
              inputs[index + i].nativeElement.value = char;
            }
          }
        }
      });
      return;
    }
    
    // Gérer Backspace
    if (event.key === 'Backspace' && !input.value && index > 0) {
      event.preventDefault();
      const inputs = this.letterInputElements.toArray();
      if (inputs[index - 1]) {
        const prevInput = inputs[index - 1].nativeElement;
        prevInput.focus();
        prevInput.select();
      }
    }
    
    // Gérer les flèches
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      const inputs = this.letterInputElements.toArray();
      if (inputs[index - 1]) {
        inputs[index - 1].nativeElement.focus();
      }
    }
    
    if (event.key === 'ArrowRight' && index < this.letterInputs.length - 1) {
      event.preventDefault();
      const inputs = this.letterInputElements.toArray();
      if (inputs[index + 1]) {
        inputs[index + 1].nativeElement.focus();
      }
    }
    
    // Gérer Enter pour vérifier
    if (event.key === 'Enter') {
      event.preventDefault();
      this.checkAnswer();
    }
  }
}

