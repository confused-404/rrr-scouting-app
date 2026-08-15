export type GameProfileStatus = 'draft' | 'published' | 'archived';

export type MetricSource = 'scout' | 'tba' | 'statbotics' | 'admin';
export type MetricAggregation = 'average' | 'total' | 'success_rate' | 'latest';
export type MetricScope = 'current_competition' | 'season';
export type MetricFormat = 'number' | 'percentage' | 'text' | 'image';
export type ConfigRole = 'scout' | 'driveTeam' | 'admin';

export type ConfigMetric = {
  id: string;
  label: string;
  source: MetricSource;
  sourceKey: string;
  aggregation: MetricAggregation;
  scope: MetricScope;
  format: MetricFormat;
  visibility: ConfigRole[];
  destinations: Array<'team_lookup' | 'automatic_pick_list' | 'analytics'>;
};

export type TeamLookupCard = {
  id: string;
  label: string;
  metricIds: string[];
  visibility: ConfigRole[];
};

export type PreviewDataSource = 'legacy' | 'test' | 'combined' | 'none';

/** A form remains a single movable section; its fields keep form order. */
export type TeamLookupSection = {
  id: string;
  kind: 'form' | 'metric';
  metricId?: string;
};

export type ProfileTestData = {
  teamNumber: string;
  /** Values use the same form/field IDs as submissions, but never become submissions. */
  forms: Record<string, Record<string, unknown>>;
  metrics: Record<string, unknown>;
};

export type PickListMetricWeight = {
  metricId: string;
  weight: number;
};

export type PickListModel = {
  id: string;
  label: string;
  scope: MetricScope;
  metricWeights: PickListMetricWeight[];
};

export type PickListInputGroup = {
  id: string;
  label: string;
  metricIds: string[];
};

export type AnalysisEquation = {
  id: string;
  label: string;
  scope: MetricScope;
  metricWeights: PickListMetricWeight[];
  weightMode?: 'normalized' | 'ratio';
};

export type GameConfiguration = {
  metrics: ConfigMetric[];
  teamLookupCards: TeamLookupCard[];
  teamLookupSections: TeamLookupSection[];
  pickListModels: PickListModel[];
  pickListGroups: PickListInputGroup[];
  analysisEquations: AnalysisEquation[];
};

export type GameProfile = {
  id: string;
  name: string;
  season: string;
  status: GameProfileStatus;
  locked: boolean;
  configuration: GameConfiguration;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
};
