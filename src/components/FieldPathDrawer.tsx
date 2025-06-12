
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Save } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface FieldPathDrawerProps {
  onPathChange: (path: Point[]) => void;
  initialPath?: Point[];
}

const FieldPathDrawer = ({ onPathChange, initialPath = [] }: FieldPathDrawerProps) => {
  const [path, setPath] = useState<Point[]>(initialPath);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const FIELD_WIDTH = 648; // 54 feet in inches / 12 = 54 feet represented
  const FIELD_HEIGHT = 324; // 27 feet in inches / 12 = 27 feet represented

  useEffect(() => {
    drawField();
  }, [path]);

  const drawField = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw field background
    ctx.fillStyle = '#1f2937'; // Gray background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw field border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Draw center line
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // Draw alliance zones (simplified)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Red alliance
    ctx.fillRect(0, 0, canvas.width / 6, canvas.height);
    
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Blue alliance
    ctx.fillRect(canvas.width - canvas.width / 6, 0, canvas.width / 6, canvas.height);

    // Draw path
    if (path.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      // Draw lines between points
      if (path.length > 1) {
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      }

      // Draw points
      ctx.fillStyle = '#10b981';
      path.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw point number
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText((index + 1).toString(), point.x, point.y + 4);
        ctx.fillStyle = '#10b981';
      });
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const newPath = [...path, { x, y }];
    setPath(newPath);
    onPathChange(newPath);
  };

  const clearPath = () => {
    setPath([]);
    onPathChange([]);
  };

  const undoLastPoint = () => {
    const newPath = path.slice(0, -1);
    setPath(newPath);
    onPathChange(newPath);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Autonomous Path</span>
          <div className="flex space-x-2">
            <Badge variant="outline">{path.length} points</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex space-x-2 justify-center">
            <Button onClick={undoLastPoint} variant="outline" size="sm" disabled={path.length === 0}>
              Undo Point
            </Button>
            <Button onClick={clearPath} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear Path
            </Button>
          </div>
          
          <div ref={containerRef} className="border rounded-lg overflow-hidden bg-gray-800">
            <canvas
              ref={canvasRef}
              width={FIELD_WIDTH}
              height={FIELD_HEIGHT}
              onClick={handleCanvasClick}
              className="w-full h-auto cursor-crosshair max-w-full"
              style={{ display: 'block' }}
            />
          </div>
          
          <div className="text-sm text-muted-foreground text-center">
            Click on the field to add waypoints for the autonomous path
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FieldPathDrawer;
