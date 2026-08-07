import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Box,
} from '@mui/material';

import StandaloneKnowledgeGraph from '../components/StandaloneKnowledgeGraph';
import { createT1dGpsAuthoringAdapter } from './t1dGpsAuthoringAdapter';

const SAMPLEGRAPH_API_URL = process.env.REACT_APP_SAMPLEGRAPH_API_URL;
const MECHANISMGRAPH_API_URL = process.env.REACT_APP_MECHANISMGRAPH_API_URL;
const T1D_GPS_V4_S3_BASE_URL = 'https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v4';
const T1D_GPS_V4_FIXTURE_BASE_URL = process.env.REACT_APP_T1D_GPS_V4_FIXTURE_BASE_URL;
const T1D_GPS_V5_S3_BASE_URL = 'https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v5';
const T1D_GPS_V5_FIXTURE_BASE_URL = process.env.REACT_APP_T1D_GPS_V5_FIXTURE_BASE_URL;
const T1D_GPS_V6_S3_BASE_URL = 'https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v6';
const T1D_GPS_V6_FIXTURE_BASE_URL = process.env.REACT_APP_T1D_GPS_V6_FIXTURE_BASE_URL;

const versionedFixtureConfig = {
  't1d-gps-v4': {
    overrideUrl: T1D_GPS_V4_FIXTURE_BASE_URL,
    deployedUrl: T1D_GPS_V4_S3_BASE_URL,
  },
  't1d-gps-v5': {
    overrideUrl: T1D_GPS_V5_FIXTURE_BASE_URL,
    deployedUrl: T1D_GPS_V5_S3_BASE_URL,
  },
  't1d-gps-v6': {
    overrideUrl: T1D_GPS_V6_FIXTURE_BASE_URL,
    deployedUrl: T1D_GPS_V6_S3_BASE_URL,
  },
};

const fixtureVersionFor = (fixtureName) => Object.keys(versionedFixtureConfig)
  .find((version) => fixtureName.startsWith(`${version}/`));

export const fixtureRootUrlFor = (fixtureName, hostname = window.location.hostname) => {
  const publicBaseUrl = process.env.PUBLIC_URL || '';
  const fixtureVersion = fixtureVersionFor(fixtureName);
  if (!fixtureVersion) {
    return `${publicBaseUrl}/${fixtureName}`;
  }
  const isLocalViewer = ['127.0.0.1', 'localhost'].includes(hostname);
  const { overrideUrl, deployedUrl } = versionedFixtureConfig[fixtureVersion];
  return overrideUrl
    || (isLocalViewer ? `${publicBaseUrl}/${fixtureVersion}` : deployedUrl);
};

export const fixtureBaseUrlFor = (fixtureName, hostname = window.location.hostname) => {
  const fixtureRoot = fixtureRootUrlFor(fixtureName, hostname);
  const fixtureVersion = fixtureVersionFor(fixtureName);
  if (!fixtureVersion) {
    return fixtureRoot;
  }
  const viewPath = fixtureName.slice(`${fixtureVersion}/`.length);
  return `${fixtureRoot.replace(/\/$/, '')}/${viewPath}`;
};

export const exactPreviewCaptureRequested = (search = window.location.search) => {
  const parameters = new URLSearchParams(search || '');
  return parameters.get('graph_preview_capture') === '1'
    || parameters.get('capture') === 'preview';
};

export const graphFocusNodeIdRequested = (search = window.location.search) => {
  const value = new URLSearchParams(search || '').get('focus') || '';
  return /^[A-Za-z0-9_.:-]+$/.test(value) ? value : '';
};

export const t1dGpsDeveloperContextFor = (fixtureName) => {
  const match = /^(t1d-gps-(v[56]))\/(.+)$/.exec(fixtureName || '');
  return match ? { fixtureVersion: match[1], release: match[2], viewId: match[3] } : null;
};

export const withT1dGpsDeveloperMetadata = (metadata, context) => ({
  ...(metadata || {}),
  viewer: { ...(metadata?.viewer || {}), developer_mode: true },
  authoring: {
    ...(metadata?.authoring || {}),
    release: context.release,
    view_id: context.viewId,
    source_checksum: metadata?.source_checksum || '',
  },
});

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
  const isLayeredT1DDemo = fixtureName.startsWith('layeredgraph') || fixtureName.startsWith('t1d-gps-v4') || fixtureName.startsWith('t1d-gps-v5') || fixtureName.startsWith('t1d-gps-v6');
  const developerContext = useMemo(() => t1dGpsDeveloperContextFor(fixtureName), [fixtureName]);
  const exactPreviewCapture = exactPreviewCaptureRequested();
  const requestedFocusNodeId = fixtureName.startsWith('t1d-gps-v6/')
    ? graphFocusNodeIdRequested()
    : '';
  const developerMode = useMemo(() => {
    if (!developerContext) return null;
    const local = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
    const v6ApiBase = process.env.REACT_APP_T1D_GPS_V6_DEV_API_URL;
    const localWritesEnabled = local && (
      developerContext.release === 'v5' || Boolean(v6ApiBase)
    );
    return {
      enabled: true,
      adapter: createT1dGpsAuthoringAdapter({
        local: localWritesEnabled,
        release: developerContext.release,
        ...(v6ApiBase && developerContext.release === 'v6' ? { apiBase: v6ApiBase } : {}),
      }),
      permissions: { editData: true, editInfoPanel: true, saveLayout: true },
    };
  }, [developerContext]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setError('');
        const fixtureBaseUrl = fixtureBaseUrlFor(fixtureName);
        const fixtureAssetBaseUrl = fixtureRootUrlFor(fixtureName);
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
              assetBaseUrl: fixtureAssetBaseUrl,
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
            assetBaseUrl: fixtureAssetBaseUrl,
          }));

        if (!active) {
          return;
        }

        if (developerContext) {
          loadedDemo.metadata = withT1dGpsDeveloperMetadata(loadedDemo.metadata, developerContext);
        }
        if (requestedFocusNodeId) {
          loadedDemo.metadata = {
            ...loadedDemo.metadata,
            layout: {
              ...(loadedDemo.metadata?.layout || {}),
              initial_focus_node_id: requestedFocusNodeId,
            },
          };
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
  }, [fixtureName, developerContext, requestedFocusNodeId]);

  return (
    <Box
      sx={{
        flex: 1,
        width: '100%',
        display: 'flex',
        padding: { xs: '12px', md: '16px 24px' },
        boxSizing: 'border-box',
        background: isLayeredT1DDemo ? 'linear-gradient(180deg, #F7F0E5 0%, #F4EDE2 100%)' : 'transparent',
      }}
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: `3px solid ${isLayeredT1DDemo ? '#FFF9F0' : '#FFFFFF'}`,
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: isLayeredT1DDemo ? '8px 6px 33px 0px rgba(107, 92, 70, 0.14)' : '8px 6px 33px 0px #D8E6F8',
          backgroundImage: isLayeredT1DDemo
            ? 'linear-gradient(165deg, #FBF6EC 10%, #F6EEE2 72%)'
            : 'linear-gradient(170deg, #F5FAFF 10.17%, #FCFCFC 69.1%)',
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
            assetBaseUrl={demo.assetBaseUrl}
            queryExamples={[{ label: fixtureName === 'mechanismgraph' ? 'Full static T1D mechanism' : 'Synthetic T1D immune network', request: demo.queryRequest }]}
            containerHeight="calc(100vh - 315px)"
            developerMode={developerMode}
            exactPreviewCapture={exactPreviewCapture}
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
