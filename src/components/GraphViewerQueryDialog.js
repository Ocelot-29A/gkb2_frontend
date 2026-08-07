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

export const GRAPH_VIEWER_API_URL = 'https://jieliulab3.dcmb.med.umich.edu/gkb0708/api/graph';
const DEFAULT_QUERY = 'MATCH (n {id: "ENSG00000001626"})-[r]-(m) WITH n, r, m LIMIT 10 RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes, collect(DISTINCT r) AS edges';

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

export const requestGraphViewer = async (request) => {
  const response = await fetch(GRAPH_VIEWER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Graph viewer API failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  const graphData = payload?.combined_query_result || payload?.graph;
  if (!graphData?.nodes || !graphData?.edges) {
    throw new Error('Response did not contain graph nodes/edges.');
  }

  return {
    graphData,
    coordData: payload.xy_json || payload.coords || null,
    edgeRoutes: payload.edge_routes || null,
    metadata: payload.metadata || null,
    request,
  };
};

export default function GraphViewerQueryDialog({ open, onClose, onResult }) {
  const [inputs, setInputs] = useState([DEFAULT_QUERY]);
  const [coreNodes, setCoreNodes] = useState('ENSG00000001626');
  const [maxNodes, setMaxNodes] = useState('15');
  const [layoutMode, setLayoutMode] = useState('genome_mode');
  const [layoutEngine, setLayoutEngine] = useState('legacy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          if (parsed.layout_engine) {
            setLayoutEngine(parsed.layout_engine);
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
        layout_engine: layoutEngine,
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
            <ToggleButtonGroup value={layoutEngine} exclusive onChange={(event, nextEngine) => nextEngine && setLayoutEngine(nextEngine)} color="secondary">
              <ToggleButton value="legacy">Legacy layout</ToggleButton>
              <ToggleButton value="optimized_v1">Optimized v1</ToggleButton>
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
