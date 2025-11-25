export interface ErrorSentence {
  id: string;
  word_id: string;
  lesson_id?: string;
  sentence_with_error: string;
  sentence_correct: string;
  error_type?: string;
  direction: 'french_to_dutch' | 'dutch_to_french';
  error_position_start?: number;
  error_position_end?: number;
  explanation?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WordItem {
  text: string;
  id: string;
  originalIndex: number;
  correctIndex: number;
}

