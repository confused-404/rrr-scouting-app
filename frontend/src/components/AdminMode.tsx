import React, { useState } from 'react';
import { Settings, FileText, BarChart, Download } from 'lucide-react';
import { CompetitionManager } from './CompetitionManager';
import { FormManager } from './FormManager';
import { ResponseViewer } from './ResponseViewer';
import { formApi } from '../services/api';

type AdminTab = 'competitions' | 'forms' | 'responses';

export const AdminMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('competitions');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);

      if (!selectedFormId) {
        alert("Please go to the 'Responses' tab and select a specific form to export.");
        return;
      }

      // Fetch specific form and submissions
      const [form, submissions] = await Promise.all([
        formApi.getForm(selectedFormId),
        formApi.getSubmissions(selectedFormId)
      ]);

      if (!submissions || submissions.length === 0) {
        alert(`No responses found for the form: ${form.name}`);
        return;
      }

      // Use labels as headers to fix the scientific notation/ID issue
      const headers = form.fields.map(f => f.label);
      const fieldIds = form.fields.map(f => String(f.id));

      const csvRows = submissions.map((sub: any) => {
        return fieldIds.map(id => {
          const val = sub.data[id] ?? '';
          const displayVal = Array.isArray(val) ? val.join('; ') : val;
          return `"${String(displayVal).replace(/"/g, '""')}"`;
        }).join(',');
      });

      const csvContent = [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${form.name.replace(/\s+/g, '_')}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Export failed:", error);
      alert("Error exporting form data.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-100">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('competitions')}
            className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'competitions' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Settings size={18} /> Competitions
          </button>
          <button
            onClick={() => setActiveTab('forms')}
            className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'forms' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText size={18} /> Forms
          </button>
          <button
            onClick={() => setActiveTab('responses')}
            className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'responses' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart size={18} /> Responses
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="px-6 py-2 rounded-md flex items-center justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300 transition-all font-medium"
          >
            <Download size={18} />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {activeTab === 'competitions' && (
        <CompetitionManager onSelect={(id: string) => setSelectedCompId(id)} />
      )}
      
      {activeTab === 'forms' && <FormManager />}
      
      {activeTab === 'responses' && (
        <ResponseViewer 
          competitionId={selectedCompId || undefined} 
          onFormSelect={(id) => setSelectedFormId(id)}
        />
      )}
    </div>
  );
};