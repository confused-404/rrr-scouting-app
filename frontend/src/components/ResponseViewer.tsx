import React, { useState, useEffect } from 'react';
import type { Competition } from '../types/competition.types';
import type { Submission, Form } from '../types/form.types';
import { competitionApi, formApi } from '../services/api';

export const ResponseViewer: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition) {
      loadForms();
    }
  }, [selectedCompetition]);

  useEffect(() => {
    if (selectedForm) {
      loadSubmissions();
    }
  }, [selectedForm]);

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

  const loadForms = async () => {
    if (!selectedCompetition) return;

    setLoading(true);
    try {
      const data = await formApi.getFormsByCompetition(selectedCompetition.id);
      setForms(data);
      if (data.length > 0) {
        setSelectedForm(data[0]);
      } else {
        setSelectedForm(null);
        setSubmissions([]);
      }
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async () => {
    if (!selectedForm) return;

    setLoading(true);
    try {
      const subs = await formApi.getSubmissions(selectedForm.id);
      setSubmissions(subs);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Competition Selection */}
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
              {comp.name} ({comp.season}) - {comp.status}
            </option>
          ))}
        </select>
      </div>

      {/* Form Selection */}
      {selectedCompetition && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Form
          </label>
          {forms.length === 0 ? (
            <p className="text-gray-500 text-sm">No forms available for this competition</p>
          ) : (
            <select
              value={selectedForm?.id || ''}
              onChange={(e) => {
                const form = forms.find(f => f.id === e.target.value);
                setSelectedForm(form || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name} ({form.fields.length} field{form.fields.length !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Responses Display */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
          <p>Loading responses...</p>
        </div>
      ) : !selectedForm ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
          <p>Select a form to view responses</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
          <p>No responses yet for {selectedForm.name}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">
            Responses for {selectedForm.name} ({submissions.length})
          </h2>
          <div className="space-y-4">
            {submissions.map((submission) => (
              <div key={submission.id} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-3">
                  Submitted: {new Date(submission.timestamp).toLocaleString()}
                </p>
                <div className="space-y-2">
                  {Object.entries(submission.data).map(([fieldId, value]) => {
                    const field = selectedForm.fields.find(f => f.id === parseInt(fieldId));
                    return field ? (
                      <div key={fieldId} className="border-l-2 border-blue-500 pl-3">
                        <p className="font-medium text-sm text-gray-700">{field.label}</p>
                        <p className="text-gray-900">{String(value)}</p>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};