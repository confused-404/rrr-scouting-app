export type FormFieldType =
  | 'number'
  | 'picture'
  | 'ranking'
  | 'rank_order'
  | 'text'
  | 'multiple_choice'
  | 'multiple_select';

export type PictureFieldValue = {
  url: string;
  path: string;
  name: string;
  contentType: string;
  size: number;
  bucket?: string;
  uploadedAt?: string;
};

export interface FormField {
  id: number;
  type: FormFieldType;
  label: string;
  required: boolean;
  options?: string[]; // Used by multiple_choice, multiple_select, and rank_order
  unit?: string;      // Used by number fields

  // ranking-specific properties
  min?: number;
  max?: number;

  // conditional logic
  condition?: {
    fieldId: number; 
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains';
    value: string; // FormManager handles this primarily as a string input
  };
}

export interface Form {
  id: string;
  competitionId: string;
  name: string;
  fields: FormField[];
  teamNumberFieldId?: number | null; // Critical for cross-referencing team data
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  formId: string;
  competitionId: string;
  timestamp: string;
  /** * Maps field.id to the user's response.
   * AdminMode uses this to extract team numbers and climb data.
   */
  data: Record<string, any>; 
}