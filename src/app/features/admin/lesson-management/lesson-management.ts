import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LessonService } from '../../../core/services/lesson.service';
import { Lesson } from '../../../core/models/lesson.model';

@Component({
  selector: 'app-lesson-management',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './lesson-management.html',
  styleUrl: './lesson-management.css',
})
export class LessonManagement implements OnInit {
  private lessonService = inject(LessonService);
  private fb = inject(FormBuilder);

  lessons: Lesson[] = [];
  lessonForm: FormGroup;
  editingLesson: Lesson | null = null;
  isLoading = true;
  errorMessage = '';
  successMessage = '';

  constructor() {
    this.lessonForm = this.fb.group({
      title: ['', [Validators.required]],
      description: [''],
      order_index: [0, [Validators.required, Validators.min(0)]],
      enable_fill_in_blank: [true]
    });
  }

  async ngOnInit() {
    await this.loadLessons();
  }

  async loadLessons() {
    try {
      this.isLoading = true;
      this.lessons = await this.lessonService.getLessons();
    } catch (error) {
      console.error('Error loading lessons:', error);
      this.errorMessage = 'Erreur lors du chargement des leçons';
    } finally {
      this.isLoading = false;
    }
  }

  async onSubmit() {
    if (this.lessonForm.invalid) {
      return;
    }

    try {
      this.errorMessage = '';
      this.successMessage = '';

      const formValue = this.lessonForm.value;
      
      if (this.editingLesson) {
        await this.lessonService.updateLesson(this.editingLesson.id, formValue);
        this.successMessage = 'Leçon mise à jour avec succès';
      } else {
        // Si pas d'order_index spécifié, mettre à la fin
        if (!formValue.order_index && formValue.order_index !== 0) {
          formValue.order_index = this.lessons.length;
        }
        await this.lessonService.createLesson(formValue);
        this.successMessage = 'Leçon ajoutée avec succès';
      }

      this.lessonForm.reset();
      this.editingLesson = null;
      await this.loadLessons();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de l\'enregistrement';
    }
  }

  editLesson(lesson: Lesson) {
    this.editingLesson = lesson;
    this.lessonForm.patchValue({
      title: lesson.title,
      description: lesson.description || '',
      order_index: lesson.order_index,
      enable_fill_in_blank: lesson.enable_fill_in_blank !== false
    });
  }

  cancelEdit() {
    this.editingLesson = null;
    this.lessonForm.reset();
  }

  async deleteLesson(lesson: Lesson) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la leçon "${lesson.title}" ?`)) {
      return;
    }

    try {
      // Note: Vous devrez peut-être ajouter une méthode deleteLesson dans le service
      // Pour l'instant, on affiche juste un message
      this.errorMessage = 'La suppression de leçon n\'est pas encore implémentée';
    } catch (error: any) {
      this.errorMessage = error.message || 'Erreur lors de la suppression';
    }
  }
}

