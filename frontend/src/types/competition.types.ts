export type CompetitionStatus = 'draft' | 'active' | 'completed' | 'archived';

export type Competition = {
  id: string;
  name: string;
  season: string;
  status: CompetitionStatus;
  startDate: string;
  endDate: string;
  formIds: string[];
  activeFormId?: string;
  createdAt: string;
};