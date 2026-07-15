import React, {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Box,
} from '@mui/material';

import StandaloneKnowledgeGraph from '../components/StandaloneKnowledgeGraph';

const SAMPLEGRAPH_BASE_URL = `${process.env.PUBLIC_URL || ''}/samplegraph`;

const loadJson = async (path) => {
  const response = await fetch(`${SAMPLEGRAPH_BASE_URL}/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
};

export default function SampleGraphPage() {
  const [queryRequest, setQueryRequest] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setError('');
        const request = await loadJson('request.json');

        if (!active) {
          return;
        }

        setQueryRequest(request);
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load sample graph data.');
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Box
      sx={{
        flex: 1,
        width: '100%',
        display: 'flex',
        padding: { xs: '12px', md: '16px 24px' },
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: '3px solid #FFFFFF',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '8px 6px 33px 0px #D8E6F8',
          backgroundImage: 'linear-gradient(170deg, #F5FAFF 10.17%, #FCFCFC 69.1%)',
        }}
      >
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : queryRequest ? (
          <StandaloneKnowledgeGraph
            queryExamples={[{ label: 'Initial sample graph', request: queryRequest }]}
            containerHeight="calc(100vh - 315px)"
            defaultLegendVisible={true}
          />
        ) : (
          <Box
            sx={{
              minHeight: '520px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        )}
      </Box>
    </Box>
  );
}
