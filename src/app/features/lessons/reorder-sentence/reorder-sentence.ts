import { Component, Input, Output, EventEmitter, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Word } from '../../../core/models/word.model';
import { DeepSeekService, FillInTheBlankSentence } from '../../../core/services/deepseek.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AudioService } from '../../../core/services/audio.service';
import { LessonService } from '../../../core/services/lesson.service';

interface WordItem {
  text: string;
  id: string; // Identifiant unique pour le tracking
}

@Component({
  selector: 'app-reorder-sentence',
  imports: [CommonModule],
  templateUrl: './reorder-sentence.html',
  styleUrl: './reorder-sentence.css',
})
export class ReorderSentence implements OnInit, OnDestroy {
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

  currentIndex = 0;
  currentSentence: FillInTheBlankSentence | null = null;
  isLoading = false;
  isLoadingNext = false;
  sentences: FillInTheBlankSentence[] = [];
  sentencePromises: Map<number, Promise<FillInTheBlankSentence>> = new Map();

  // Tableaux pour le drag & drop
  sourceWords: WordItem[] = []; // Mots mélangés (tableau de départ)
  targetWords: (WordItem | null)[] = []; // Mots dans l'ordre à reconstruire (tableau final)
  correctOrder: string[] = []; // Ordre correct des mots pour la validation
  wordValidity: boolean[] = []; // État de validité de chaque position

  score = { correct: 0, total: 0 };
  draggedWord: WordItem | null = null;
  draggedFromIndex: number = -1;
  draggedFromSource: boolean = false;

  /**
   * Découpe une phrase en mots en conservant la ponctuation
   */
  private splitSentenceIntoWords(sentence: string): string[] {
    // Découper par espaces et conserver la ponctuation avec les mots
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
   * Normalise un mot pour la comparaison (minuscules, sans accents)
   */
  private normalizeWord(word: string): string {
    return word.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  async ngOnInit() {
    await this.loadSentences();
  }

  ngOnDestroy() {
    // Nettoyage si nécessaire
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
      
      // Initialiser la première phrase
      if (this.sentences[0]) {
        this.currentSentence = this.sentences[0];
        this.initializeWords();
      }
      
      // Précharger les phrases suivantes
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
          // Phrase en néerlandais
          sentence = await this.deepSeekService.getOrGenerateFillInTheBlankSentence(
            word.id,
            word.dutch_text,
            'dutch_to_french',
            [],
            word.french_text,
            context
          );
        } else {
          // Phrase en français
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
          sentence: this.direction === 'dutch_to_french' ? word.dutch_text : word.french_text,
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
  private preloadNextSentences() {
    for (let i = 1; i < Math.min(this.words.length, this.currentIndex + 4); i++) {
      const index = this.currentIndex + i;
      if (index < this.words.length && !this.sentences[index]) {
        this.loadSentenceForIndex(index);
      }
    }
  }

  /**
   * Initialise les tableaux de mots à partir de la phrase actuelle
   */
  private initializeWords() {
    if (!this.currentSentence) return;

    // Reconstruire la phrase complète en remplaçant "_____" par le mot manquant
    let completeSentence = this.currentSentence.sentence.replace(/_____/g, this.currentSentence.missingWord);
    
    // Supprimer le dernier point s'il existe
    completeSentence = completeSentence.trim().replace(/\.$/, '');
    
    const words = this.splitSentenceIntoWords(completeSentence);
    this.correctOrder = words.map(w => this.normalizeWord(w));
    
    // Créer les items avec des IDs uniques
    const wordItems: WordItem[] = words.map((word, index) => ({
      text: word,
      id: `word-${this.currentIndex}-${index}-${Date.now()}`
    }));

    // Mélanger les mots pour le tableau de départ
    this.sourceWords = this.shuffleArray(wordItems);
    
    // Initialiser le tableau final avec des valeurs null
    this.targetWords = new Array(words.length).fill(null);
    
    // Initialiser la validité
    this.wordValidity = new Array(words.length).fill(false);

    console.log('[DEBUG] Initialisation des mots:', {
      phraseOriginale: this.currentSentence.sentence,
      phraseComplete: completeSentence,
      motManquant: this.currentSentence.missingWord,
      motsCorrects: this.correctOrder,
      motsMelanges: this.sourceWords.map(w => w.text),
      tableauFinal: this.targetWords.map(w => w ? w.text : null)
    });
  }

  /**
   * Vérifie la validité de tous les mots placés
   */
  private validateWords() {
    for (let i = 0; i < this.targetWords.length; i++) {
      const word = this.targetWords[i];
      if (word) {
        const normalizedWord = this.normalizeWord(word.text);
        this.wordValidity[i] = normalizedWord === this.correctOrder[i];
      } else {
        this.wordValidity[i] = false;
      }
    }

    console.log('[DEBUG] Validation:', {
      tableauFinal: this.targetWords.map((w, i) => ({
        mot: w ? w.text : null,
        position: i,
        correct: this.wordValidity[i],
        attendu: this.correctOrder[i]
      })),
      tableauDepart: this.sourceWords.map(w => w.text),
      tousCorrects: this.isAllCorrect()
    });
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

    // Vérifier que tous sont corrects
    return this.wordValidity.every(v => v === true);
  }

  /**
   * Gestion du drag start depuis le tableau source
   */
  onDragStartFromSource(event: DragEvent, word: WordItem, index: number) {
    if (!event.dataTransfer) return;
    
    this.draggedWord = word;
    this.draggedFromIndex = index;
    this.draggedFromSource = true;
    
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', word.id);
    
    // Réduire l'opacité de l'élément pendant le drag
    if (event.target) {
      (event.target as HTMLElement).style.opacity = '0.5';
    }

    console.log('[DEBUG] Drag start depuis source:', {
      mot: word.text,
      indexSource: index,
      tableauSource: this.sourceWords.map(w => w.text)
    });
  }

  /**
   * Gestion du drag start depuis le tableau cible
   */
  onDragStartFromTarget(event: DragEvent, word: WordItem, index: number) {
    if (!event.dataTransfer) return;
    
    this.draggedWord = word;
    this.draggedFromIndex = index;
    this.draggedFromSource = false;
    
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', word.id);
    
    // Réduire l'opacité de l'élément pendant le drag
    if (event.target) {
      (event.target as HTMLElement).style.opacity = '0.5';
    }

    console.log('[DEBUG] Drag start depuis target:', {
      mot: word.text,
      indexTarget: index,
      tableauTarget: this.targetWords.map(w => w ? w.text : null)
    });
  }

  /**
   * Gestion du drag end
   */
  onDragEnd(event: DragEvent) {
    // Restaurer l'opacité
    if (event.target) {
      (event.target as HTMLElement).style.opacity = '1';
    }
    
    this.draggedWord = null;
    this.draggedFromIndex = -1;
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
   * Gestion du drop sur le tableau source
   */
  onDropSource(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedWord) return;

    // Si on vient du tableau source, ne rien faire (déjà à la bonne place)
    if (this.draggedFromSource && this.draggedFromIndex === targetIndex) {
      return;
    }

    // Si on vient du tableau cible, remettre le mot dans le tableau source
    if (!this.draggedFromSource) {
      // Retirer le mot du tableau cible
      this.targetWords[this.draggedFromIndex] = null;
      
      // Ajouter le mot au tableau source à la position targetIndex
      this.sourceWords.splice(targetIndex, 0, this.draggedWord);
      
      // Valider après le déplacement
      this.validateWords();
      
      console.log('[DEBUG] Drop sur source:', {
        mot: this.draggedWord.text,
        depuisIndex: this.draggedFromIndex,
        versIndex: targetIndex,
        tableauSource: this.sourceWords.map(w => w.text),
        tableauTarget: this.targetWords.map(w => w ? w.text : null)
      });
    }
  }

  /**
   * Gestion du drop sur le tableau cible
   */
  onDropTarget(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedWord) return;

    // Si on déplace vers la même position, ne rien faire
    if (!this.draggedFromSource && this.draggedFromIndex === targetIndex) {
      return;
    }

    // Si l'emplacement cible est occupé, échanger les mots
    if (this.targetWords[targetIndex] !== null) {
      // Échanger les positions
      const wordAtTarget = this.targetWords[targetIndex];
      
      if (this.draggedFromSource) {
        // On vient du tableau source : remplacer le mot dans le tableau cible et remettre l'ancien dans le source
        this.targetWords[targetIndex] = this.draggedWord;
        this.sourceWords.splice(this.draggedFromIndex, 1);
        // Ajouter le mot qui était à la position cible dans le tableau source
        if (wordAtTarget) {
          this.sourceWords.push(wordAtTarget);
        }
      } else {
        // On vient du tableau cible : échanger les deux mots
        this.targetWords[targetIndex] = this.draggedWord;
        this.targetWords[this.draggedFromIndex] = wordAtTarget;
      }
    } else {
      // L'emplacement est vide, placer le mot normalement
      this.targetWords[targetIndex] = this.draggedWord;

      // Retirer le mot du tableau source ou du tableau cible
      if (this.draggedFromSource) {
        // Retirer du tableau source
        this.sourceWords.splice(this.draggedFromIndex, 1);
      } else {
        // Retirer de l'ancienne position dans le tableau cible
        this.targetWords[this.draggedFromIndex] = null;
      }
    }

    // Valider après le déplacement
    this.validateWords();

    console.log('[DEBUG] Drop sur target:', {
      mot: this.draggedWord.text,
      depuisSource: this.draggedFromSource,
      depuisIndex: this.draggedFromIndex,
      versIndex: targetIndex,
      emplacementOccupe: this.targetWords[targetIndex] !== null,
      tableauSource: this.sourceWords.map(w => w.text),
      tableauTarget: this.targetWords.map(w => w ? w.text : null),
      validite: this.wordValidity
    });
  }

  /**
   * Joue l'audio de la phrase complète
   */
  playAudio() {
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

  /**
   * Joue l'audio de la traduction en français
   */
  playTranslationAudio() {
    if (this.currentSentence?.translation && this.audioService.isSupported()) {
      // Lire la traduction en français
      this.audioService.speak(this.currentSentence.translation, 'fr-FR');
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

  /**
   * Passe à la phrase suivante
   */
  async nextQuestion() {
    // Mettre à jour le score pour la phrase actuelle avant de passer à la suivante
    if (this.isAllCorrect()) {
      this.score.correct++;
    }
    this.score.total++;

    if (this.currentIndex >= this.words.length - 1) {
      // Dernière phrase, terminer l'exercice
      this.completed.emit(this.score);
      return;
    }

    this.isLoadingNext = true;
    
    try {
      // Passer à la phrase suivante
      this.currentIndex++;
      
      // Charger la phrase suivante si nécessaire
      await this.loadSentenceForIndex(this.currentIndex);
      
      // Initialiser les mots pour la nouvelle phrase
      if (this.sentences[this.currentIndex]) {
        this.currentSentence = this.sentences[this.currentIndex];
        this.initializeWords();
      }

      // Précharger les phrases suivantes
      this.preloadNextSentences();
    } catch (error) {
      console.error('Error loading next question:', error);
    } finally {
      this.isLoadingNext = false;
    }
  }

  /**
   * Retourne à la phrase précédente
   */
  async previousQuestion() {
    if (this.currentIndex === 0) return;

    this.isLoadingNext = true;
    
    try {
      this.currentIndex--;
      
      // Charger la phrase précédente si nécessaire
      await this.loadSentenceForIndex(this.currentIndex);
      
      // Initialiser les mots pour la phrase précédente
      if (this.sentences[this.currentIndex]) {
        this.currentSentence = this.sentences[this.currentIndex];
        this.initializeWords();
      }
    } catch (error) {
      console.error('Error loading previous question:', error);
    } finally {
      this.isLoadingNext = false;
    }
  }

  /**
   * Récupère le mot actuel
   */
  getCurrentWord(): Word | null {
    return this.words[this.currentIndex] || null;
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
   * Termine l'exercice en mettant à jour le score de la dernière phrase
   */
  finishExercise() {
    // Mettre à jour le score pour la dernière phrase
    if (this.isAllCorrect()) {
      this.score.correct++;
    }
    this.score.total++;
    
    // Émettre l'événement de complétion
    this.completed.emit(this.score);
  }
}

