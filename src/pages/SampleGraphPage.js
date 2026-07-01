import React, {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
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
  const [graphData, setGraphData] = useState(null);
  const [coordData, setCoordData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setError('');
        const [graph, xy, meta] = await Promise.all([
          loadJson('graph.json'),
          loadJson('xy.json'),
          loadJson('metadata.json'),
        ]);

        if (!active) {
          return;
        }

        setGraphData(graph);
        setCoordData(xy);
        setMetadata(meta);
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
        padding: { xs: '20px', md: '28px 36px 36px' },
        boxSizing: 'border-box',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#F9FBFE',
          border: '1px solid #E7EDF5',
          borderRadius: '24px',
          padding: { xs: '20px', md: '28px' },
          boxShadow: '8px 6px 33px 0px #D8E6F833',
        }}
      >
        <Stack spacing={2} sx={{ marginBottom: 3 }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: '#244361' }}>
            Sample Graph Viewer
          </Typography>
          <Typography sx={{ fontSize: 15, color: '#557086', maxWidth: '920px' }}>
            This page renders the sample graph from the handoff dataset with its own preset coordinates from xy.json and the migrated hover information panel.
          </Typography>
          {metadata && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Typography sx={{ fontSize: 13, color: '#557086' }}>
                Layout mode: <strong>{metadata.layout?.mode || 'unknown'}</strong>
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#557086' }}>
                Nodes: <strong>{metadata.filtered_node_count ?? graphData?.nodes?.length ?? 0}</strong>
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#557086' }}>
                Edges: <strong>{metadata.filtered_edge_count ?? graphData?.edges?.length ?? 0}</strong>
              </Typography>
            </Stack>
          )}
        </Stack>

        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : graphData && coordData ? (
          <StandaloneKnowledgeGraph
            graphData={graphData}
            coordData={coordData}
            metadata={metadata}
            containerHeight="calc(100vh - 260px)"
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
      </Paper>
    </Box>
  );
}