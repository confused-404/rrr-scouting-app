
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter } from "recharts";
import { BarChart3, TrendingUp, Scatter as ScatterIcon } from "lucide-react";

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
}

const CustomChartGenerator = ({ scoutingData }: CustomChartGeneratorProps) => {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'scatter'>('bar');
  const [xAxis, setXAxis] = useState<string>('teamNumber');
  const [yAxis, setYAxis] = useState<string>('autoGamePieces');
  const [chartData, setChartData] = useState<any[]>([]);

  // Get available numeric and categorical fields
  const numericFields = ['autoGamePieces', 'teleopGamePieces', 'defense', 'reliability', 'matchNumber'];
  const categoricalFields = ['teamNumber', 'alliance', 'climbing', 'autoMobility'];
  const allFields = [...numericFields, ...categoricalFields];

  useEffect(() => {
    generateChartData();
  }, [xAxis, yAxis, chartType, scoutingData]);

  const generateChartData = () => {
    if (!scoutingData.length) return;

    // Group data by x-axis field and aggregate y-axis values
    const grouped = scoutingData.reduce((acc, item) => {
      const xValue = item[xAxis];
      const yValue = parseFloat(item[yAxis]) || 0;

      if (!acc[xValue]) {
        acc[xValue] = { [xAxis]: xValue, values: [], count: 0 };
      }
      
      acc[xValue].values.push(yValue);
      acc[xValue].count++;
      
      return acc;
    }, {} as any);

    // Calculate aggregated values
    const processedData = Object.values(grouped).map((group: any) => {
      const sum = group.values.reduce((a: number, b: number) => a + b, 0);
      const avg = sum / group.values.length;
      const max = Math.max(...group.values);
      const min = Math.min(...group.values);

      return {
        [xAxis]: group[xAxis],
        average: parseFloat(avg.toFixed(2)),
        total: sum,
        maximum: max,
        minimum: min,
        count: group.count,
        // For scatter plots, use individual values
        value: numericFields.includes(yAxis) ? avg : group.values[0]
      };
    });

    setChartData(processedData);
  };

  const getYAxisDataKey = () => {
    if (chartType === 'scatter') return 'value';
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
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, `Average ${yAxis}`]}
                labelFormatter={(label) => `${xAxis}: ${label}`}
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
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, `Average ${yAxis}`]}
                labelFormatter={(label) => `${xAxis}: ${label}`}
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
                formatter={(value, name) => [value, yAxis]}
                labelFormatter={(label) => `${xAxis}: ${label}`}
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
                  <SelectItem value="scatter">
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
                  {allFields.map(field => (
                    <SelectItem key={field} value={field}>
                      {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Y-Axis</Label>
              <Select value={yAxis} onValueChange={setYAxis}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {numericFields.map(field => (
                    <SelectItem key={field} value={field}>
                      {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </SelectItem>
                  ))}
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
