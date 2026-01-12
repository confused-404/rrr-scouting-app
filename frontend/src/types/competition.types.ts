export type CompetitionStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface Competition {
  id: string;
  name: string;
  season: string;
  status: CompetitionStatus;
  startDate: string;
  endDate: string;
  activeFormId?: string;
  createdAt: string;
}