import React, { useMemo, useState } from 'react';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import StandaloneKnowledgeGraph from './StandaloneKnowledgeGraph';

const GRAPH_VIEWER_API_URL = 'https://jieliulab3.dcmb.med.umich.edu/gkb0708/api/graph';

const GENOME_SAMPLE_QUERY = 'MATCH (n {id: "ENSG00000001626"})-[r]-(m) WITH n, r, m LIMIT 10 RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes, collect(DISTINCT r) AS edges';
const KG_SAMPLE_QUERY = 'MATCH (n {id: "ENSG00000001626"})-[r]-(m) WITH n, r, m LIMIT 6 RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes, collect(DISTINCT r) AS edges';

const normalizeCypherInput = (input) => String(input || '')
  .trim()
  .replace(/\r\n/g, '\n')
  .replace(/\\\\"/g, '"')
  .replace(/\\"/g, '"')
  .replace(/,+\s*$/g, '')
  .replace(/^"+|"+$/g, '')
  .replace(/\s+WHERE/g, '\nWHERE')
  .replace(/\s+RETURN/g, '\nRETURN')
  .replace(/\s+MATCH/g, '\nMATCH')
  .replace(/\s+WITH/g, '\nWITH')
  .replace(/\[\s*([^]*?)\s*\]/g, (match, content) => `[${content.replace(/\n/g, ' ')}]`);

const parseCypherEntry = (input, index) => {
  const normalized = normalizeCypherInput(input);
  if (!normalized) {
    return null;
  }

  if (
    (normalized.startsWith('{') && normalized.endsWith('}')) ||
    (normalized.startsWith('[') && normalized.endsWith(']'))
  ) {
    try {
      return JSON.parse(normalized);
    } catch (error) {
      throw new Error(`Cypher input ${index + 1} looks like JSON but could not be parsed.`);
    }
  }

  return normalized.replace(/\s+/g, ' ').trim();
};

const getGraphPayload = (payload) => ({
  graphData: payload?.combined_query_result || payload?.graph || null,
  coordData: payload?.xy_json || payload?.coords || null,
  metadata: payload?.metadata || null,
});

const QueryInputList = ({ inputs, onChange, onFormat }) => {
  const updateInput = (index, value) => {
    const nextInputs = [...inputs];
    nextInputs[index] = value;
    onChange(nextInputs);
  };

  const addInput = () => {
    onChange([...inputs, '']);
  };

  const removeInput = (index) => {
    const nextInputs = inputs.filter((_, inputIndex) => inputIndex !== index);
    onChange(nextInputs.length ? nextInputs : ['']);
  };

  return (
    <Stack spacing={2}>
      {inputs.map((value, index) => (
        <Box
          key={`cypher-input-${index}`}
          sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}
        >
          <TextField
            fullWidth
            multiline
            minRows={4}
            label={`Cypher / request ${index + 1}`}
            value={value}
            onChange={(event) => updateInput(index, event.target.value)}
            placeholder='MATCH (n {id: "ENSG00000001626"})-[r]-(m) RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes, collect(DISTINCT r) AS edges'
          />
          <IconButton
            color='error'
            onClick={() => removeInput(index)}
            disabled={inputs.length === 1}
            sx={{ marginTop: '6px' }}
          >
            <DeleteOutlineIcon />
          </IconButton>
        </Box>
      ))}
      <Stack direction='row' spacing={1.5}>
        <Button startIcon={<AddIcon />} variant='outlined' onClick={addInput}>
          Add input
        </Button>
        <Button startIcon={<AutoAwesomeIcon />} variant='outlined' onClick={onFormat}>
          Auto format
        </Button>
      </Stack>
    </Stack>
  );
};

export default function GraphViewerDebugPanel() {
  const [cypherInputs, setCypherInputs] = useState([GENOME_SAMPLE_QUERY]);
  const [coreNodes, setCoreNodes] = useState('ENSG00000001626');
  const [maxNodes, setMaxNodes] = useState('15');
  const [layoutMode, setLayoutMode] = useState('genome_mode');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [responsePayload, setResponsePayload] = useState(null);

  const graphPayload = useMemo(() => getGraphPayload(responsePayload), [responsePayload]);
  const graphNodeCount = graphPayload.graphData?.nodes?.length || 0;
  const graphEdgeCount = graphPayload.graphData?.edges?.length || 0;

  const handleFormatInputs = () => {
    setCypherInputs((currentInputs) => currentInputs.map((input) => normalizeCypherInput(input)));
  };

  const applySample = (mode) => {
    setLayoutMode(mode);
    setCoreNodes('ENSG00000001626');
    setMaxNodes('15');
    setCypherInputs([mode === 'genome_mode' ? GENOME_SAMPLE_QUERY : KG_SAMPLE_QUERY]);
    setError('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const cypher = cypherInputs
        .map((input, index) => parseCypherEntry(input, index))
        .filter(Boolean);

      if (!cypher.length) {
        throw new Error('Provide at least one Cypher query or request object.');
      }

      const parsedMaxNodes = Number.parseInt(maxNodes, 10);
      if (!Number.isFinite(parsedMaxNodes) || parsedMaxNodes <= 0) {
        throw new Error('Max nodes must be a positive integer.');
      }

      const parsedCoreNodes = coreNodes
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean);

      const requestBody = {
        cypher,
        core_nodes: parsedCoreNodes,
        max_nodes: parsedMaxNodes,
        layout_mode: layoutMode,
      };

      const response = await fetch(GRAPH_VIEWER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Graph viewer API failed with HTTP ${response.status}.`);
      }

      const payload = await response.json();
      const nextGraphPayload = getGraphPayload(payload);
      if (!nextGraphPayload.graphData?.nodes || !nextGraphPayload.graphData?.edges) {
        throw new Error('Response did not contain graph nodes/edges.');
      }

      setResponsePayload(payload);
    } catch (submitError) {
      setError(submitError.message || 'Graph viewer request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        marginBottom: 4,
        padding: { xs: 2, md: 3 },
        backgroundColor: '#F8FBFF',
        border: '1px solid #E1ECF7',
        borderRadius: '20px',
      }}
    >
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent='space-between'>
          <Box>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#204361' }}>
              Graph Viewer Debug
            </Typography>
            <Typography sx={{ marginTop: 0.75, color: '#557086', maxWidth: '920px' }}>
              Send one or more Cypher inputs to the graph layout API and render either regular KG mode or genome browser mode with the existing standalone graph viewer.
            </Typography>
          </Box>
          <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
            <Button variant='outlined' onClick={() => applySample('genome_mode')}>
              Load genome sample
            </Button>
            <Button variant='outlined' onClick={() => applySample('kg_only')}>
              Load KG sample
            </Button>
          </Stack>
        </Stack>

        <QueryInputList
          inputs={cypherInputs}
          onChange={setCypherInputs}
          onFormat={handleFormatInputs}
        />

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField
            label='Core nodes'
            value={coreNodes}
            onChange={(event) => setCoreNodes(event.target.value)}
            helperText='Comma or whitespace separated node IDs'
            sx={{ minWidth: { md: 320 } }}
          />
          <TextField
            label='Max nodes'
            value={maxNodes}
            onChange={(event) => setMaxNodes(event.target.value)}
            sx={{ width: { xs: '100%', md: 140 } }}
          />
          <ToggleButtonGroup
            value={layoutMode}
            exclusive
            onChange={(event, nextMode) => {
              if (nextMode) {
                setLayoutMode(nextMode);
              }
            }}
            color='primary'
          >
            <ToggleButton value='kg_only'>KG only</ToggleButton>
            <ToggleButton value='genome_mode'>Genome browser</ToggleButton>
          </ToggleButtonGroup>
          <Button variant='contained' onClick={handleSubmit} disabled={loading} sx={{ minWidth: 160 }}>
            {loading ? 'Running...' : 'Run graph viewer'}
          </Button>
        </Stack>

        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
          {responsePayload && <Chip label={`Nodes ${graphNodeCount}`} color='primary' variant='outlined' />}
          {responsePayload && <Chip label={`Edges ${graphEdgeCount}`} color='primary' variant='outlined' />}
          {responsePayload?.metadata?.layout?.mode && (
            <Chip label={`Response mode: ${responsePayload.metadata.layout.mode}`} color='secondary' variant='outlined' />
          )}
        </Stack>

        {error && <Alert severity='error'>{error}</Alert>}
        {!error && responsePayload && graphNodeCount === 0 && (
          <Alert severity='warning'>The request succeeded but returned no nodes.</Alert>
        )}

        {responsePayload && graphNodeCount > 0 && (
          <Box>
            <Divider sx={{ marginBottom: 2.5 }} />
            <StandaloneKnowledgeGraph
              graphData={graphPayload.graphData}
              coordData={graphPayload.coordData}
              metadata={graphPayload.metadata}
              containerHeight='720px'
              defaultLegendVisible={true}
            />
          </Box>
        )}

        <Box>
          <Typography sx={{ marginBottom: 1, fontSize: 15, fontWeight: 700, color: '#37566F' }}>
            Raw response
          </Typography>
          <Box
            component='pre'
            sx={{
              margin: 0,
              padding: 2,
              maxHeight: 320,
              overflow: 'auto',
              backgroundColor: '#102132',
              color: '#DCEBFA',
              borderRadius: '12px',
              fontSize: 12,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {responsePayload ? JSON.stringify(responsePayload, null, 2) : 'Run a request to inspect the raw API response.'}
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}