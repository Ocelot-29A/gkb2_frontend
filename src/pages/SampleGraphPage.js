import React, {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Box,
  CircularProgress,
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

const loadFirstAvailableJson = async (paths) => {
  let lastError = null;

  for (const path of paths) {
    try {
      return await loadJson(path);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to load sample graph data.');
};

export default function SampleGraphPage() {
  const [graphData, setGraphData] = useState(null);
  const [coordData, setCoordData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [queryRequest, setQueryRequest] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setError('');
        const [graph, xy, meta, request] = await Promise.all([
          loadJson('graph.json'),
          loadFirstAvailableJson(['xy_json.json', 'xy.json']),
          loadJson('metadata.json'),
          loadJson('request.json'),
        ]);

        if (!active) {
          return;
        }

        setGraphData(graph);
        setCoordData(xy);
        setMetadata(meta);
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
        ) : graphData && coordData ? (
          <StandaloneKnowledgeGraph
            graphData={graphData}
            coordData={coordData}
            metadata={metadata}
            queryRequest={queryRequest}
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
          >
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Box>
  );
}
