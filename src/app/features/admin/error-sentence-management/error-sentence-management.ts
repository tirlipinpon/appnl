import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorSentenceService } from '../../../core/services/error-sentence.service';
import { WordService } from '../../../core/services/word.service';
import { LessonService } from '../../../core/services/lesson.service';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorSentence } from '../../../core/models/error-sentence.model';
import { Word } from '../../../core/models/word.model';
import { Lesson } from '../../../core/models/lesson.model';

@Component({
  selector: 'app-error-sentence-management',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './error-sentence-management.html',
  styleUrl: './error-sentence-management.css',
})
export class ErrorSentenceManagement implements OnInit {
  private errorSentenceService = inject(ErrorSentenceService);
  private wordService = inject(WordService);
  private lessonService = inject(LessonService);
  public authService = inject(AuthService);
  private fb = inject(FormBuilder);

  errorSentences: ErrorSentence[] = [];
  words: Word[] = [];
  lessons: Lesson[] = [];
  errorSentenceForm: FormGroup;
  editingErrorSentence: ErrorSentence | null = null;
  isLoading = true;
  isGenerating = false;
  errorMessage = '';
  successMessage = '';
  
  // Filtres
  filterLessonId: string = '';
  filterDirection: 'french_to_dutch' | 'dutch_to_french' | '' = '';
  filterWordId: string = '';

  // Types d'erreurs disponibles
  errorTypes = [
    { value: 'word_order', label: 'Ordre des mots' },
    { value: 'conjugation', label: 'Conjugaison' },
    { value: 'article', label: 'Article' },
    { value: 'preposition', label: 'Préposition' },
    { value: 'agreement', label: 'Accord' },
    { value: 'tense', label: 'Temps verbal' },
    { value: 'other', label: 'Autre' }
  ];

  constructor() {
    this.errorSentenceForm = this.fb.group({
      word_id: ['', [Validators.required]],
      lesson_id: [''],
      direction: ['dutch_to_french', [Validators.required]],
      sentence_with_error: ['', [Validators.required]],
      sentence_correct: ['', [Validators.required]],
      error_type: [''],
      explanation: ['']
    });
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      this.isLoading = true;
      const [errorSentences, words, lessons] = await Promise.all([
        this.errorSentenceService.getAllErrorSentences(),
        this.wordService.getAllWords(),
        this.lessonService.getLessons()
      ]);
      
      this.errorSentences = errorSentences;
      this.words = words;
      this.lessons = lessons;
    } catch (error) {
      console.error('Error loading data:', error);
      this.errorMessage = 'Erreur lors du chargement des données';
    } finally {
      this.isLoading = false;
    }
  }

  get filteredErrorSentences(): ErrorSentence[] {
    let filtered = [...this.errorSentences];

    if (this.filterLessonId) {
      filtered = filtered.filter(es => es.lesson_id === this.filterLessonId);
    }

    if (this.filterDirection) {
      filtered = filtered.filter(es => es.direction === this.filterDirection);
    }

    if (this.filterWordId) {
      filtered = filtered.filter(es => es.word_id === this.filterWordId);
    }

    return filtered;
  }

  async onSubmit() {
    if (this.errorSentenceForm.invalid) {
      return;
    }

    try {
      this.errorMessage = '';
      this.successMessage = '';
      const formValue = this.errorSentenceForm.value;
      
      if (this.editingErrorSentence) {
        await this.errorSentenceService.updateErrorSentence(
          this.editingErrorSentence.id,
          formValue
        );
        this.successMessage = 'Phrase avec erreur mise à jour avec succès';
      } else {
        await this.errorSentenceService.createErrorSentence(formValue);
        this.successMessage = 'Phrase avec erreur ajoutée avec succès';
      }

      this.errorSentenceForm.reset({
        direction: 'dutch_to_french'
      });
      this.editingErrorSentence = null;
      await this.loadData();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de l\'enregistrement';
    }
  }

  async generateAutomatically() {
    const wordId = this.errorSentenceForm.get('word_id')?.value;
    const lessonId = this.errorSentenceForm.get('lesson_id')?.value;
    const direction = this.errorSentenceForm.get('direction')?.value;
    const errorType = this.errorSentenceForm.get('error_type')?.value;

    if (!wordId || !direction) {
      this.errorMessage = 'Veuillez sélectionner un mot et une direction';
      return;
    }

    try {
      this.isGenerating = true;
      this.errorMessage = '';
      this.successMessage = '';

      const word = this.words.find(w => w.id === wordId);
      if (!word) {
        this.errorMessage = 'Mot introuvable';
        return;
      }

      const wordText = direction === 'dutch_to_french' ? word.dutch_text : word.french_text;
      const frenchTranslation = direction === 'dutch_to_french' ? word.french_text : undefined;

      const generated = await this.errorSentenceService.generateErrorSentence(
        wordId,
        wordText,
        direction,
        lessonId || undefined,
        errorType || undefined,
        frenchTranslation
      );

      // Remplir le formulaire avec les données générées
      this.errorSentenceForm.patchValue({
        word_id: wordId,
        lesson_id: lessonId || '',
        direction: direction,
        sentence_with_error: generated.sentence_with_error,
        sentence_correct: generated.sentence_correct,
        error_type: generated.error_type || '',
        explanation: generated.explanation || ''
      });

      this.successMessage = 'Phrase avec erreur générée automatiquement ! Vous pouvez la modifier avant de l\'enregistrer.';
    } catch (error: any) {
      console.error('Error generating error sentence:', error);
      this.errorMessage = error.message || 'Erreur lors de la génération automatique';
    } finally {
      this.isGenerating = false;
    }
  }

  editErrorSentence(errorSentence: ErrorSentence) {
    this.editingErrorSentence = errorSentence;
    this.errorSentenceForm.patchValue({
      word_id: errorSentence.word_id,
      lesson_id: errorSentence.lesson_id || '',
      direction: errorSentence.direction,
      sentence_with_error: errorSentence.sentence_with_error,
      sentence_correct: errorSentence.sentence_correct,
      error_type: errorSentence.error_type || '',
      explanation: errorSentence.explanation || ''
    });
  }

  cancelEdit() {
    this.editingErrorSentence = null;
    this.errorSentenceForm.reset({
      direction: 'dutch_to_french'
    });
  }

  async deleteErrorSentence(errorSentence: ErrorSentence) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer cette phrase avec erreur ?\n\n"${errorSentence.sentence_with_error}"`)) {
      return;
    }

    try {
      await this.errorSentenceService.deleteErrorSentence(errorSentence.id);
      this.successMessage = 'Phrase avec erreur supprimée avec succès';
      await this.loadData();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de la suppression';
    }
  }

  getWordText(wordId: string): string {
    const word = this.words.find(w => w.id === wordId);
    if (!word) return 'Mot inconnu';
    return `${word.french_text} / ${word.dutch_text}`;
  }

  getLessonTitle(lessonId?: string): string {
    if (!lessonId) return '-';
    const lesson = this.lessons.find(l => l.id === lessonId);
    return lesson ? lesson.title : 'Leçon inconnue';
  }

  getErrorTypeLabel(errorType?: string): string {
    if (!errorType) return '-';
    const type = this.errorTypes.find(t => t.value === errorType);
    return type ? type.label : errorType;
  }

  clearFilters() {
    this.filterLessonId = '';
    this.filterDirection = '';
    this.filterWordId = '';
  }
}

