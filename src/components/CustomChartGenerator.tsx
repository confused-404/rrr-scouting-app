
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter } from "recharts";
import { BarChart3, TrendingUp, ScatterChart as ScatterIcon } from "lucide-react";

interface ScoutingData {
  id: number;
  teamNumber: string;
  matchNumber: string;
  alliance: string;
  autoGamePieces: number;
  autoMobility: string;
  teleopGamePieces: number;
  climbing: string;
  defense: number;
  reliability: number;
  comments: string;
  timestamp: string;
  [key: string]: any;
}

interface CustomChartGeneratorProps {
  scoutingData: ScoutingData[];
  teamNames?: Map<string, string>;
}

import { getTeamNameWithCustom } from "@/lib/teamNames";
import { useFormConfiguration } from '@/hooks/useFormConfiguration';
import { getFieldValue, toNumber } from '@/lib/analyticsUtils';

const CustomChartGenerator = ({ scoutingData, teamNames }: CustomChartGeneratorProps) => {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'scatter'>('bar');
  const [xAxis, setXAxis] = useState<string>('teamNumber');
  const [yAxis, setYAxis] = useState<string>('autoGamePieces');
  const [chartData, setChartData] = useState<any[]>([]);
  const formConfig = useFormConfiguration();

  // Get available numeric and categorical fields from the matchScouting form configuration
  const matchFields = formConfig?.matchScouting ?? [];
  const numericFields = matchFields.filter(f => f.type === 'number').map(f => f.id);
  const categoricalFields = matchFields.filter(f => f.type !== 'number').map(f => f.id);
  const allFields = matchFields.map(f => f.id);

  // mapping from id to label for display purposes
  const fieldLabelMap = matchFields.reduce<Record<string, string>>((acc, f) => ({ ...acc, [f.id]: f.label }), {});

  useEffect(() => {
    // If the form config changes and the selected axes are no longer present,
    // update them safely to a valid field.
    if (allFields.length && !allFields.includes(xAxis)) {
      setXAxis(allFields[0]);
    }
    if (allFields.length && !numericFields.includes(yAxis)) {
      // choose a numeric field first for the y-axis if available, otherwise clear
      const preferredY = numericFields.length ? numericFields[0] : '';
      setYAxis(preferredY);
    }
    generateChartData();
  }, [xAxis, yAxis, chartType, scoutingData, formConfig]);

  const generateChartData = () => {
    if (!scoutingData.length) return;

    // Scatter: one datapoint per scouting entry
    if (chartType === 'scatter') {
      const scatterData = scoutingData.map(item => {
        const xRaw = getFieldValue(item, xAxis) ?? item[xAxis];
        const yRaw = getFieldValue(item, yAxis) ?? item[yAxis];
        const xVal = numericFields.includes(xAxis) ? toNumber(xRaw) : xRaw;
        const yVal = numericFields.includes(yAxis) ? toNumber(yRaw) : yRaw;

        return {
          [xAxis]: xVal,
          [yAxis]: yVal,
          teamNumber: item.teamNumber,
          teamName: item.teamNumber ? (teamNames?.get(item.teamNumber) || getTeamNameWithCustom(item.teamNumber)) : undefined
        };
      }).filter(d => d && d[yAxis] !== undefined && d[yAxis] !== null && d[yAxis] !== '' && !(Number.isNaN(d[yAxis]) && numericFields.includes(yAxis)));

      setChartData(scatterData as any);
      return;
    }

    // Group data by x-axis field and aggregate y-axis values
    const grouped = scoutingData.reduce((acc, item) => {
      const xRaw = getFieldValue(item, xAxis) ?? item[xAxis];
      const yRaw = getFieldValue(item, yAxis) ?? item[yAxis];
      const xValue = numericFields.includes(xAxis) ? toNumber(xRaw) : String(xRaw ?? '');
      const yValue = numericFields.includes(yAxis) ? (toNumber(yRaw) || 0) : (yRaw ?? '');

      if (!acc[xValue]) {
        acc[xValue] = { [xAxis]: xValue, values: [], count: 0, categories: {} };
      }

      if (numericFields.includes(yAxis)) {
        acc[xValue].values.push(yValue);
      } else {
        acc[xValue].categories[yValue] = (acc[xValue].categories[yValue] || 0) + 1;
      }
      acc[xValue].count++;

      return acc;
    }, {} as any);

    // Calculate aggregated values
    const processedData = Object.values(grouped).map((group: any) => {
      const sum = (group.values || []).reduce((a: number, b: number) => a + b, 0);
      const avg = group.values && group.values.length ? sum / group.values.length : 0;
      const max = group.values && group.values.length ? Math.max(...group.values) : 0;
      const min = group.values && group.values.length ? Math.min(...group.values) : 0;

      return {
        [xAxis]: group[xAxis],
        teamName: xAxis === 'teamNumber' ? (teamNames?.get(group[xAxis]) || getTeamNameWithCustom(group[xAxis])) : undefined,
        average: parseFloat(avg.toFixed(2)),
        total: sum,
        maximum: max,
        minimum: min,
        count: group.count,
        value: numericFields.includes(yAxis) ? avg : Object.entries(group.categories || {}).map(([k, v]) => ({ category: k, count: v }))
      };
    });

    setChartData(processedData);
  };

  const getYAxisDataKey = () => {
    if (chartType === 'scatter') return yAxis;
    return numericFields.includes(yAxis) ? 'average' : 'count';
  };

  const renderChart = () => {
    if (!chartData.length) {
      return <div className="text-center text-muted-foreground py-8">No data available for selected fields</div>;
    }

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} type={numericFields.includes(xAxis) ? "number" : "category"} />
              <YAxis type="number" />
              <Tooltip 
                formatter={(value, name, props) => [value, `${numericFields.includes(yAxis) ? 'Average ' : ''}${fieldLabelMap[yAxis] || yAxis}`]}
                labelFormatter={(label, payload) => {
                  if (xAxis === 'teamNumber' && payload && payload[0]) {
                    const teamName = payload[0].payload.teamName;
                    return `Team ${label}${teamName ? ` - ${teamName}` : ''}`;
                  }
                  return `${fieldLabelMap[xAxis] || xAxis}: ${label}`;
                }}
              />
              <Bar dataKey={getYAxisDataKey()} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} type={numericFields.includes(xAxis) ? "number" : "category"} />
              <YAxis type="number" />
              <Tooltip 
                formatter={(value, name, props) => [value, `${numericFields.includes(yAxis) ? 'Average ' : ''}${fieldLabelMap[yAxis] || yAxis}`]}
                labelFormatter={(label, payload) => {
                  if (xAxis === 'teamNumber' && payload && payload[0]) {
                    const teamName = payload[0].payload.teamName;
                    return `Team ${label}${teamName ? ` - ${teamName}` : ''}`;
                  }
                  return `${fieldLabelMap[xAxis] || xAxis}: ${label}`;
                }}
              />
              <Line type="monotone" dataKey={getYAxisDataKey()} stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={xAxis} 
                type={numericFields.includes(xAxis) ? "number" : "category"}
              />
              <YAxis 
                dataKey={getYAxisDataKey()}
                type="number"
              />
              <Tooltip 
                formatter={(value, name, props) => [value, fieldLabelMap[yAxis] || yAxis]}
                labelFormatter={(label, payload) => {
                  if (xAxis === 'teamNumber' && payload && payload[0]) {
                    const teamName = payload[0].payload.teamName;
                    return `Team ${label}${teamName ? ` - ${teamName}` : ''}`;
                  }
                  return `${fieldLabelMap[xAxis] || xAxis}: ${label}`;
                }}
              />
              <Scatter dataKey={getYAxisDataKey()} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <span>Custom Chart Generator</span>
        </CardTitle>
        <CardDescription>
          Create custom visualizations from your scouting data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Chart Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Chart Type</Label>
              <Select value={chartType} onValueChange={(value: 'bar' | 'line' | 'scatter') => setChartType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Bar Chart</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="line">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4" />
                      <span>Line Chart</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="scatter" disabled={!(numericFields.includes(yAxis) && numericFields.includes(xAxis))}>
                    <div className="flex items-center space-x-2">
                      <ScatterIcon className="h-4 w-4" />
                      <span>Scatter Plot</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>X-Axis</Label>
              <Select value={xAxis} onValueChange={setXAxis}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {matchFields.map(field => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Y-Axis</Label>
              <Select value={yAxis} onValueChange={setYAxis} disabled={numericFields.length === 0}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {numericFields.length > 0 ? (
                    numericFields.map(fieldId => (
                      <SelectItem key={fieldId} value={fieldId}>
                        {fieldLabelMap[fieldId] || fieldId}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>
                      No numeric fields available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chart Display */}
          <div className="border rounded-lg p-4">
            {renderChart()}
          </div>

          {/* Chart Info */}
          <div className="text-sm text-muted-foreground">
            <p>
              <strong>Data Points:</strong> {chartData.length} • 
              <strong> Aggregation:</strong> {numericFields.includes(yAxis) ? 'Average values' : 'Count'} • 
              <strong> Source:</strong> {scoutingData.length} scouting entries
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomChartGenerator;
