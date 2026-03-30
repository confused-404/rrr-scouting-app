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
  matchTime?: number;
};

export type ManualPickList = {
  id: string;
  name: string;
  teamBank: string[];
  firstPickRankings: string[];
  secondPickRankings: string[];
  thirdPickRankings: string[];
};

export type SuperscoutEntry = {
  notes: string;
  rating: number | null; // now 1–5 scale
};

export type RobotBreakTimelineOverrideStatus = 'broke' | 'ok' | 'unknown';

export type RobotBreakTimelineOverride = {
  status: RobotBreakTimelineOverrideStatus;
  description: string;
  updatedAt?: string;
};

export type Competition = {
  id: string;
  name: string;
  season: string;
  status: CompetitionStatus;
  startDate: string;
  endDate: string;
  formIds: string[];
  activeFormId?: string;
  activeFormIds?: string[];
  scoutingTeams?: ScoutingTeam[];
  scoutingAssignments?: GeneratedAssignment[];
  eventKey?: string;
  pitMapImageUrl?: string;
  manualPickLists?: ManualPickList[];

  // ✅ fixed typing
  superscouterNotes?: Record<string, SuperscoutEntry | string>;
  driveTeamStrategyByTeam?: Record<string, string | Record<string, string>>;
  robotBreakTimelineOverrides?: Record<string, Record<string, RobotBreakTimelineOverride>>;

  createdAt: string;
};