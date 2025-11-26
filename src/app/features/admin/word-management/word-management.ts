import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WordService } from '../../../core/services/word.service';
import { LessonService } from '../../../core/services/lesson.service';
import { UserLessonService } from '../../../core/services/user-lesson.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { TextExtractionService } from '../../../core/services/text-extraction.service';
import { Word } from '../../../core/models/word.model';
import { Lesson } from '../../../core/models/lesson.model';
import { ExtractedWord } from '../../../core/models/extracted-word.model';

@Component({
  selector: 'app-word-management',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule],
  templateUrl: './word-management.html',
  styleUrl: './word-management.css',
})
export class WordManagement implements OnInit {
  private wordService = inject(WordService);
  private lessonService = inject(LessonService);
  private userLessonService = inject(UserLessonService);
  public authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);
  private textExtractionService = inject(TextExtractionService);
  private fb = inject(FormBuilder);

  words: Word[] = [];
  allWords: Word[] = []; // Tous les mots globaux (pour voir les masqués)
  lessons: Lesson[] = [];
  wordForm: FormGroup;
  editingWord: Word | null = null;
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  hiddenWordIds: Set<string> = new Set();
  editedWordIds: Set<string> = new Set(); // Mots qui ont été modifiés personnellement
  expandedLessons: Set<string> = new Set(); // Leçons ouvertes/fermées

  // Propriétés pour l'import depuis texte
  showImportSection: boolean = false;
  importText: string = '';
  selectedLessonForImport: string = '';
  extractedWords: ExtractedWord[] = [];
  isExtracting: boolean = false;
  importError: string = '';
  importSuccessMessage: string = '';
  readonly MAX_TEXT_LENGTH = 3000;

  constructor() {
    this.wordForm = this.fb.group({
      french_text: ['', [Validators.required]],
      dutch_text: ['', [Validators.required]],
      lesson_id: ['', [Validators.required]]
    });
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      this.isLoading = true;
      const user = this.authService.getCurrentUser();
      const [allWordsGlobal, lessons] = await Promise.all([
        this.wordService.getAllWords(),
        this.lessonService.getLessons()
      ]);
      
      this.allWords = allWordsGlobal;
      this.lessons = lessons;

      // Afficher tous les mots de base pour que chaque utilisateur voie tous les mots disponibles
      // Les modifications personnelles seront appliquées visuellement (badges, masquage)
      this.words = allWordsGlobal;
      
      // Si utilisateur connecté, charger les informations sur les modifications personnelles
      // pour afficher les badges et permettre la gestion
      if (user) {
        const allHiddenIds = new Set<string>();
        const allEditedIds = new Set<string>();
        
        // Récupérer toutes les modifications personnelles de cet utilisateur uniquement
        const { data: allModifications, error: modError } = await this.supabaseService.client
          .from('nlapp_user_lesson_words')
          .select('*')
          .eq('user_id', user.id); // IMPORTANT: seulement les modifications de cet utilisateur
        
        if (!modError && allModifications) {
          allModifications.forEach(mod => {
            if (mod.word_id) {
              if (mod.action === 'hide') {
                allHiddenIds.add(mod.word_id);
              } else if (mod.action === 'edit') {
                allEditedIds.add(mod.word_id);
              }
            }
          });
        }
        
        this.hiddenWordIds = allHiddenIds;
        this.editedWordIds = allEditedIds;
      } else {
        this.hiddenWordIds = new Set();
        this.editedWordIds = new Set();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.errorMessage = 'Erreur lors du chargement des données';
    } finally {
      this.isLoading = false;
    }
  }

  async onSubmit() {
    if (this.wordForm.invalid) {
      return;
    }

    try {
      this.errorMessage = '';
      this.successMessage = '';
      const user = this.authService.getCurrentUser();
      const formValue = this.wordForm.value;
      
      if (this.editingWord) {
        // Éditer le mot de manière personnelle
        if (user && this.editingWord.lesson_id) {
          await this.userLessonService.editWord(
            user.id,
            this.editingWord.lesson_id,
            this.editingWord.id,
            formValue.french_text,
            formValue.dutch_text
          );
          this.editedWordIds.add(this.editingWord.id);
          this.successMessage = 'Mot modifié avec succès (modification personnelle)';
        } else {
          // Si pas d'utilisateur ou pas de lesson_id, erreur
          this.errorMessage = 'Impossible de modifier le mot';
        }
      } else {
        // Créer un nouveau mot (global) et l'ajouter à la leçon personnelle
        if (user) {
          await this.userLessonService.addNewWordToLesson(user.id, formValue.lesson_id, {
            french_text: formValue.french_text,
            dutch_text: formValue.dutch_text
          });
          this.successMessage = 'Mot créé et ajouté à votre leçon personnelle';
        } else {
          await this.wordService.createWord(formValue);
          this.successMessage = 'Mot ajouté avec succès';
        }
      }

      this.wordForm.reset();
      this.editingWord = null;
      await this.loadData();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de l\'enregistrement';
    }
  }

  async editWord(word: Word) {
    const user = this.authService.getCurrentUser();
    this.editingWord = word;
    
    // Charger les modifications personnelles si elles existent
    let frenchText = word.french_text;
    let dutchText = word.dutch_text;
    
    if (user && word.lesson_id) {
      const edit = await this.userLessonService.getWordEdit(user.id, word.lesson_id, word.id);
      if (edit) {
        frenchText = edit.french_text_override || frenchText;
        dutchText = edit.dutch_text_override || dutchText;
      }
    }
    
    this.wordForm.patchValue({
      french_text: frenchText,
      dutch_text: dutchText,
      lesson_id: word.lesson_id
    });
  }

  cancelEdit() {
    this.editingWord = null;
    this.wordForm.reset();
  }

  async deleteWord(word: Word) {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'Vous devez être connecté';
      return;
    }

    if (!word.lesson_id) {
      this.errorMessage = 'Impossible de masquer ce mot (leçon inconnue). Le mot doit être associé à une leçon.';
      console.error('Word without lesson_id:', word);
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir masquer "${word.french_text}" de cette leçon ?\n\nCette modification n'affectera que votre version personnelle.`)) {
      return;
    }

    try {
      console.log('Masquage du mot:', { userId: user.id, lessonId: word.lesson_id, wordId: word.id });
      await this.userLessonService.hideWord(user.id, word.lesson_id, word.id);
      console.log('Mot masqué avec succès');
      this.successMessage = 'Mot masqué avec succès (modification personnelle)';
      this.errorMessage = '';
      // Recharger les données pour mettre à jour l'affichage
      await this.loadData();
    } catch (error: any) {
      console.error('Erreur lors du masquage:', error);
      this.errorMessage = error.message || 'Erreur lors du masquage';
      this.successMessage = '';
    }
  }

  async restoreWord(word: Word) {
    const user = this.authService.getCurrentUser();
    if (!user || !word.lesson_id) {
      this.errorMessage = 'Impossible de réactiver ce mot';
      return;
    }

    try {
      await this.userLessonService.unhideWord(user.id, word.lesson_id, word.id);
      this.hiddenWordIds.delete(word.id);
      this.successMessage = 'Mot réactivé avec succès';
      await this.loadData();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de la réactivation';
    }
  }

  async removeWordEdit(word: Word) {
    const user = this.authService.getCurrentUser();
    if (!user || !word.lesson_id) {
      this.errorMessage = 'Impossible de supprimer la modification';
      return;
    }

    if (!confirm(`Supprimer votre modification personnelle de "${word.french_text}" ?\n\nLe mot reviendra à sa version originale.`)) {
      return;
    }

    try {
      await this.userLessonService.removeModification(user.id, word.lesson_id, word.id, 'edit');
      this.editedWordIds.delete(word.id);
      this.successMessage = 'Modification supprimée, le mot revient à sa version originale';
      await this.loadData();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de la suppression de la modification';
    }
  }

  isWordHidden(wordId: string): boolean {
    return this.hiddenWordIds.has(wordId);
  }

  isWordEdited(wordId: string): boolean {
    return this.editedWordIds.has(wordId);
  }

  async swapWordLanguages(word: Word) {
    const user = this.authService.getCurrentUser();
    if (!user || !word.lesson_id) {
      this.errorMessage = 'Impossible d\'inverser les langues';
      return;
    }

    if (!confirm(`Inverser les langues pour "${word.french_text}" / "${word.dutch_text}" ?\n\nFrançais: ${word.french_text}\nNéerlandais: ${word.dutch_text}\n\nAprès inversion:\nFrançais: ${word.dutch_text}\nNéerlandais: ${word.french_text}\n\n(Cette modification n'affectera que votre version)`)) {
      return;
    }

    try {
      // Inverser les langues de manière personnelle
      await this.userLessonService.editWord(
        user.id,
        word.lesson_id,
        word.id,
        word.dutch_text,
        word.french_text
      );
      this.successMessage = 'Langues inversées avec succès (modification personnelle)';
      await this.loadData();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de l\'inversion';
    }
  }

  getLessonTitle(lessonId: string): string {
    const lesson = this.lessons.find(l => l.id === lessonId);
    return lesson ? lesson.title : 'Leçon inconnue';
  }

  getWordsByLesson(): { lesson: Lesson; words: Word[] }[] {
    const grouped: { [key: string]: Word[] } = {};
    
    // Grouper les mots par leçon, en excluant les mots masqués
    this.words.forEach(word => {
      // Ne pas inclure les mots masqués dans la liste principale
      if (this.isWordHidden(word.id)) {
        return;
      }
      
      const lessonId = word.lesson_id || 'unknown';
      if (!grouped[lessonId]) {
        grouped[lessonId] = [];
      }
      grouped[lessonId].push(word);
    });

    // Convertir en tableau et trier par titre de leçon
    return this.lessons
      .map(lesson => ({
        lesson,
        words: grouped[lesson.id] || []
      }))
      .filter(group => group.words.length > 0)
      .sort((a, b) => a.lesson.title.localeCompare(b.lesson.title));
  }

  getHiddenWordsByLesson(): { lesson: Lesson; words: Word[] }[] {
    const grouped: { [key: string]: Word[] } = {};
    
    // Grouper les mots masqués par leçon
    this.allWords.forEach(word => {
      if (this.isWordHidden(word.id) && word.lesson_id) {
        const lessonId = word.lesson_id;
        if (!grouped[lessonId]) {
          grouped[lessonId] = [];
        }
        grouped[lessonId].push(word);
      }
    });

    // Convertir en tableau et trier par titre de leçon
    return this.lessons
      .map(lesson => ({
        lesson,
        words: grouped[lesson.id] || []
      }))
      .filter(group => group.words.length > 0)
      .sort((a, b) => a.lesson.title.localeCompare(b.lesson.title));
  }

  toggleLesson(lessonId: string): void {
    if (this.expandedLessons.has(lessonId)) {
      this.expandedLessons.delete(lessonId);
    } else {
      this.expandedLessons.add(lessonId);
    }
  }

  isLessonExpanded(lessonId: string): boolean {
    return this.expandedLessons.has(lessonId);
  }

  // Méthodes pour l'import depuis texte
  toggleImportSection(): void {
    this.showImportSection = !this.showImportSection;
    if (!this.showImportSection) {
      // Réinitialiser les données lors de la fermeture
      this.importText = '';
      this.selectedLessonForImport = '';
      this.extractedWords = [];
      this.importError = '';
      this.importSuccessMessage = '';
    }
  }

  validateImportText(): boolean {
    if (!this.importText.trim()) {
      this.importError = 'Veuillez coller un texte néerlandais';
      return false;
    }

    if (this.importText.length > this.MAX_TEXT_LENGTH) {
      this.importError = `Le texte ne doit pas dépasser ${this.MAX_TEXT_LENGTH} caractères (actuellement ${this.importText.length})`;
      return false;
    }

    if (!this.selectedLessonForImport) {
      this.importError = 'Veuillez sélectionner une leçon';
      return false;
    }

    this.importError = '';
    return true;
  }

  async extractWords(): Promise<void> {
    if (!this.validateImportText()) {
      return;
    }

    try {
      this.isExtracting = true;
      this.importError = '';
      this.importSuccessMessage = '';
      this.extractedWords = [];

      // Extraire les mots depuis le texte
      const extracted = await this.textExtractionService.extractWordsFromText(this.importText);
      
      // Vérifier les doublons
      const wordsWithDuplicates = await this.textExtractionService.checkDuplicates(extracted);
      
      this.extractedWords = wordsWithDuplicates;
      
      if (this.extractedWords.length === 0) {
        this.importError = 'Aucun mot de vocabulaire n\'a pu être extrait du texte. Vérifiez que le texte contient des mots importants.';
      }
    } catch (error: any) {
      console.error('Error extracting words:', error);
      this.importError = error.message || 'Erreur lors de l\'extraction des mots. Veuillez réessayer.';
    } finally {
      this.isExtracting = false;
    }
  }

  toggleWordSelection(index: number): void {
    if (this.extractedWords[index]) {
      this.extractedWords[index].selected = !this.extractedWords[index].selected;
    }
  }

  selectAllWords(): void {
    this.extractedWords.forEach(word => word.selected = true);
  }

  deselectAllWords(): void {
    this.extractedWords.forEach(word => word.selected = false);
  }

  async importSelectedWords(): Promise<void> {
    const selectedWords = this.extractedWords.filter(w => w.selected);
    
    if (selectedWords.length === 0) {
      this.importError = 'Veuillez sélectionner au moins un mot à ajouter';
      return;
    }

    if (!this.selectedLessonForImport) {
      this.importError = 'Veuillez sélectionner une leçon';
      return;
    }

    try {
      this.isExtracting = true;
      this.importError = '';
      this.importSuccessMessage = '';

      const user = this.authService.getCurrentUser();
      let addedCount = 0;
      let skippedCount = 0;

      for (const word of selectedWords) {
        try {
          if (user) {
            // Ajouter via le service utilisateur (création globale + ajout personnel)
            await this.userLessonService.addNewWordToLesson(user.id, this.selectedLessonForImport, {
              french_text: word.french_text,
              dutch_text: word.dutch_text
            });
          } else {
            // Ajouter directement (admin global)
            await this.wordService.createWord({
              french_text: word.french_text,
              dutch_text: word.dutch_text,
              lesson_id: this.selectedLessonForImport
            });
          }
          addedCount++;
        } catch (error: any) {
          console.error(`Error adding word ${word.dutch_text}:`, error);
          skippedCount++;
        }
      }

      // Recharger les données
      await this.loadData();

      // Afficher le message de succès
      if (addedCount > 0) {
        this.importSuccessMessage = `${addedCount} mot(s) ajouté(s) avec succès`;
        if (skippedCount > 0) {
          this.importSuccessMessage += ` (${skippedCount} mot(s) ignoré(s))`;
        }
      } else {
        this.importError = 'Aucun mot n\'a pu être ajouté';
      }

      // Réinitialiser après 3 secondes
      setTimeout(() => {
        this.extractedWords = [];
        this.importText = '';
        this.selectedLessonForImport = '';
      }, 3000);

    } catch (error: any) {
      console.error('Error importing words:', error);
      this.importError = error.message || 'Erreur lors de l\'ajout des mots';
    } finally {
      this.isExtracting = false;
    }
  }

  getSelectedWordsCount(): number {
    return this.extractedWords.filter(w => w.selected).length;
  }

  getRemainingCharacters(): number {
    return this.MAX_TEXT_LENGTH - this.importText.length;
  }
}
