import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WordService } from '../../../core/services/word.service';
import { LessonService } from '../../../core/services/lesson.service';
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
  private fb = inject(FormBuilder);

  words: Word[] = [];
  lessons: Lesson[] = [];
  wordForm: FormGroup;
  editingWord: Word | null = null;
  isLoading = true;
  errorMessage = '';
  successMessage = '';

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
      const [words, lessons] = await Promise.all([
        this.wordService.getAllWords(),
        this.lessonService.getLessons()
      ]);
      this.words = words;
      this.lessons = lessons;
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

      const formValue = this.wordForm.value;
      
      if (this.editingWord) {
        await this.wordService.updateWord(this.editingWord.id, formValue);
        this.successMessage = 'Mot mis à jour avec succès';
      } else {
        await this.wordService.createWord(formValue);
        this.successMessage = 'Mot ajouté avec succès';
      }

      this.wordForm.reset();
      this.editingWord = null;
      await this.loadData();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de l\'enregistrement';
    }
  }

  editWord(word: Word) {
    this.editingWord = word;
    this.wordForm.patchValue({
      french_text: word.french_text,
      dutch_text: word.dutch_text,
      lesson_id: word.lesson_id
    });
  }

  cancelEdit() {
    this.editingWord = null;
    this.wordForm.reset();
  }

  async deleteWord(word: Word) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${word.french_text}" ?`)) {
      return;
    }

    try {
      await this.wordService.deleteWord(word.id);
      this.successMessage = 'Mot supprimé avec succès';
      await this.loadData();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de la suppression';
    }
  }

  getLessonTitle(lessonId: string): string {
    const lesson = this.lessons.find(l => l.id === lessonId);
    return lesson ? lesson.title : 'Leçon inconnue';
  }
}
