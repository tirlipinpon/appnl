import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LessonService } from '../../../core/services/lesson.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { Lesson } from '../../../core/models/lesson.model';

@Component({
  selector: 'app-lesson-management',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './lesson-management.html',
  styleUrl: './lesson-management.css',
})
export class LessonManagement implements OnInit {
  private lessonService = inject(LessonService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  lessons: Lesson[] = [];
  userLessons: any[] = [];
  disabledLessons: Set<string> = new Set();
  lessonForm: FormGroup;
  editingLesson: Lesson | null = null;
  isLoading = true;
  errorMessage = '';
  successMessage = '';

  constructor() {
    this.lessonForm = this.fb.group({
      title: ['', [Validators.required]],
      description: ['']
    });
  }

  async ngOnInit() {
    await this.loadLessons();
  }

  async loadLessons() {
    try {
      this.isLoading = true;
      this.lessons = await this.lessonService.getLessons();
      
      // Charger l'état disabled pour l'utilisateur actuel
      const user = this.authService.getCurrentUser();
      if (user) {
        this.userLessons = await this.progressService.getUserLessons(user.id);
        this.disabledLessons.clear();
        for (const userLesson of this.userLessons) {
          if (userLesson.disabled === true) {
            this.disabledLessons.add(userLesson.lesson_id);
          }
        }
      }
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
        // Toujours activer fill_in_blank et définir order_index automatiquement
        formValue.enable_fill_in_blank = true;
        formValue.order_index = this.lessons.length;
        
        const result = await this.lessonService.createLesson(formValue);
        
        if (result.titleWasModified) {
          this.successMessage = `Leçon ajoutée avec succès. Le titre "${result.originalTitle}" existait déjà, il a été renommé en "${result.lesson.title}"`;
        } else {
          this.successMessage = 'Leçon ajoutée avec succès';
        }
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
      description: lesson.description || ''
    });
  }

  cancelEdit() {
    this.editingLesson = null;
    this.lessonForm.reset();
  }

  async deleteLesson(lesson: Lesson, event: Event) {
    event.stopPropagation();
    
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'Vous devez être connecté pour désactiver une leçon';
      return;
    }

    const isCurrentlyDisabled = this.disabledLessons.has(lesson.id);
    const action = isCurrentlyDisabled ? 'réactiver' : 'désactiver';
    
    if (!confirm(`Êtes-vous sûr de vouloir ${action} la leçon "${lesson.title}" ?`)) {
      return;
    }

    try {
      this.errorMessage = '';
      this.successMessage = '';

      if (isCurrentlyDisabled) {
        await this.progressService.enableLesson(user.id, lesson.id);
        this.disabledLessons.delete(lesson.id);
        this.successMessage = `La leçon "${lesson.title}" a été réactivée`;
      } else {
        await this.progressService.disableLesson(user.id, lesson.id);
        this.disabledLessons.add(lesson.id);
        this.successMessage = `La leçon "${lesson.title}" a été désactivée`;
      }

      // Recharger les userLessons pour avoir les données à jour
      this.userLessons = await this.progressService.getUserLessons(user.id);
    } catch (error: any) {
      console.error('Error toggling lesson disabled state:', error);
      this.errorMessage = error.message || 'Erreur lors de la modification de l\'état de la leçon';
    }
  }

  isLessonDisabled(lessonId: string): boolean {
    return this.disabledLessons.has(lessonId);
  }
}

