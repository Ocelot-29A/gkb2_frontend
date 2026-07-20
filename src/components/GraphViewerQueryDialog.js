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
  Typography,
} from '@mui/material';

export const GRAPH_VIEWER_API_URL = 'https://jieliulab3.dcmb.med.umich.edu/gkb0708/api/graph';
const GRAPH_VIEWER_TIMEOUT_MS = 30000;
const GENOME_SAMPLE_QUERY = 'MATCH (n:Coding_element:Gene {id: "ENSG00000001626"})-[r]-(m) WITH n, r, m LIMIT 10 RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes, collect(DISTINCT r) AS edges';
const KG_SAMPLE_QUERY = 'MATCH (n:Coding_element:Gene {id: "ENSG00000001626"})-[r]-(m) WITH n, r, m LIMIT 6 RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes, collect(DISTINCT r) AS edges';

const BUILTIN_QUERY_EXAMPLES = [
  {
    label: 'Genome neighbors',
    request: {
      cypher: [GENOME_SAMPLE_QUERY],
      core_nodes: ['ENSG00000001626'],
      max_nodes: 15,
      layout_mode: 'genome_mode',
    },
  },
  {
    label: 'KG neighbors',
    request: {
      cypher: [KG_SAMPLE_QUERY],
      core_nodes: ['ENSG00000001626'],
      max_nodes: 15,
      layout_mode: 'kg_only',
    },
  },
  {
    label: 'Mixed source query',
    request: {
      cypher: [
        KG_SAMPLE_QUERY,
        {
          source: 'pgsql',
          api: 'chr/features/by-node',
          searched_id: 'ENSG00000001626',
          relative_position: 'downstream',
          feature_types: ['Gene'],
          limit: 1,
        },
      ],
      core_nodes: ['ENSG00000001626'],
      max_nodes: 15,
      layout_mode: 'kg_only',
    },
  },
];

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

export const requestGraphViewer = async (request, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || GRAPH_VIEWER_TIMEOUT_MS);
  let externallyCancelled = false;
  const handleExternalAbort = () => {
    externallyCancelled = true;
    controller.abort();
  };

  options.signal?.addEventListener('abort', handleExternalAbort, { once: true });

  try {
    const response = await fetch(GRAPH_VIEWER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      throw new Error(`Graph viewer API returned invalid JSON (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.error || `Graph viewer API failed with HTTP ${response.status}.`);
    }
    if (payload?.error) {
      throw new Error(payload.error.message || payload.error);
    }

    const graphData = payload?.combined_query_result || payload?.graph;
    if (!graphData?.nodes || !graphData?.edges) {
      throw new Error('Response did not contain graph nodes/edges.');
    }

    return {
      graphData,
      coordData: payload.xy_json || payload.coords || null,
      metadata: payload.metadata || null,
      request,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(externallyCancelled ? 'Graph viewer request was cancelled.' : 'Graph viewer request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', handleExternalAbort);
  }
};

export default function GraphViewerQueryDialog({ open, onClose, onResult, examples = [] }) {
  const [inputs, setInputs] = useState(['']);
  const [coreNodes, setCoreNodes] = useState('');
  const [maxNodes, setMaxNodes] = useState('15');
  const [layoutMode, setLayoutMode] = useState('kg_only');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const availableExamples = [...BUILTIN_QUERY_EXAMPLES, ...examples];

  const applyExample = (example) => {
    const request = example?.request || example;
    const nextCypher = Array.isArray(request?.cypher) ? request.cypher.map(stringifyEntry) : [];
    setInputs(nextCypher.length ? nextCypher : ['']);
    setCoreNodes(Array.isArray(request?.core_nodes) ? request.core_nodes.join(', ') : '');
    setMaxNodes(request?.max_nodes === undefined ? '15' : String(request.max_nodes));
    setLayoutMode(request?.layout_mode || 'kg_only');
    setError('');
  };

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
      setError('');
    } catch (parseError) {
      setError(parseError.message || 'Auto parse failed.');
    }
  };

  const submit = async () => {
    setLoading(true);
    setError('');

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
      onResult(await requestGraphViewer(request));
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'Graph viewer request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700, color: '#204361' }}>Graph viewer query</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>
              Examples
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {availableExamples.map((example, index) => (
                <Button
                  key={`${example.label || 'example'}-${index}`}
                  variant="outlined"
                  size="small"
                  onClick={() => applyExample(example)}
                  sx={{ textTransform: 'none' }}
                >
                  {example.label || `Example ${index + 1}`}
                </Button>
              ))}
            </Stack>
          </Box>
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
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ padding: '12px 24px' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={loading}>{loading ? 'Running...' : 'Run graph viewer'}</Button>
      </DialogActions>
    </Dialog>
  );
}
