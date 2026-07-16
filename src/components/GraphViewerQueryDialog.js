import React, { useState } from 'react';

import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

export const GRAPH_VIEWER_API_URL = process.env.REACT_APP_GRAPH_VIEWER_API_URL
  || 'https://jieliulab3.dcmb.med.umich.edu/gkb0708/api/graph';
const configuredTimeoutMs = Number.parseInt(process.env.REACT_APP_GRAPH_VIEWER_TIMEOUT_MS, 10);
export const GRAPH_VIEWER_TIMEOUT_MS = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
  ? configuredTimeoutMs
  : 30000;
const DEFAULT_QUERY = 'MATCH (n {id: "ENSG00000001626"})-[r]-(m) WITH n, r, m LIMIT 10 RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes, collect(DISTINCT r) AS edges';

export class GraphViewerRequestError extends Error {
  constructor(message, { code = 'GRAPH_VIEWER_ERROR', status = null, requestId = '', retryable = false, phase = '' } = {}) {
    super(message);
    this.name = 'GraphViewerRequestError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable;
    this.phase = phase;
  }
}

export const formatGraphViewerError = (error) => {
  const message = error?.message || 'Graph viewer request failed.';
  return error?.requestId ? `${message} Request ID: ${error.requestId}` : message;
};

const normalizeInput = (value) => String(value || '')
  .trim()
  .replace(/\r\n/g, '\n')
  .replace(/\\"/g, '"')
  .replace(/,+\s*$/g, '')
  .replace(/\s+WHERE/g, '\nWHERE')
  .replace(/\s+RETURN/g, '\nRETURN')
  .replace(/\s+MATCH/g, '\nMATCH')
  .replace(/\s+WITH/g, '\nWITH');

const parseJson = (value) => {
  try {
    return JSON.parse(String(value || '').trim());
  } catch (error) {
    return null;
  }
};

const stringifyEntry = (entry) => typeof entry === 'string' ? normalizeInput(entry) : JSON.stringify(entry, null, 2);

const normalizeRequestEntry = (entry) => {
  if (typeof entry === 'string') {
    return normalizeInput(entry);
  }

  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    return entry;
  }

  return null;
};

export const parseGraphViewerInputs = (inputs) => inputs.flatMap((input) => {
  const parsed = parseJson(input);
  if (Array.isArray(parsed)) {
    return parsed.map(normalizeRequestEntry);
  }
  if (parsed && Array.isArray(parsed.cypher)) {
    return parsed.cypher.map(normalizeRequestEntry);
  }
  if (parsed && typeof parsed === 'object') {
    return [parsed];
  }
  return [normalizeInput(input)];
}).filter(Boolean);

export const requestGraphViewer = async (
  request,
  { fetchImpl = fetch, timeoutMs = GRAPH_VIEWER_TIMEOUT_MS } = {},
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(GRAPH_VIEWER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const headerRequestId = response.headers?.get?.('X-Request-ID') || '';
    let payload = null;
    try {
      payload = await response.json();
    } catch (parseError) {
      if (response.ok) {
        throw new GraphViewerRequestError('Graph viewer returned invalid JSON.', {
          code: 'INVALID_RESPONSE',
          status: response.status,
          requestId: headerRequestId,
        });
      }
    }

    if (!response.ok) {
      const details = payload?.error;
      const structured = details && typeof details === 'object';
      const requestId = (structured && details.request_id) || headerRequestId;
      throw new GraphViewerRequestError(
        (structured && details.message)
          || (typeof details === 'string' && details)
          || `Graph viewer API failed with HTTP ${response.status}.`,
        {
          code: (structured && details.code) || `HTTP_${response.status}`,
          status: response.status,
          requestId,
          retryable: Boolean(structured && details.retryable),
          phase: (structured && details.phase) || '',
        },
      );
    }

    const graphData = payload?.combined_query_result || payload?.graph;
    if (!graphData?.nodes || !graphData?.edges) {
      throw new GraphViewerRequestError('Response did not contain graph nodes/edges.', {
        code: 'INVALID_RESPONSE',
        status: response.status,
        requestId: headerRequestId,
      });
    }

    return {
      graphData,
      coordData: payload.xy_json || payload.coords || null,
      metadata: payload.metadata || null,
      request,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new GraphViewerRequestError(
        `Graph viewer request timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`,
        { code: 'CLIENT_TIMEOUT', retryable: true, phase: 'client_wait' },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export default function GraphViewerQueryDialog({ open, onClose, onResult }) {
  const [inputs, setInputs] = useState([DEFAULT_QUERY]);
  const [coreNodes, setCoreNodes] = useState('ENSG00000001626');
  const [maxNodes, setMaxNodes] = useState('15');
  const [layoutMode, setLayoutMode] = useState('genome_mode');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRequest, setLastRequest] = useState(null);

  const updateInput = (index, value) => {
    setInputs((current) => current.map((entry, entryIndex) => entryIndex === index ? value : entry));
  };

  const autoFormat = () => setInputs((current) => current.map(normalizeInput));

  const autoParse = () => {
    try {
      const expanded = inputs.flatMap((input) => {
        const parsed = parseJson(input);
        if (Array.isArray(parsed)) {
          return parsed.map(stringifyEntry);
        }
        if (parsed && Array.isArray(parsed.cypher)) {
          if (Array.isArray(parsed.core_nodes)) {
            setCoreNodes(parsed.core_nodes.join(', '));
          }
          if (parsed.max_nodes !== undefined) {
            setMaxNodes(String(parsed.max_nodes));
          }
          if (parsed.layout_mode) {
            setLayoutMode(parsed.layout_mode);
          }
          return parsed.cypher.map(stringifyEntry);
        }
        return [input];
      });

      if (expanded.length === inputs.length && expanded.every((entry, index) => entry === inputs[index])) {
        throw new Error('No Cypher/request list found to auto parse.');
      }
      setInputs(expanded.length ? expanded : ['']);
      setError(null);
    } catch (parseError) {
      setError(parseError);
    }
  };

  const runRequest = async (request) => {
    setLoading(true);
    setError(null);
    setLastRequest(request);

    try {
      onResult(await requestGraphViewer(request));
      onClose();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setError(null);

    try {
      const cypher = parseGraphViewerInputs(inputs);
      const parsedMaxNodes = Number.parseInt(maxNodes, 10);
      if (!cypher.length || !Number.isFinite(parsedMaxNodes) || parsedMaxNodes <= 0) {
        throw new Error('Provide a query and a positive max nodes value.');
      }

      const request = {
        cypher,
        core_nodes: coreNodes.split(/[\s,]+/).filter(Boolean),
        max_nodes: parsedMaxNodes,
        layout_mode: layoutMode,
      };
      await runRequest(request);
    } catch (submitError) {
      setError(submitError);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700, color: '#204361' }}>Graph viewer query</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {inputs.map((input, index) => (
            <Box key={`query-input-${index}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <TextField fullWidth multiline minRows={4} label={`Cypher / request ${index + 1}`} value={input} onChange={(event) => updateInput(index, event.target.value)} />
              <IconButton color="error" disabled={inputs.length === 1} onClick={() => setInputs((current) => current.filter((_, inputIndex) => inputIndex !== index))}>
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          ))}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setInputs((current) => [...current, ''])}>Add input</Button>
            <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={autoFormat}>Auto format</Button>
            <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={autoParse}>Auto parse</Button>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField label="Core nodes" value={coreNodes} onChange={(event) => setCoreNodes(event.target.value)} sx={{ minWidth: { md: 300 } }} />
            <TextField label="Max nodes" value={maxNodes} onChange={(event) => setMaxNodes(event.target.value)} sx={{ width: { xs: '100%', md: 130 } }} />
            <ToggleButtonGroup value={layoutMode} exclusive onChange={(event, nextMode) => nextMode && setLayoutMode(nextMode)} color="primary">
              <ToggleButton value="kg_only">KG only</ToggleButton>
              <ToggleButton value="genome_mode">Genome browser</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {error && (
            <Alert
              severity="error"
              action={error.retryable && lastRequest ? (
                <Button color="inherit" size="small" onClick={() => runRequest(lastRequest)} disabled={loading}>
                  Retry
                </Button>
              ) : null}
            >
              {formatGraphViewerError(error)}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ padding: '12px 24px' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={loading}>{loading ? 'Running...' : 'Run graph viewer'}</Button>
      </DialogActions>
    </Dialog>
  );
}
