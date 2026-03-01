export type CompetitionStatus = 'draft' | 'active' | 'completed' | 'archived';

export type Competition = {
  id: string;
  name: string;
  season: string;
  status: CompetitionStatus;
  startDate: string;
  endDate: string;
  formIds: string[];
  /**
   * For legacy code this may still be present (single active form),
   * but new logic uses activeFormIds array for multiple selections.
   */
  activeFormId?: string;
  activeFormIds?: string[];
  createdAt: string;
};