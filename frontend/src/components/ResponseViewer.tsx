import React, { useState, useEffect } from 'react';
import type { Competition } from '../types/competition.types';
import type { Submission, Form } from '../types/form.types';
import { competitionApi, formApi } from '../services/api';

export const ResponseViewer: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition) {
      loadData();
    }
  }, [selectedCompetition]);

  const loadCompetitions = async () => {
    try {
      const data = await competitionApi.getAll();
      setCompetitions(data);
      if (data.length > 0) {
        setSelectedCompetition(data[0]);
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
    }
  };

  const loadData = async () => {
    if (!selectedCompetition) return;

    setLoading(true);
    try {
      const [subs, forms] = await Promise.all([
        formApi.getSubmissionsByCompetition(selectedCompetition.id),
        formApi.getFormsByCompetition(selectedCompetition.id)
      ]);
      
      setSubmissions(subs);
      setForm(forms.length > 0 ? forms[0] : null);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Competition
        </label>
        <select
          value={selectedCompetition?.id || ''}
          onChange={(e) => {
            const comp = competitions.find(c => c.id === e.target.value);
            setSelectedCompetition(comp || null);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {competitions.map((comp) => (
            <option key={comp.id} value={comp.id}>
              {comp.name} ({comp.season}) - {submissions.length} responses
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
          <p>Loading responses...</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
          <p>No responses yet for this competition</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">
            Responses ({submissions.length})
          </h2>
          <div className="space-y-4">
            {submissions.map((submission) => (
              <div key={submission.id} className="border-b border-gray-200 pb-4 last:border-0">
                <p className="text-sm text-gray-500 mb-2">
                  {new Date(submission.timestamp).toLocaleString()}
                </p>
                {form && Object.entries(submission.data).map(([fieldId, value]) => {
                  const field = form.fields.find(f => f.id === parseInt(fieldId));
                  return field ? (
                    <div key={fieldId} className="mb-2">
                      <p className="font-medium text-sm">{field.label}</p>
                      <p className="text-gray-700">{String(value)}</p>
                    </div>
                  ) : null;
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};