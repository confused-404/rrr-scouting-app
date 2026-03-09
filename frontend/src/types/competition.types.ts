export type CompetitionStatus = 'draft' | 'active' | 'completed' | 'archived';

export type Scout = {
  name: string;
};

export type ScoutingTeam = {
  id: string;
  name: string;
  members: Scout[];
};

export type GeneratedAssignment = {
  matchNumber: number;
  position: 'red1' | 'red2' | 'red3' | 'blue1' | 'blue2' | 'blue3';
  teamId: string;
  teamName: string;
  scouts: string[];
  matchTime?: number; // Unix timestamp
};

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
  scoutingTeams?: ScoutingTeam[];
  scoutingAssignments?: GeneratedAssignment[];
  eventKey?: string; // TBA event key
  pitMapImageUrl?: string;
  createdAt: string;
};