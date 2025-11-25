import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { ErrorSentence } from '../../../core/models/error-sentence.model';
import { WordItem } from '../../../core/models/error-sentence.model';
import { ErrorSentenceService } from '../../../core/services/error-sentence.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'app-find-error',
  imports: [CommonModule],
  templateUrl: './find-error.html',
  styleUrl: './find-error.css',
})
export class FindError implements OnInit, OnChanges, OnDestroy {
  private errorSentenceService = inject(ErrorSentenceService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  audioService = inject(AudioService);

  @Input() words: Word[] = [];
  @Input() direction: 'french_to_dutch' | 'dutch_to_french' = 'dutch_to_french';
  @Input() lessonId?: string; // ID de la leçon pour associer les phrases générées
  @Output() completed = new EventEmitter<{ correct: number; total: number }>();
  @Output() reverseRequested = new EventEmitter<void>();
  @Output() nextGameRequested = new EventEmitter<void>();

  private wordsLoaded = false;

  currentIndex = 0;
  currentErrorSentence: ErrorSentence | null = null;
  isLoading = false;
  isLoadingNext = false;
  errorSentences: ErrorSentence[] = [];
  errorSentencePromises: Map<number, Promise<ErrorSentence | null>> = new Map();

  // Tableaux pour le drag & drop
  sourceWords: WordItem[] = []; // Mots de la phrase avec erreur (tableau de départ)
  targetWords: (WordItem | null)[] = []; // Mots dans l'ordre à reconstruire (tableau final)
  unusedWords: WordItem[] = []; // Mots en trop qui ne font pas partie de la phrase correcte
  availableWords: WordItem[] = []; // Mots manquants de la phrase correcte (disponibles pour ajout)
  correctOrder: string[] = []; // Ordre correct des mots pour la validation
  wordValidity: boolean[] = []; // État de validité de chaque position

  score = { correct: 0, total: 0 };
  draggedWord: WordItem | null = null;
  draggedFromIndex: number = -1;
  draggedFromSource: boolean = false;
  draggedFromUnused: boolean = false; // Indique si le mot vient de unusedWords ou availableWords
  draggedFromAvailable: boolean = false; // Indique spécifiquement si le mot vient de availableWords
  showResult = false;
  isCorrect = false;

  /**
   * Découpe une phrase en mots en conservant la ponctuation
   */
  private splitSentenceIntoWords(sentence: string): string[] {
    return sentence.trim().split(/\s+/).filter(word => word.length > 0);
  }

  /**
   * Mélange un tableau de manière aléatoire (Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Normalise un mot pour la comparaison (minuscules, sans accents, sans ponctuation)
   */
  private normalizeWord(word: string): string {
    return word.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,!?;:]/g, '') // Supprimer la ponctuation pour la comparaison
      .trim();
  }

  /**
   * Normalise une phrase complète pour comparaison
   */
  private normalizeSentence(sentence: string): string {
    return sentence
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,!?;:]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async ngOnInit() {
    console.log('FindError ngOnInit - words:', this.words?.length || 0, 'direction:', this.direction);
    if (this.words && this.words.length > 0 && !this.wordsLoaded) {
      await this.loadErrorSentences();
      this.wordsLoaded = true;
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    // Si les mots changent ou la direction change, recharger
    if ((changes['words'] || changes['direction']) && this.words && this.words.length > 0) {
      console.log('FindError ngOnChanges - words changed:', this.words.length, 'direction:', this.direction);
      this.wordsLoaded = false;
      await this.loadErrorSentences();
      this.wordsLoaded = true;
    }
  }

  async loadErrorSentences() {
    this.isLoading = true;
    this.errorSentences = [];
    this.errorSentencePromises.clear();

    try {
      // Vérifier qu'il y a des mots
      if (!this.words || this.words.length === 0) {
        console.warn('No words provided to find-error component');
        this.isLoading = false;
        return;
      }

      console.log(`Loading error sentences for ${this.words.length} words, direction: ${this.direction}`);
      const wordIds = this.words.map(w => w.id);
      
      // 1. Charger les phrases existantes depuis la DB
      const errorSentencesData = await this.errorSentenceService.getErrorSentencesForLessonWords(
        wordIds,
        this.direction
      );

      console.log(`Found ${errorSentencesData.length} existing error sentences`);

      // 2. Initialiser le tableau avec des valeurs null
      this.errorSentences = new Array(this.words.length).fill(null);

      // 3. Associer les phrases existantes aux mots correspondants
      for (let i = 0; i < this.words.length; i++) {
        const word = this.words[i];
        const errorSentence = errorSentencesData.find(es => es.word_id === word.id);
        if (errorSentence) {
          this.errorSentences[i] = errorSentence;
        }
      }

      // 4. Générer automatiquement les phrases manquantes avec l'IA
      const generationPromises: Promise<void>[] = [];
      const wordsToGenerate: Word[] = [];
      
      for (let i = 0; i < this.words.length; i++) {
        // Si aucune phrase n'existe pour ce mot, générer automatiquement
        if (this.errorSentences[i] === null) {
          const word = this.words[i];
          wordsToGenerate.push(word);
          const promise = this.generateAndSaveErrorSentence(word, i);
          generationPromises.push(promise);
        }
      }

      console.log(`Generating ${wordsToGenerate.length} error sentences automatically`);

      // 5. Attendre que toutes les générations soient terminées
      if (generationPromises.length > 0) {
        await Promise.all(generationPromises);
        console.log(`Finished generating ${generationPromises.length} error sentences`);
      }

      // 6. Charger la première phrase disponible (existante ou nouvellement générée)
      const firstIndex = this.errorSentences.findIndex(es => es !== null);
      console.log(`First available error sentence index: ${firstIndex}`);
      
      if (firstIndex !== -1) {
        this.currentIndex = firstIndex;
        this.currentErrorSentence = this.errorSentences[firstIndex];
        this.prepareDragDropData();
      } else {
        console.warn('No error sentences available after generation');
      }
    } catch (error) {
      console.error('Error loading error sentences:', error);
      // Afficher l'erreur à l'utilisateur
      this.isLoading = false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Génère automatiquement une phrase avec erreur pour un mot et la sauvegarde dans la DB
   */
  private async generateAndSaveErrorSentence(word: Word, index: number): Promise<void> {
    try {
      const wordText = this.direction === 'dutch_to_french' ? word.dutch_text : word.french_text;
      const frenchTranslation = this.direction === 'dutch_to_french' ? word.french_text : undefined;

      console.log(`Generating error sentence for word: ${wordText} (${word.id})`);

      // Générer la phrase avec erreur via l'IA
      const generated = await this.errorSentenceService.generateErrorSentence(
        word.id,
        wordText,
        this.direction,
        this.lessonId,
        undefined, // Pas de type d'erreur spécifique, laisser l'IA choisir
        frenchTranslation
      );

      console.log(`Successfully generated error sentence for word ${word.id}:`, generated);

      // Stocker la phrase générée dans le tableau
      this.errorSentences[index] = generated;
    } catch (error) {
      console.error(`Error generating error sentence for word ${word.id} (${word.dutch_text}/${word.french_text}):`, error);
      // En cas d'erreur, laisser null pour ce mot (il sera ignoré dans le jeu)
      // Ne pas re-throw pour ne pas bloquer les autres générations
    }
  }

  /**
   * Prépare les données pour le drag & drop
   */
  private prepareDragDropData() {
    if (!this.currentErrorSentence) return;

    // 1. Découper la phrase AVEC erreur en mots
    const errorWords = this.splitSentenceIntoWords(this.currentErrorSentence.sentence_with_error);

    // 2. Découper la phrase CORRECTE en mots
    const correctWords = this.splitSentenceIntoWords(this.currentErrorSentence.sentence_correct);

    // 3. Créer les WordItems avec leurs positions
    this.sourceWords = errorWords.map((word, index) => {
      // Trouver la position correcte de ce mot dans la phrase correcte
      const correctIndex = correctWords.findIndex(w => 
        this.normalizeWord(w) === this.normalizeWord(word)
      );
      
      return {
        text: word,
        id: `word-${this.currentIndex}-${index}-${Date.now()}`,
        originalIndex: index,
        correctIndex: correctIndex !== -1 ? correctIndex : index
      };
    });

    // 4. Stocker l'ordre correct normalisé pour la comparaison
    this.correctOrder = correctWords.map(w => this.normalizeWord(w));

    // 5. Séparer les mots en 3 catégories :
    // - Mots présents dans les deux phrases (pour targetWords)
    // - Mots manquants dans la phrase avec erreur (pour availableWords)
    // - Mots en trop dans la phrase avec erreur (pour unusedWords)
    
    const wordsForTarget: WordItem[] = []; // Mots à placer dans la zone principale
    const wordsForAvailable: WordItem[] = []; // Mots manquants (disponibles)
    const wordsForUnused: WordItem[] = []; // Mots en trop (inutiles)
    const usedErrorWordIndices = new Set<number>(); // Pour éviter d'utiliser deux fois le même mot

    // 6. Parcourir la phrase CORRECTE et chercher chaque mot dans la phrase avec erreur
    correctWords.forEach((correctWord, correctIndex) => {
      const normalizedCorrect = this.normalizeWord(correctWord);
      
      // Chercher ce mot dans la phrase avec erreur (pas encore utilisé)
      const errorIndex = errorWords.findIndex((w, idx) => 
        this.normalizeWord(w) === normalizedCorrect && !usedErrorWordIndices.has(idx)
      );

      if (errorIndex !== -1) {
        // Ce mot existe dans la phrase avec erreur → l'utiliser dans targetWords
        usedErrorWordIndices.add(errorIndex);
        const wordItem: WordItem = {
          text: errorWords[errorIndex],
          id: `word-${this.currentIndex}-${errorIndex}-${Date.now()}`,
          originalIndex: errorIndex,
          correctIndex: correctIndex
        };
        wordsForTarget.push(wordItem);
      } else {
        // Ce mot n'existe pas dans la phrase avec erreur → mot manquant → availableWords
        const wordItem: WordItem = {
          text: correctWord,
          id: `word-missing-${this.currentIndex}-${correctIndex}-${Date.now()}`,
          originalIndex: -1, // Indique que c'est un mot manquant
          correctIndex: correctIndex
        };
        wordsForAvailable.push(wordItem);
      }
    });

    // 7. Les mots de la phrase avec erreur qui n'ont pas été utilisés → mots en trop → unusedWords
    errorWords.forEach((word, index) => {
      if (!usedErrorWordIndices.has(index)) {
        const wordItem: WordItem = {
          text: word,
          id: `word-unused-${this.currentIndex}-${index}-${Date.now()}`,
          originalIndex: index,
          correctIndex: -1
        };
        wordsForUnused.push(wordItem);
      }
    });

    // 8. Initialiser le tableau cible avec des emplacements vides (nombre = phrase correcte)
    this.targetWords = new Array(correctWords.length).fill(null);
    
    // 9. Placer les mots de la phrase avec erreur dans l'ordre initial (l'utilisateur devra les réordonner)
    // On place les mots dans l'ordre où ils apparaissent dans la phrase avec erreur
    let targetIndex = 0;
    errorWords.forEach((errorWord, errorIndex) => {
      if (usedErrorWordIndices.has(errorIndex) && targetIndex < this.targetWords.length) {
        const wordItem = wordsForTarget.find(w => w.originalIndex === errorIndex);
        if (wordItem) {
          this.targetWords[targetIndex] = wordItem;
          targetIndex++;
        }
      }
    });

    // 10. Initialiser les zones
    this.availableWords = wordsForAvailable; // Mots manquants
    this.unusedWords = wordsForUnused; // Mots en trop

    // 8. Initialiser la validité
    this.wordValidity = new Array(this.targetWords.length).fill(false);
    this.validateWords();
  }

  /**
   * Vérifie la validité de tous les mots placés
   */
  private validateWords() {
    // Réinitialiser le tableau de validité avec la bonne taille
    this.wordValidity = new Array(this.targetWords.length).fill(false);
    
    for (let i = 0; i < this.targetWords.length; i++) {
      const word = this.targetWords[i];
      if (word) {
        const normalizedWord = this.normalizeWord(word.text);
        // Comparer avec l'ordre correct à la position i
        if (i < this.correctOrder.length) {
          this.wordValidity[i] = normalizedWord === this.correctOrder[i];
        } else {
          // Si on a plus de mots que dans la phrase correcte, c'est incorrect
          this.wordValidity[i] = false;
        }
      } else {
        this.wordValidity[i] = false;
      }
    }
  }

  /**
   * Vérifie si tous les mots sont correctement placés
   */
  isAllCorrect(): boolean {
    if (this.targetWords.length === 0) return false;

    // Vérifier que tous les emplacements sont remplis
    if (this.targetWords.some(w => w === null)) {
      return false;
    }

    // Vérifier que le nombre de mots correspond
    if (this.targetWords.length !== this.correctOrder.length) {
      return false;
    }

    // Vérifier que tous sont corrects
    return this.wordValidity.every(v => v === true);
  }

  /**
   * Vérifie si tous les emplacements sont remplis (pour activer le bouton Vérifier)
   */
  isAllFilled(): boolean {
    if (this.targetWords.length === 0) return false;
    
    // Vérifier que tous les emplacements sont remplis
    if (this.targetWords.some(w => w === null)) {
      return false;
    }

    // Vérifier que le nombre de mots correspond
    if (this.targetWords.length !== this.correctOrder.length) {
      return false;
    }

    // Vérifier que les zones unusedWords et availableWords sont vides
    // (tous les mots doivent être dans targetWords)
    return this.unusedWords.length === 0 && this.availableWords.length === 0;
  }

  /**
   * Vérifie si la phrase complète est correcte
   */
  isSentenceCorrect(): boolean {
    const reconstructedSentence = this.targetWords
      .map(w => w ? w.text : '')
      .join(' ')
      .trim();

    if (!this.currentErrorSentence) return false;

    const normalizedReconstructed = this.normalizeSentence(reconstructedSentence);
    const normalizedCorrect = this.normalizeSentence(this.currentErrorSentence.sentence_correct);

    return normalizedReconstructed === normalizedCorrect;
  }

  /**
   * Gestion du drag start depuis le tableau source (plus utilisé mais gardé pour compatibilité)
   */
  onDragStartFromSource(event: DragEvent, word: WordItem, index: number) {
    // Cette fonction n'est plus utilisée car on réordonne directement dans targetWords
    // Mais on garde la compatibilité avec le HTML
    if (!event.dataTransfer) return;
    event.preventDefault();
  }

  /**
   * Gestion du drag start depuis le tableau cible
   */
  onDragStartFromTarget(event: DragEvent, word: WordItem, index: number) {
    if (!event.dataTransfer) return;

    this.draggedWord = word;
    this.draggedFromIndex = index;
    this.draggedFromSource = false;
    this.draggedFromUnused = false;

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', word.id);

    if (event.target) {
      (event.target as HTMLElement).style.opacity = '0.5';
    }
  }

  /**
   * Gestion du drag start depuis la zone des mots inutiles
   */
  onDragStartFromUnused(event: DragEvent, word: WordItem, index: number) {
    if (!event.dataTransfer) return;

    this.draggedWord = word;
    this.draggedFromIndex = index;
    this.draggedFromSource = false;
    this.draggedFromUnused = true;
    this.draggedFromAvailable = false;

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', word.id);

    if (event.target) {
      (event.target as HTMLElement).style.opacity = '0.5';
    }
  }

  /**
   * Gestion du drag end
   */
  onDragEnd(event: DragEvent) {
    if (event.target) {
      (event.target as HTMLElement).style.opacity = '1';
    }

    this.draggedWord = null;
    this.draggedFromIndex = -1;
    this.draggedFromUnused = false;
    this.draggedFromAvailable = false;
  }

  /**
   * Gestion du drag over sur le tableau source
   */
  onDragOverSource(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Gestion du drag over sur le tableau cible
   */
  onDragOverTarget(event: DragEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Gestion du drop sur le tableau source (plus utilisé mais gardé pour compatibilité)
   */
  onDropSource(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    // Cette fonction n'est plus utilisée car on réordonne directement dans targetWords
  }

  /**
   * Gestion du drop sur le tableau cible (réordonnancement des mots)
   */
  onDropTarget(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedWord) return;

    // Si le mot vient de la zone des mots disponibles (mots manquants)
    if (this.draggedFromAvailable) {
      const wordAtTarget = this.targetWords[targetIndex];
      this.targetWords[targetIndex] = this.draggedWord;
      
      // Retirer le mot de availableWords
      this.availableWords.splice(this.draggedFromIndex, 1);
      
      // Si il y avait un mot à cette position, le remettre dans la zone appropriée
      if (wordAtTarget) {
        if (wordAtTarget.originalIndex === -1) {
          // C'était un mot manquant, le remettre dans availableWords
          this.availableWords.push(wordAtTarget);
        } else {
          // C'était un mot de la phrase avec erreur, le mettre dans unusedWords
          this.unusedWords.push(wordAtTarget);
        }
      }
      
      this.validateWords();
      this.showResult = false;
      return;
    }

    // Si le mot vient de la zone des mots inutiles (mots en trop)
    if (this.draggedFromUnused && !this.draggedFromAvailable) {
      const wordAtTarget = this.targetWords[targetIndex];
      this.targetWords[targetIndex] = this.draggedWord;
      this.unusedWords.splice(this.draggedFromIndex, 1);
      
      // Si il y avait un mot à cette position, le remettre dans la zone appropriée
      if (wordAtTarget) {
        if (wordAtTarget.originalIndex === -1) {
          // C'était un mot manquant, le remettre dans availableWords
          this.availableWords.push(wordAtTarget);
        } else {
          // C'était un mot de la phrase avec erreur, le mettre dans unusedWords
          this.unusedWords.push(wordAtTarget);
        }
      }
      
      this.validateWords();
      this.showResult = false;
      return;
    }

    // Si on déplace un mot vers sa propre position, ne rien faire
    if (!this.draggedFromSource && !this.draggedFromUnused && this.draggedFromIndex === targetIndex) {
      return;
    }

    // Échanger les mots dans targetWords (réordonnancement)
    const wordAtTarget = this.targetWords[targetIndex];
    this.targetWords[targetIndex] = this.draggedWord;
    this.targetWords[this.draggedFromIndex] = wordAtTarget;

    this.validateWords();
    this.showResult = false; // Réinitialiser le résultat pour permettre de nouvelles tentatives
  }

  /**
   * Gestion du drop sur la zone des mots inutiles
   */
  onDropUnused(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedWord) return;

    // Si le mot vient déjà de la zone inutile, ne rien faire
    if (this.draggedFromUnused && this.draggedWord.originalIndex !== -1) {
      return;
    }

    // Si c'est un mot manquant (originalIndex === -1), ne pas le mettre dans unusedWords
    // Les mots manquants doivent rester dans availableWords
    if (this.draggedWord.originalIndex === -1) {
      return;
    }

    // Retirer le mot de targetWords et l'ajouter à unusedWords
    this.targetWords[this.draggedFromIndex] = null;
    this.unusedWords.push(this.draggedWord);

    this.validateWords();
    this.showResult = false;
  }

  /**
   * Gestion du drag over sur la zone des mots inutiles
   */
  onDragOverUnused(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Gestion du drag start depuis la zone des mots disponibles
   */
  onDragStartFromAvailable(event: DragEvent, word: WordItem, index: number) {
    if (!event.dataTransfer) return;

    this.draggedWord = word;
    this.draggedFromIndex = index;
    this.draggedFromSource = false;
    this.draggedFromUnused = true; // Pour indiquer que ça vient d'une zone secondaire
    this.draggedFromAvailable = true; // Spécifique pour availableWords

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', word.id);

    if (event.target) {
      (event.target as HTMLElement).style.opacity = '0.5';
    }
  }

  /**
   * Gestion du drop sur la zone des mots disponibles
   */
  onDropAvailable(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedWord) return;

    // Si le mot vient déjà de la zone disponible, ne rien faire
    if (this.draggedFromAvailable) {
      return;
    }

    // Seuls les mots manquants (originalIndex === -1) peuvent être dans availableWords
    // Si on glisse un mot normal ici, ne rien faire (il doit aller dans unusedWords)
    if (this.draggedWord.originalIndex !== -1) {
      return;
    }

    // Retirer le mot de targetWords et le remettre dans availableWords
    this.targetWords[this.draggedFromIndex] = null;
    
    // Vérifier si le mot n'est pas déjà dans availableWords
    if (!this.availableWords.find(w => w.id === this.draggedWord!.id)) {
      this.availableWords.push(this.draggedWord);
    }

    this.validateWords();
    this.showResult = false;
  }

  /**
   * Gestion du drag over sur la zone des mots disponibles
   */
  onDragOverAvailable(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Récupère le statut d'un mot dans le tableau cible
   */
  getWordStatus(index: number): 'correct' | 'incorrect' | 'empty' {
    if (this.targetWords[index] === null) {
      return 'empty';
    }
    return this.wordValidity[index] ? 'correct' : 'incorrect';
  }

  /**
   * Joue l'audio de la phrase correcte
   */
  playAudio() {
    if (this.currentErrorSentence && this.audioService.isSupported()) {
      const language = this.direction === 'dutch_to_french' ? 'nl-NL' : 'fr-FR';
      this.audioService.speak(this.currentErrorSentence.sentence_correct, language);
    }
  }

  /**
   * Vérifie la réponse et passe à la suivante
   */
  async checkAnswer() {
    if (this.showResult) return;

    if (!this.currentErrorSentence) return;

    const userAnswer = this.targetWords
      .map(w => w ? w.text : '')
      .join(' ')
      .trim();

    const correctAnswer = this.currentErrorSentence.sentence_correct;

    this.isCorrect = this.isSentenceCorrect();
    this.showResult = true;
    this.score.total++;

    if (this.isCorrect) {
      this.score.correct++;
    }

    // Enregistrer la tentative
    const user = this.authService.getCurrentUser();
    if (user) {
      const word = this.words[this.currentIndex];
      if (word) {
        await this.progressService.recordQuizAttempt(
          user.id,
          word.id,
          'find_error',
          this.direction,
          userAnswer,
          correctAnswer,
          this.isCorrect
        );
      }
    }
  }

  /**
   * Passe à la phrase suivante
   */
  async nextQuestion() {
    if (this.currentIndex < this.words.length - 1) {
      // Mettre à jour le score pour la phrase actuelle
      if (this.isAllCorrect()) {
        this.score.correct++;
      }
      this.score.total++;

      this.currentIndex++;
      
      // Trouver la prochaine phrase avec erreur disponible
      let nextIndex = this.currentIndex;
      while (nextIndex < this.words.length && this.errorSentences[nextIndex] === null) {
        nextIndex++;
      }

      if (nextIndex < this.words.length) {
        this.currentIndex = nextIndex;
        this.currentErrorSentence = this.errorSentences[this.currentIndex];
        this.showResult = false;
        this.isCorrect = false;
        this.prepareDragDropData();
      } else {
        // Plus de phrases disponibles, terminer
        this.completed.emit(this.score);
      }
    } else {
      // Dernière phrase, terminer l'exercice
      this.completed.emit(this.score);
    }
  }

  /**
   * Retourne à la phrase précédente
   */
  async previousQuestion() {
    if (this.currentIndex > 0) {
      // Trouver la phrase précédente avec erreur disponible
      let prevIndex = this.currentIndex - 1;
      while (prevIndex >= 0 && this.errorSentences[prevIndex] === null) {
        prevIndex--;
      }

      if (prevIndex >= 0) {
        this.currentIndex = prevIndex;
        this.currentErrorSentence = this.errorSentences[this.currentIndex];
        this.showResult = false;
        this.isCorrect = false;
        this.prepareDragDropData();
      }
    }
  }

  ngOnDestroy() {
    // Nettoyage si nécessaire
  }

  /**
   * Récupère le mot actuel
   */
  getCurrentWord(): Word | null {
    return this.words[this.currentIndex] || null;
  }

  /**
   * Passe la question
   */
  async skipQuestion() {
    if (this.currentIndex === this.words.length - 1) {
      this.showResult = true;
      this.isCorrect = false;
    } else {
      await this.nextQuestion();
    }
  }
}

