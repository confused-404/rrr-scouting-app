
import { useState, useEffect } from 'react';
import type { FormField } from '@/components/FormConfiguration';

interface FormConfiguration {
  matchScouting: FormField[];
  pitScouting: FormField[];
}

const defaultConfig: FormConfiguration = {
  matchScouting: [
    { id: 'teamNumber', label: 'Team Number', type: 'number', required: true },
    { id: 'matchNumber', label: 'Match Number', type: 'number', required: true },
    { id: 'alliance', label: 'Alliance', type: 'select', options: ['red', 'blue'], required: true },
    { id: 'autoGamePieces', label: 'Auto Game Pieces', type: 'number', required: false },
    { id: 'autoMobility', label: 'Auto Mobility', type: 'select', options: ['yes', 'no'], required: false },
    { id: 'teleopGamePieces', label: 'Teleop Game Pieces', type: 'number', required: false },
    { id: 'climbing', label: 'Climbing', type: 'select', options: ['success', 'fail', 'not attempted'], required: false },
    { id: 'defense', label: 'Defense Rating (1-10)', type: 'number', required: false },
    { id: 'reliability', label: 'Reliability Rating (1-10)', type: 'number', required: false },
    { id: 'comments', label: 'Additional Comments', type: 'textarea', required: false }
  ],
  pitScouting: [
    { id: 'teamNumber', label: 'Team Number', type: 'number', required: true },
    { id: 'robotWeight', label: 'Robot Weight (lbs)', type: 'text', required: false },
    { id: 'drivetrainType', label: 'Drivetrain Type', type: 'select', 
      options: ['Tank Drive', 'Mecanum Drive', 'Swerve Drive', 'West Coast Drive', 'Other'], required: false },
    { id: 'autoCapabilities', label: 'Autonomous Capabilities', type: 'textarea', required: false },
    { id: 'teamExperience', label: 'Team Experience Level', type: 'select', 
      options: ['Rookie', 'Sophomore', 'Veteran', 'Elite'], required: false }
  ]
};

export const useFormConfiguration = () => {
  const [config, setConfig] = useState<FormConfiguration>(defaultConfig);

  useEffect(() => {
    const loadConfig = () => {
      const savedConfig = localStorage.getItem('formConfiguration');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }
    };

    loadConfig();

    // Listen for configuration updates
    const handleConfigUpdate = () => {
      loadConfig();
    };

    window.addEventListener('formConfigurationUpdated', handleConfigUpdate);

    return () => {
      window.removeEventListener('formConfigurationUpdated', handleConfigUpdate);
    };
  }, []);

  return config;
};
