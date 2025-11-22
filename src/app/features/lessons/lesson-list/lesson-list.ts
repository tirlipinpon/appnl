import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LessonService } from '../../../core/services/lesson.service';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { Lesson } from '../../../core/models/lesson.model';

@Component({
  selector: 'app-lesson-list',
  imports: [CommonModule, RouterLink],
  templateUrl: './lesson-list.html',
  styleUrl: './lesson-list.css',
})
export class LessonList implements OnInit {
  private lessonService = inject(LessonService);
  private progressService = inject(ProgressService);
  private authService = inject(AuthService);
  private router = inject(Router);

  lessons: Lesson[] = [];
  userLessons: any[] = [];
  isLoading = true;

  async ngOnInit() {
    await this.loadLessons();
  }

  async loadLessons() {
    try {
      this.isLoading = true;
      const user = this.authService.getCurrentUser();
      
      if (user) {
        this.userLessons = await this.progressService.getUserLessons(user.id);
      }
      
      this.lessons = await this.lessonService.getLessons();
    } catch (error) {
      console.error('Error loading lessons:', error);
    } finally {
      this.isLoading = false;
    }
  }

  isLessonCompleted(lessonId: string): boolean {
    return this.userLessons.some(ul => ul.lesson_id === lessonId && ul.completed);
  }
}
