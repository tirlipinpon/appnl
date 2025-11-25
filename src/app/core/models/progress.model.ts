export interface UserProgress {
  id: string;
  user_id: string;
  word_id: string;
  times_seen: number;
  times_correct: number;
  times_incorrect: number;
  next_review_date?: string;
  interval_days: number;
  ease_factor: number;
  last_reviewed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserLesson {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  disabled?: boolean;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  word_id: string;
  quiz_type: 'multiple_choice' | 'typing' | 'fill_in_blank' | 'reorder_sentence' | 'find_error';
  direction: 'french_to_dutch' | 'dutch_to_french';
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  created_at?: string;
}

export type QuizType = 'multiple_choice' | 'typing' | 'fill_in_blank' | 'reorder_sentence' | 'find_error';
export type QuizDirection = 'french_to_dutch' | 'dutch_to_french';

