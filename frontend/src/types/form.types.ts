export type FormFieldType = 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';

export type FormField = {
  id: number;
  type: FormFieldType;
  label: string;
  required: boolean;
  options?: string[];
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