export type ItemType = 'folder' | 'file' | 'quiz' | 'question';

export type FileType = 'pdf' | 'document' | 'image' | 'video' | 'audio' | 'text_note' | 'archive' | 'presentation';

export type QuestionType =
  | 'multiple_choice'
  | 'multi_select'
  | 'true_false'
  | 'written'
  | 'matching'
  | 'osce_station'
  | 'slide'
  | 'content_block';

export interface RatingSummary {
  avg: number;
  count: number;
  total: number;
}

export interface TagPlacement {
  category_id: string;
  parent_tag_id?: string | null;
  sort_order?: number;
}

export interface TagCategory {
  id: string;
  name: string;
  icon: string;
  description?: string;
  linked_from_category_ids?: string[];
  sort_order?: number;
}

export interface TagItem {
  id: string;
  name: string;
  name_en?: string;
  icon: string;
  logo_url?: string;
  category_id: string;
  parent_tag_id?: string | null;
  placements?: TagPlacement[];
  description?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parent_id: string | null;
  type: 'folder';
  item_type?: 'folder';
  created_at: string;
  tags: string[];
  inherited_tags?: string[];
  description: string;
  children: string[];
  files_count?: number;
  subfolders_count?: number;
  total_size?: number;
  total_size_formatted?: string;
  rating?: RatingSummary;
  user_rating?: number;
  folder_path?: string[];
}

export interface FileItem {
  id: string;
  name: string;
  file_name: string;
  file_type: FileType;
  type?: FileType;
  item_type?: 'file';
  file_size: number;
  file_size_formatted: string;
  folder_id: string;
  tags: string[];
  inherited_tags?: string[];
  description: string;
  content?: string;
  content_preview?: string;
  upload_date: string;
  created_at: string;
  downloads: number;
  url?: string;
  rating?: RatingSummary;
  user_rating?: number;
  folder_path?: string[];
  uploaded_by?: {
    id: string;
    name: string;
    source?: 'web' | 'bot' | 'google';
    avatar_url?: string;
  };
}

export interface QuestionOption {
  text: string;
  image_file_ids?: string[];
  explanation?: {
    text: string;
    image_file_ids?: string[];
  };
}

export interface OsceChecklistItem {
  text: string;
  points: number;
  critical: boolean;
}

export interface SlideSubQuestion {
  text: string;
  accepted_answers: string[];
  notes?: string;
}

export interface SlideEntry {
  image_url?: string;
  caption?: string;
  questions: SlideSubQuestion[];
}

export interface QuestionItem {
  id: string;
  quiz_id: string | null;
  folder_id?: string | null;
  type: QuestionType;
  text: string;
  points: number;
  sort_order: number;
  tags: string[];
  explanation: {
    text: string;
    image_file_ids?: string[];
  };
  options?: QuestionOption[];
  correct_indices?: number[];
  answer?: boolean;
  accepted_answers?: string[];
  pairs?: Array<{ left: string; right: string }>;
  station?: {
    scenario: string;
    instructions: string;
    duration_minutes: number;
    checklist: OsceChecklistItem[];
  };
  slide_notes?: string;
  slide_question?: string;
  slides?: SlideEntry[];
  content_kind?: 'text' | 'document' | 'media' | 'section' | 'divider' | 'embed';
  content_text?: string;
  content_url?: string;
  created_at: string;
}

export interface QuizItem {
  id: string;
  title: string;
  name?: string;
  description: string;
  tags: string[];
  inherited_tags?: string[];
  folder_id: string;
  quiz_type: QuestionType | 'custom';
  question_numbering_template: string;
  option_numbering_template: string;
  questions_count: number;
  created_at: string;
  item_type?: 'quiz';
  rating?: RatingSummary;
  user_rating?: number;
}

export interface PendingBotFile {
  id: string;
  file_name: string;
  file_type: FileType;
  file_size_formatted: string;
  sender_name: string;
  sender_username: string;
  received_at: string;
  caption: string;
  suggested_tags: string[];
}

export interface DeletedItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'quiz' | 'tag';
  deleted_at: string;
  remaining_days: number;
}
