export interface UserLessonWord {
  id: string;
  user_id: string;
  lesson_id: string;
  word_id?: string;
  action: 'hide' | 'add' | 'edit';
  french_text_override?: string;
  dutch_text_override?: string;
  created_at?: string;
}

