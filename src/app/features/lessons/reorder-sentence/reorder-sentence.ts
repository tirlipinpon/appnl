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
  originalWordItems: WordItem[] = []; // Référence aux mots originaux pour l'aide
  originalWords: string[] = []; // Référence aux mots originaux (texte) pour l'aide

  score = { correct: 0, total: 0 };
  draggedWord: WordItem | null = null;
  draggedFromIndex: number = -1;
  draggedFromSource: boolean = false;
  helpUsedCount = 0; // Nombre de fois que l'aide a été utilisée pour la phrase actuelle
  maxHelpCount = 3; // Nombre maximum de fois que l'aide peut être utilisée
  
  // Propriétés pour l'aide du mot
  showHelpExplanation = false;
  helpExplanation = '';
  isLoadingHelp = false;
  helpError: string | null = null;

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

    // Sauvegarder les références originales pour l'aide
    this.originalWordItems = [...wordItems];
    this.originalWords = [...words];

    // Réinitialiser le compteur d'aide pour la nouvelle phrase
    this.helpUsedCount = 0;

    // Initialiser le tableau final avec des valeurs null
    this.targetWords = new Array(words.length).fill(null);
    
    // Initialiser la validité
    this.wordValidity = new Array(words.length).fill(false);

    // Si la phrase a plus de 10 mots, pré-placer stratégiquement certains mots
    if (words.length > 10) {
      this.prePlaceWords(wordItems, words);
    } else {
      // Mélanger tous les mots pour le tableau de départ
      this.sourceWords = this.shuffleArray(wordItems);
    }

    console.log('[DEBUG] Initialisation des mots:', {
      phraseOriginale: this.currentSentence.sentence,
      phraseComplete: completeSentence,
      motManquant: this.currentSentence.missingWord,
      motsCorrects: this.correctOrder,
      motsMelanges: this.sourceWords.map(w => w.text),
      tableauFinal: this.targetWords.map(w => w ? w.text : null),
      motsPreplaces: words.length > 10 ? this.targetWords.filter(w => w !== null).length : 0
    });
  }

  /**
   * Vérifie si un mot est un article défini/indéfini
   */
  private isArticle(word: string): boolean {
    const normalized = this.normalizeWord(word);
    const articles = this.direction === 'dutch_to_french' 
      ? ['de', 'het', 'een', 'een'] // Néerlandais
      : ['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de']; // Français
    return articles.includes(normalized);
  }

  /**
   * Vérifie si un mot est une préposition
   */
  private isPreposition(word: string): boolean {
    const normalized = this.normalizeWord(word);
    const prepositions = this.direction === 'dutch_to_french'
      ? ['in', 'op', 'met', 'van', 'aan', 'voor', 'bij', 'naar', 'over', 'onder', 'tussen', 'door', 'uit', 'tegen', 'zonder', 'tijdens']
      : ['dans', 'sur', 'avec', 'de', 'à', 'pour', 'chez', 'vers', 'par', 'sous', 'entre', 'sans', 'pendant', 'contre', 'devant', 'derrière'];
    return prepositions.includes(normalized);
  }

  /**
   * Vérifie si un mot est une conjonction
   */
  private isConjunction(word: string): boolean {
    const normalized = this.normalizeWord(word);
    const conjunctions = this.direction === 'dutch_to_french'
      ? ['en', 'maar', 'of', 'want', 'dus', 'omdat', 'hoewel', 'terwijl', 'als', 'dat', 'die', 'waar']
      : ['et', 'mais', 'ou', 'car', 'donc', 'parce', 'que', 'bien', 'que', 'pendant', 'que', 'si', 'que', 'où'];
    return conjunctions.includes(normalized);
  }

  /**
   * Vérifie si un mot est un pronom
   */
  private isPronoun(word: string): boolean {
    const normalized = this.normalizeWord(word);
    const pronouns = this.direction === 'dutch_to_french'
      ? ['ik', 'je', 'jij', 'hij', 'zij', 'ze', 'wij', 'we', 'jullie', 'zij', 'mij', 'me', 'jou', 'hem', 'haar', 'ons', 'hun', 'hen']
      : ['je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'nous', 'vous', 'le', 'la', 'les', 'lui', 'leur'];
    return pronouns.includes(normalized);
  }

  /**
   * Vérifie si un mot est un adverbe de temps
   */
  private isTimeAdverb(word: string): boolean {
    const normalized = this.normalizeWord(word);
    const timeAdverbs = this.direction === 'dutch_to_french'
      ? ['vandaag', 'gisteren', 'morgen', 'nu', 'straks', 'later', 'eerst', 'dan', 'toen', 'altijd', 'nooit', 'soms', 'vaak']
      : ['aujourd\'hui', 'hier', 'demain', 'maintenant', 'bientôt', 'plus', 'tard', 'd\'abord', 'ensuite', 'toujours', 'jamais', 'parfois', 'souvent'];
    return timeAdverbs.includes(normalized);
  }

  /**
   * Vérifie si un mot est court (1-3 caractères)
   */
  private isShortWord(word: string): boolean {
    // Compter seulement les lettres, pas la ponctuation
    const lettersOnly = word.replace(/[^a-zA-ZàâäéèêëïîôöùûüÿçÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇ]/g, '');
    return lettersOnly.length <= 3 && lettersOnly.length > 0;
  }

  /**
   * Vérifie si un mot est stratégique à pré-placer
   */
  private isStrategicWord(word: string, index: number, totalWords: number): boolean {
    // Toujours pré-placer le premier et dernier mot
    if (index === 0 || index === totalWords - 1) {
      return true;
    }

    // Pré-placer les mots de structure grammaticale
    if (this.isArticle(word) || this.isPreposition(word) || this.isConjunction(word) || this.isPronoun(word)) {
      return true;
    }

    // Pré-placer les adverbes de temps (souvent en début ou position fixe)
    if (this.isTimeAdverb(word) && index < totalWords * 0.3) {
      return true;
    }

    // Pré-placer les mots courts et fréquents au début/milieu
    if (this.isShortWord(word) && index < totalWords * 0.6) {
      return true;
    }

    return false;
  }

  /**
   * Pré-place stratégiquement certains mots dans le tableau cible pour les phrases longues (>10 mots)
   * Place environ 30-40% des mots déjà en position correcte
   */
  private prePlaceWords(wordItems: WordItem[], words: string[]) {
    const totalWords = wordItems.length;
    // Calculer le nombre de mots à pré-placer (environ 30-35% arrondi)
    const targetPrePlaced = Math.max(3, Math.floor(totalWords * 0.35));
    
    // Créer une copie des mots pour manipulation
    const remainingWords = [...wordItems];
    const prePlacedIndices = new Set<number>();
    
    // 1. Toujours placer le premier mot
    if (totalWords > 0) {
      this.targetWords[0] = wordItems[0];
      prePlacedIndices.add(0);
      const firstWordIndex = remainingWords.findIndex(w => w.id === wordItems[0].id);
      if (firstWordIndex !== -1) {
        remainingWords.splice(firstWordIndex, 1);
      }
    }
    
    // 2. Toujours placer le dernier mot
    if (totalWords > 1) {
      const lastIndex = totalWords - 1;
      this.targetWords[lastIndex] = wordItems[lastIndex];
      prePlacedIndices.add(lastIndex);
      const lastWordIndex = remainingWords.findIndex(w => w.id === wordItems[lastIndex].id);
      if (lastWordIndex !== -1) {
        remainingWords.splice(lastWordIndex, 1);
      }
    }
    
    // 3. Identifier tous les mots stratégiques restants
    const strategicIndices: number[] = [];
    for (let i = 1; i < totalWords - 1; i++) {
      if (this.isStrategicWord(words[i], i, totalWords) && !prePlacedIndices.has(i)) {
        strategicIndices.push(i);
      }
    }
    
    // 4. Sélectionner les mots stratégiques à pré-placer (priorité aux premiers de la liste)
    // On veut environ 30-35% au total, donc on prend les plus stratégiques
    const remainingSlots = targetPrePlaced - prePlacedIndices.size;
    const indicesToPrePlace = strategicIndices.slice(0, remainingSlots);
    
    // 5. Placer les mots stratégiques sélectionnés
    for (const index of indicesToPrePlace) {
      this.targetWords[index] = wordItems[index];
      prePlacedIndices.add(index);
      const wordIndex = remainingWords.findIndex(w => w.id === wordItems[index].id);
      if (wordIndex !== -1) {
        remainingWords.splice(wordIndex, 1);
      }
    }
    
    // 6. Si on n'a pas encore atteint le nombre cible, placer quelques mots supplémentaires
    // de manière équilibrée au milieu de la phrase
    const stillNeeded = targetPrePlaced - prePlacedIndices.size;
    if (stillNeeded > 0 && totalWords > 2) {
      const startIndex = 1;
      const endIndex = totalWords - 1;
      const interval = Math.floor((endIndex - startIndex) / (stillNeeded + 1));
      
      for (let i = 0; i < stillNeeded; i++) {
        const targetIndex = startIndex + (i + 1) * interval;
        if (targetIndex < endIndex && !prePlacedIndices.has(targetIndex)) {
          this.targetWords[targetIndex] = wordItems[targetIndex];
          prePlacedIndices.add(targetIndex);
          const wordIndex = remainingWords.findIndex(w => w.id === wordItems[targetIndex].id);
          if (wordIndex !== -1) {
            remainingWords.splice(wordIndex, 1);
          }
        }
      }
    }
    
    // 7. Mélanger les mots restants pour le tableau source
    this.sourceWords = this.shuffleArray(remainingWords);
    
    // 8. Valider les mots pré-placés
    this.validateWords();
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
   * Vérifie si le bouton d'aide peut être utilisé
   */
  canUseHelp(): boolean {
    if (!this.currentSentence) return false;
    const totalWords = this.originalWords.length;
    
    // Afficher le bouton uniquement pour les phrases > 10 mots
    if (totalWords <= 10) return false;
    
    // Vérifier qu'on n'a pas atteint la limite d'aide
    if (this.helpUsedCount >= this.maxHelpCount) return false;
    
    // Vérifier qu'il reste des mots à placer ou des erreurs à corriger
    const hasEmptySlots = this.targetWords.some(w => w === null);
    const hasIncorrectWords = this.wordValidity.some(v => v === false);
    
    return hasEmptySlots || hasIncorrectWords;
  }

  /**
   * Place des mots supplémentaires pour aider l'utilisateur
   */
  requestHelp() {
    if (!this.canUseHelp()) return;

    const totalWords = this.originalWords.length;
    const wordsToPlace = 2 + Math.floor(this.helpUsedCount); // 2-3 mots selon le nombre de clics
    
    // Trouver les emplacements vides ou incorrects
    const emptyOrIncorrectIndices: number[] = [];
    for (let i = 0; i < totalWords; i++) {
      if (this.targetWords[i] === null || !this.wordValidity[i]) {
        emptyOrIncorrectIndices.push(i);
      }
    }

    // Si on a des mots incorrects, les corriger en priorité
    const incorrectIndices = emptyOrIncorrectIndices.filter(i => 
      this.targetWords[i] !== null && !this.wordValidity[i]
    );

    // Si on a des emplacements vides, les remplir avec des mots stratégiques
    const emptyIndices = emptyOrIncorrectIndices.filter(i => this.targetWords[i] === null);

    let placedCount = 0;

    // 1. Corriger les mots incorrects en premier
    for (const index of incorrectIndices) {
      if (placedCount >= wordsToPlace) break;
      
      // Trouver le bon mot pour cette position
      const correctWord = this.originalWordItems[index];
      if (correctWord) {
        // Retirer l'ancien mot incorrect du tableau source s'il y est
        const oldWord = this.targetWords[index];
        if (oldWord) {
          const oldWordIndex = this.sourceWords.findIndex(w => w.id === oldWord.id);
          if (oldWordIndex !== -1) {
            this.sourceWords.splice(oldWordIndex, 1);
          }
        }
        
        // Placer le bon mot
        this.targetWords[index] = correctWord;
        
        // Retirer le mot du tableau source
        const sourceIndex = this.sourceWords.findIndex(w => w.id === correctWord.id);
        if (sourceIndex !== -1) {
          this.sourceWords.splice(sourceIndex, 1);
        }
        
        placedCount++;
      }
    }

    // 2. Remplir les emplacements vides avec des mots stratégiques
    if (placedCount < wordsToPlace && emptyIndices.length > 0) {
      // Trier les emplacements vides par priorité stratégique
      const prioritizedIndices = emptyIndices
        .map(index => ({
          index,
          priority: this.getStrategicPriority(this.originalWords[index], index, totalWords)
        }))
        .sort((a, b) => b.priority - a.priority)
        .map(item => item.index);

      for (const index of prioritizedIndices) {
        if (placedCount >= wordsToPlace) break;
        
        const correctWord = this.originalWordItems[index];
        if (correctWord) {
          // Vérifier que le mot est encore dans le tableau source
          const sourceIndex = this.sourceWords.findIndex(w => w.id === correctWord.id);
          if (sourceIndex !== -1) {
            this.targetWords[index] = correctWord;
            this.sourceWords.splice(sourceIndex, 1);
            placedCount++;
          }
        }
      }
    }

    // Incrémenter le compteur d'aide seulement si des mots ont été placés
    if (placedCount > 0) {
      this.helpUsedCount++;
      
      // Valider les mots placés
      this.validateWords();

      console.log('[DEBUG] Aide utilisée:', {
        motsPlaces: placedCount,
        aideUtilisee: this.helpUsedCount,
        tableauFinal: this.targetWords.map(w => w ? w.text : null)
      });
    } else {
      console.log('[DEBUG] Aide demandée mais aucun mot à placer (tous les mots sont déjà corrects)');
    }
  }

  /**
   * Calcule la priorité stratégique d'un mot pour le placement
   * Plus le score est élevé, plus le mot est stratégique
   */
  private getStrategicPriority(word: string, index: number, totalWords: number): number {
    let priority = 0;

    // Priorité élevée pour les mots de structure grammaticale
    if (this.isArticle(word)) priority += 10;
    if (this.isPreposition(word)) priority += 9;
    if (this.isConjunction(word)) priority += 8;
    if (this.isPronoun(word)) priority += 7;

    // Priorité pour les adverbes de temps au début
    if (this.isTimeAdverb(word) && index < totalWords * 0.3) {
      priority += 6;
    }

    // Priorité pour les mots courts au début/milieu
    if (this.isShortWord(word) && index < totalWords * 0.6) {
      priority += 5;
    }

    // Priorité légèrement plus élevée pour les positions au début/milieu
    if (index < totalWords * 0.5) {
      priority += 2;
    }

    return priority;
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
   * Vérifie si le bouton d'aide doit être affiché
   */
  shouldShowHelpButton(): boolean {
    if (this.direction === 'dutch_to_french' && this.currentSentence?.missingWord) {
      return true;
    }
    const word = this.getCurrentWord();
    return !!word?.dutch_text;
  }

  /**
   * Récupère le mot néerlandais à expliquer
   */
  getDutchWordToExplain(): string | null {
    if (this.direction === 'dutch_to_french' && this.currentSentence?.missingWord) {
      return this.currentSentence.missingWord;
    }
    const word = this.getCurrentWord();
    return word?.dutch_text || null;
  }

  /**
   * Demande une explication du mot en néerlandais
   */
  async requestWordHelp() {
    const dutchWord = this.getDutchWordToExplain();
    const word = this.getCurrentWord();
    if (!dutchWord || !word || this.isLoadingHelp) {
      return;
    }

    this.isLoadingHelp = true;
    this.helpError = null;
    this.showHelpExplanation = true;

    try {
      const explanation = await this.deepSeekService.getOrGenerateWordExplanation(
        word.id,
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

