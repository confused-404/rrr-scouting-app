
import { FormField } from "@/components/FormConfiguration";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

interface DynamicFormRendererProps {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
}

const DynamicFormRenderer = ({ fields, values, onChange }: DynamicFormRendererProps) => {
  const renderField = (field: FormField) => {
    const value = values[field.id] || '';

    switch (field.type) {
      case 'text':
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            required={field.required}
          />
        );
      
      case 'number':
        const numeric = value === '' || value === null || value === undefined ? 0 : Number(value);
        return (
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(field.id, Math.max( (Number.isNaN(numeric) ? 0 : numeric) - 1, 0))}
              aria-label={`Decrease ${field.label}`}
            >
              <Minus className="h-3 w-3" />
            </Button>

            <Input
              type="number"
              value={numeric}
              onChange={(e) => onChange(field.id, e.target.value === '' ? '' : Number(e.target.value))}
              required={field.required}
              className="w-24 text-center"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(field.id, (Number.isNaN(numeric) ? 0 : numeric) + 1)}
              aria-label={`Increase ${field.label}`}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        );
      
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            required={field.required}
            rows={3}
          />
        );
      
      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(val) => onChange(field.id, val)}
            required={field.required}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {renderField(field)}
        </div>
      ))}
    </div>
  );
};

export default DynamicFormRenderer;
