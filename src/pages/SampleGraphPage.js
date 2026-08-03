import React, {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Box,
} from '@mui/material';

import StandaloneKnowledgeGraph from '../components/StandaloneKnowledgeGraph';

const SAMPLEGRAPH_API_URL = process.env.REACT_APP_SAMPLEGRAPH_API_URL;
const MECHANISMGRAPH_API_URL = process.env.REACT_APP_MECHANISMGRAPH_API_URL;

const loadJson = async (baseUrl, path) => {
  const response = await fetch(`${baseUrl}/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
};

export default function SampleGraphPage({ fixtureName = 'samplegraph' }) {
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setError('');
        const fixtureBaseUrl = `${process.env.PUBLIC_URL || ''}/${fixtureName}`;
        const apiUrl = fixtureName === 'mechanismgraph' ? MECHANISMGRAPH_API_URL : SAMPLEGRAPH_API_URL;
        const loadedDemo = apiUrl && ['samplegraph', 'mechanismgraph'].includes(fixtureName)
          ? await (async () => {
            const response = await fetch(apiUrl);
            if (!response.ok) {
              throw new Error(`Failed to load local T1D demo: ${response.status}`);
            }
            const payload = await response.json();
            return {
              queryRequest: payload.request,
              graphData: payload.combined_query_result,
              coordData: payload.xy_json,
              edgeRoutes: payload.edge_routes || null,
              metadata: payload.metadata,
            };
          })()
          : await Promise.all([
            loadJson(fixtureBaseUrl, 'request.json'),
            loadJson(fixtureBaseUrl, 'graph.json'),
            loadJson(fixtureBaseUrl, 'xy.json'),
            fixtureName === 'mechanismgraph'
              ? loadJson(fixtureBaseUrl, 'edge_routes.json')
              : Promise.resolve(null),
            loadJson(fixtureBaseUrl, 'metadata.json'),
          ]).then(([queryRequest, graphData, coordData, edgeRoutes, metadata]) => ({
            queryRequest,
            graphData,
            coordData,
            edgeRoutes,
            metadata,
          }));

        if (!active) {
          return;
        }

        setDemo(loadedDemo);
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
  }, [fixtureName]);

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
        ) : demo ? (
          <StandaloneKnowledgeGraph
            graphData={demo.graphData}
            coordData={demo.coordData}
            edgeRoutes={demo.edgeRoutes}
            metadata={demo.metadata}
            queryRequest={demo.queryRequest?.cypher?.length ? demo.queryRequest : null}
            queryExamples={[{ label: fixtureName === 'mechanismgraph' ? 'Full static T1D mechanism' : 'Synthetic T1D immune network', request: demo.queryRequest }]}
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
