export interface ExtractedWord {
  dutch_text: string;
  french_text: string;
  frequency?: number;
  isDuplicate?: boolean;
  existingLessonId?: string;
  existingLessonTitle?: string;
  selected: boolean;
}

