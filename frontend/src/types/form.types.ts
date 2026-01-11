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
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
};

export type Submission = {
  id: string;
  formId: string;
  timestamp: string;
  data: Record<string, any>;
};