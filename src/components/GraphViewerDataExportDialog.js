import React, { useEffect, useMemo, useState } from 'react';

import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';

import { formatInfocardValue } from './graphViewerInfocardValue';

export const GRAPH_DATA_DIALOG_PAPER_SX = {
  width: '92vw',
  minWidth: 'min(1100px, 92vw)',
  height: '86vh',
  maxWidth: 'none',
  borderRadius: '16px',
  overflow: 'hidden',
};

const EMPTY_DELETED_IDS = new Set();
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const propertyValue = (record, keys) => {
  const properties = record?.['~properties'] || {};
  for (const key of keys) {
    const value = properties[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

const readableValue = (value) => formatInfocardValue(value, { emptyValue: '—' });

const nodeName = (node) => propertyValue(node, [
  'name',
  'display_name',
  'source_name',
  'process_name',
  'symbol',
  'id',
]) || node?.['~id'] || 'Unnamed node';

export const buildVisibleGraphExport = (result, deletedIds = EMPTY_DELETED_IDS) => {
  if (!result) return null;
  const deleted = deletedIds instanceof Set ? deletedIds : new Set(deletedIds || []);
  return {
    ...result,
    nodes: (result.nodes || []).filter((node) => !deleted.has(node['~id'])),
    edges: (result.edges || []).filter((edge) => (
      !deleted.has(edge['~id'])
      && !deleted.has(edge['~start'])
      && !deleted.has(edge['~end'])
    )),
  };
};

export const buildGraphPreviewRows = (graphData) => {
  const nodes = graphData?.nodes || [];
  const nodeNames = new Map(nodes.map((node) => [node['~id'], readableValue(nodeName(node))]));
  return {
    nodes: nodes.map((node) => ({
      key: node['~id'],
      name: readableValue(nodeName(node)),
      type: readableValue(node['~labels'] || propertyValue(node, ['label', 'type'])),
      id: readableValue(propertyValue(node, ['id', 'canonical_id', 'source_record_id']) || node['~id']),
      description: readableValue(propertyValue(node, ['description', 'function', 'Function', 'gene_set_summary'])),
      source: readableValue(propertyValue(node, ['data_source', 'annotation_source', 'source'])),
    })),
    edges: (graphData?.edges || []).map((edge, index) => ({
      key: edge['~id'] || `edge-${index}`,
      source: nodeNames.get(edge['~start']) || readableValue(propertyValue(edge, ['source_name']) || edge['~start']),
      relationship: readableValue(propertyValue(edge, ['relation_label', 'relationship_name']) || edge['~type']),
      target: nodeNames.get(edge['~end']) || readableValue(propertyValue(edge, ['target_name']) || edge['~end']),
      evidence: readableValue(propertyValue(edge, ['evidence_strength', 'evidence_level', 'evidence_code'])),
      dataSource: readableValue(propertyValue(edge, ['data_source', 'annotation_source', 'source'])),
    })),
  };
};

const tableCellSx = {
  verticalAlign: 'top',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  fontFamily: 'Inter, sans-serif',
  fontSize: '12px',
  lineHeight: 1.45,
  color: '#344054',
};

const headerCellSx = {
  ...tableCellSx,
  backgroundColor: '#F7F4EE',
  color: '#344054',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const PreviewTable = ({ columns, rows, label, page, rowsPerPage }) => (
  <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
    <Table stickyHeader size="small" aria-label={label} sx={{ tableLayout: 'fixed', minWidth: '980px' }}>
      <TableHead>
        <TableRow>
          {columns.map((column) => (
            <TableCell key={column.key} sx={{ ...headerCellSx, width: column.width }}>{column.label}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (
          <TableRow hover key={row.key}>
            {columns.map((column) => (
              <TableCell key={column.key} sx={tableCellSx}>{row[column.key]}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const NODE_COLUMNS = [
  { key: 'name', label: 'Name', width: '19%' },
  { key: 'type', label: 'Type', width: '14%' },
  { key: 'id', label: 'ID', width: '19%' },
  { key: 'description', label: 'Description', width: '32%' },
  { key: 'source', label: 'Data source', width: '16%' },
];

const EDGE_COLUMNS = [
  { key: 'source', label: 'From', width: '21%' },
  { key: 'relationship', label: 'Relationship', width: '18%' },
  { key: 'target', label: 'To', width: '21%' },
  { key: 'evidence', label: 'Evidence', width: '22%' },
  { key: 'dataSource', label: 'Data source', width: '18%' },
];

export default function GraphViewerDataExportDialog({
  open,
  graphData,
  onClose,
  onDownload,
  downloadDisabled = false,
  downloadLimit,
}) {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const rows = useMemo(() => buildGraphPreviewRows(graphData), [graphData]);
  const nodeCount = graphData?.nodes?.length || 0;
  const edgeCount = graphData?.edges?.length || 0;

  useEffect(() => {
    if (open) {
      setTab(0);
      setPage(0);
    }
  }, [open]);

  const changeTab = (_event, nextTab) => {
    setTab(nextTab);
    setPage(0);
  };
  const visibleRows = tab === 0 ? rows.nodes : rows.edges;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      aria-labelledby="graph-data-preview-title"
      aria-describedby="graph-data-preview-summary"
      PaperProps={{ sx: GRAPH_DATA_DIALOG_PAPER_SX }}
    >
      <DialogTitle id="graph-data-preview-title" sx={{ padding: '20px 24px 0', fontFamily: 'Inter, sans-serif', fontSize: '21px', fontWeight: 700, color: '#243F3A' }}>
        Graph content
      </DialogTitle>
      <Typography id="graph-data-preview-summary" component="div" sx={{ padding: '4px 24px 12px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#66756F' }}>
        {nodeCount} nodes · {edgeCount} directed relationships · preview the complete readable content before downloading
      </Typography>
      <Tabs
        value={tab}
        onChange={changeTab}
        aria-label="Graph content sections"
        sx={{ paddingX: '20px', minHeight: '44px', borderBottom: '1px solid #E5E7EB' }}
      >
        <Tab id="graph-nodes-tab" aria-controls="graph-nodes-panel" label={`Nodes (${nodeCount})`} />
        <Tab id="graph-edges-tab" aria-controls="graph-edges-panel" label={`Relationships (${edgeCount})`} />
        <Tab id="graph-json-tab" aria-controls="graph-json-panel" label="Raw JSON" />
      </Tabs>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px 24px 8px', overflow: 'hidden' }}>
        {tab < 2 ? (
          <Box
            id={tab === 0 ? 'graph-nodes-panel' : 'graph-edges-panel'}
            role="tabpanel"
            aria-labelledby={tab === 0 ? 'graph-nodes-tab' : 'graph-edges-tab'}
            sx={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', border: '1px solid #DDD8CF', borderRadius: '10px', overflow: 'hidden' }}
          >
            <PreviewTable
              columns={tab === 0 ? NODE_COLUMNS : EDGE_COLUMNS}
              rows={visibleRows}
              label={tab === 0 ? 'Graph nodes' : 'Graph relationships'}
              page={page}
              rowsPerPage={rowsPerPage}
            />
            <TablePagination
              component="div"
              count={visibleRows.length}
              page={page}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={PAGE_SIZE_OPTIONS}
              onPageChange={(_event, nextPage) => setPage(nextPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setPage(0);
              }}
            />
          </Box>
        ) : (
          <Box
            id="graph-json-panel"
            role="tabpanel"
            aria-labelledby="graph-json-tab"
            component="pre"
            sx={{ flex: 1, minHeight: 0, margin: 0, padding: '18px', overflow: 'auto', border: '1px solid #DDD8CF', borderRadius: '10px', backgroundColor: '#FBFAF7', color: '#344054', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {JSON.stringify(graphData || {}, null, 2)}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ padding: '10px 24px 20px', gap: '10px', borderTop: '1px solid #EEE9E1' }}>
        {downloadDisabled && (
          <Alert severity="info" sx={{ flex: 1, paddingY: 0 }}>
            Preview is available, but JSON download is limited to {downloadLimit} visible nodes in this graph mode.
          </Alert>
        )}
        {!downloadDisabled && <Box sx={{ flex: 1 }} />}
        <Button onClick={onClose} sx={{ textTransform: 'none', color: '#5F6F69' }}>Close</Button>
        <Button
          variant="contained"
          startIcon={<FileDownloadIcon />}
          disabled={downloadDisabled}
          onClick={() => onDownload?.(graphData)}
          sx={{ minWidth: '160px', textTransform: 'none', backgroundColor: '#24493F', '&:hover': { backgroundColor: '#19362F' } }}
        >
          Download JSON
        </Button>
      </DialogActions>
    </Dialog>
  );
}
