import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WordService } from '../../../core/services/word.service';
import { LessonService } from '../../../core/services/lesson.service';
import { UserLessonService } from '../../../core/services/user-lesson.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Word } from '../../../core/models/word.model';
import { Lesson } from '../../../core/models/lesson.model';

@Component({
  selector: 'app-word-management',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './word-management.html',
  styleUrl: './word-management.css',
})
export class WordManagement implements OnInit {
  private wordService = inject(WordService);
  private lessonService = inject(LessonService);
  private userLessonService = inject(UserLessonService);
  public authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);
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
}
