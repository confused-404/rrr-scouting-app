export type FormFieldType =
  | 'number'
  | 'ranking'
  | 'text'
  | 'multiple_choice'
  | 'multiple_select';

export type FormField = {
  id: number;
  type: FormFieldType;
  label: string;
  required: boolean;
  options?: string[];
  unit?: string;

  // ranking-specific
  min?: number;
  max?: number;

  // conditional logic
  condition?: {
    fieldId: number; // ID of the field this depends on
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains';
    value: string | number | string[]; // value(s) to match
  };
};

export type Form = {
  id: string;
  competitionId: string;
  name: string;
  fields: FormField[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Submission = {
  id: string;
  formId: string;
  competitionId: string;
  timestamp: string;
  data: Record<string, any>;
};