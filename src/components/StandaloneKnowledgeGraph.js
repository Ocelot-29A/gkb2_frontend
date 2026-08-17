"use client";

import './styles.css';

import React, {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import cytoscape from 'cytoscape';
import { useSelector } from 'react-redux';

import AdsClickIcon from '@mui/icons-material/AdsClick';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DataObjectIcon from '@mui/icons-material/DataObject';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import GridViewIcon from '@mui/icons-material/GridView';
import HubIcon from '@mui/icons-material/Hub';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LinkIcon from '@mui/icons-material/Link';
import RedoIcon from '@mui/icons-material/Redo';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';
import UndoIcon from '@mui/icons-material/Undo';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';

import graphInfocard from '../schema/graph_viewer_schema.json';
import { addWhitespace } from '../utils/textProcessing';
import GraphViewerQueryDialog, { requestGraphViewer } from './GraphViewerQueryDialog';
import GraphViewerDataExportDialog, { buildVisibleGraphExport } from './GraphViewerDataExportDialog';
import GraphViewerSearchDialog from './GraphViewerSearchDialog';
import { inverseLayoutPosition, navigationLabel } from './graphViewerDeveloperMode';
import { formatInfocardValue, getInfocardHref } from './graphViewerInfocardValue';
import GraphInfocard from './GraphInfocard';
import {
  edgeIsInverted,
  edgeLabels,
  legendSchema,
  nodeColors,
  nodeStyle,
} from './style.js';

const CY_LAYOUT_SCALE = 0.5;
const INFOCARD_Z_INDEX = 2147483000;
const CY_Y_POSITION_MULTIPLIER = 2;
const GraphViewerDeveloperDialog = lazy(() => import('./GraphViewerDeveloperDialog'));

const scaleX = (value) => value * CY_LAYOUT_SCALE;
const scaleYPosition = (value) => value * CY_LAYOUT_SCALE * CY_Y_POSITION_MULTIPLIER;
const scaleHeight = (value) => value * CY_LAYOUT_SCALE;

const LegendItem = ({ label, color }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '4px 0' }}>
    <Box
      sx={{
        flex: '0 0 auto',
        width: '16px',
        height: '16px',
        borderRadius: '6px',
        backgroundColor: color || '#D9E1E6',
      }}
    />
    <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 400, lineHeight: '20px', color: '#374151' }}>
      {label}
    </Typography>
  </Box>
);

const toolbarButtonSx = {
  height: '36px',
  minHeight: '36px',
  padding: '0 8px',
  border: '1px solid #E0E4EB',
  borderRadius: '10px',
  backgroundColor: '#FFFFFF',
  color: '#1C3C68',
  boxShadow: 'none',
  fontFamily: 'Inter, sans-serif',
  fontSize: '12px',
  fontWeight: 400,
  lineHeight: '16px',
  textTransform: 'none',
  whiteSpace: 'nowrap',
  '& .MuiButton-startIcon': { marginRight: '4px' },
  '& .MuiButton-endIcon': { marginLeft: '4px' },
  '&:hover': {
    borderColor: '#B9C6D6',
    backgroundColor: '#F8FAFC',
  },
  '&.Mui-disabled': {
    borderColor: '#E0E4EB',
    color: '#B7C4D6',
  },
};

const metaLabelSx = { fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500, color: '#94A3B8', marginBottom: '6px' };
const metaValueSx = { fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500, color: '#0F172A' };

const MAX_VISIBLE_NODES = 30;
const NEIGHBOR_QUERY_LIMIT = 10;
const HIGHLIGHT_DURATION_MS = 2200;
const EMPTY_DELETED_ID_LIST = Object.freeze([]);
const EMPTY_GRAPH_REGIONS = Object.freeze([]);
const EMPTY_VIEWER_COLORS = Object.freeze({});
const DEFAULT_VIEWER_PALETTE = Object.freeze({
  canvas: '#F5F8FB',
  surface: '#FFFFFF',
  softSurface: '#F8FAFC',
  border: '#E0E4EB',
  ink: '#0F172A',
  mutedInk: '#94A3B8',
  control: '#1C3C68',
  controlHover: '#16304F',
  overview: '#F0F7FF',
  overviewBorder: '#E0EAF5',
  shadow: 'rgba(15, 23, 42, 0.08)',
});

export const isOverflowId = (id) => String(id ?? '').startsWith('overflow:');

const openLinkedGraph = (node) => {
  const graphLink = node?.data?.('graph_link');
  if (typeof graphLink !== 'string' || !graphLink.startsWith('/')) {
    return false;
  }
  window.location.assign(graphLink);
  return true;
};

const PREVIEW_ASSET_PATTERN = /^pathway-cache\/[0-9a-f]{64}\.(?:svg|png)$/;

const previewReferenceFor = (data) => {
  const value = data?.preview_image_path;
  const reference = typeof value === 'string' ? value.trim() : '';
  return PREVIEW_ASSET_PATTERN.test(reference) ? reference : '';
};

export const resolvePreviewAssetUrl = (value, assetBaseUrl = '') => {
  const reference = typeof value === 'string' ? value.trim() : '';
  if (!PREVIEW_ASSET_PATTERN.test(reference)) {
    return '';
  }
  const base = typeof assetBaseUrl === 'string' ? assetBaseUrl.trim().replace(/\/+$/, '') : '';
  return base ? `${base}/${reference}` : reference;
};

const PREVIEW_NODE_TYPES = new Set(['Process', 'Pathway']);
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const safePreviewColor = (value, fallback) => (
  typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim())
    ? value.trim()
    : fallback
);

const clampOpacity = (value, fallback) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.min(1, Math.max(0, numericValue))
    : fallback;
};

export const getNodeTextBackplateData = (layout = null) => ({
  nodeTextBackgroundColor: safePreviewColor(
    layout?.node_text_background_color,
    '#FFFFFF',
  ),
  nodeTextBackgroundOpacity: clampOpacity(
    layout?.node_text_background_opacity,
    0.94,
  ),
});

export const getEdgeTextBackplateData = (layout = null) => ({
  edgeTextBackgroundColor: safePreviewColor(
    layout?.edge_text_background_color,
    '#F9FAFB',
  ),
  edgeTextBackgroundOpacity: clampOpacity(
    layout?.edge_text_background_opacity,
    1,
  ),
});

export const getImageNodeBackgroundData = (properties = null, layout = null) => ({
  imageNodeBackgroundColor: safePreviewColor(
    properties?.image_background_color,
    safePreviewColor(layout?.image_background_color, '#FFFFFF'),
  ),
});

export const getImageNodeOpacityData = (properties = null) => ({
  imageNodeImageOpacity: clampOpacity(properties?.image_opacity, 1),
});

export const getRasterImageOpacityStyle = (imageOpacity) => ({
  'background-image-opacity': imageOpacity,
  'background-opacity': 1,
});

export const getNodeBodyPreviewData = (
  nodeType,
  properties,
  assetBaseUrl = '',
  config = null,
) => {
  if (config?.enabled !== true || !PREVIEW_NODE_TYPES.has(nodeType)) {
    return {};
  }
  const previewNodeImageUrl = resolvePreviewAssetUrl(
    properties?.preview_image_path,
    assetBaseUrl,
  );
  if (!previewNodeImageUrl) {
    return {};
  }
  const borderWidth = Number(config?.border_width);
  return {
    previewNodeImageUrl,
    previewNodeImageFit: config?.fit === 'cover' ? 'cover' : 'contain',
    previewNodeImageBackground: safePreviewColor(config?.background_color, '#FFF9F0'),
    previewNodeImageBorderColor: safePreviewColor(config?.border_color, '#A96B64'),
    previewNodeImageBorderWidth: Number.isFinite(borderWidth)
      ? Math.min(10, Math.max(0, borderWidth))
      : 3,
  };
};

export const getNodePrimaryAction = (data) => {
  if (previewReferenceFor(data)) {
    return 'preview';
  }
  const graphLink = data?.graph_link;
  if (typeof graphLink === 'string' && graphLink.startsWith('/')) {
    return 'navigate';
  }
  return 'menu';
};

export const isExactLinkedViewPreview = (data) => (
  data?.preview_representation === 'exact_linked_view'
);

const EDGE_LINE_STYLES = new Set(['solid', 'dashed', 'dotted']);

export const normalizeEdgeLineStyle = (value) => (
  EDGE_LINE_STYLES.has(value) ? value : 'solid'
);

const isGraphBackgroundNode = (node) => (
  node.data('trackBackground') === 'true'
  || node.data('cellBackground') === 'true'
  || node.data('mechanismBackground') === 'true'
  || node.data('mechanismTitle') === 'true'
  || node.data('canvasImage') === 'true'
);

export const createExactGraphCapture = (
  cy,
  {
    background = '#FFFFFF',
    maxWidth = 1600,
    maxHeight = 900,
  } = {},
) => {
  if (!cy || cy.destroyed?.()) {
    throw new Error('The graph renderer is not available for capture.');
  }
  const biologicalNodes = cy.nodes().filter((node) => !isGraphBackgroundNode(node));
  const nodeIds = biologicalNodes.map((node) => node.id()).sort();
  const edgeIds = cy.edges().map((edge) => edge.id()).sort();
  const positions = Object.fromEntries(
    biologicalNodes
      .map((node) => [node.id(), { x: node.position('x'), y: node.position('y') }])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return {
    status: 'candidate',
    representation: 'exact_linked_view',
    png_data_url: cy.png({
      full: true,
      maxWidth,
      maxHeight,
      bg: background,
    }),
    node_ids: nodeIds,
    edge_ids: edgeIds,
    positions,
    node_count: nodeIds.length,
    edge_count: edgeIds.length,
    render_contract: {
      exporter: 'cytoscape.png',
      full: true,
      max_width: maxWidth,
      max_height: maxHeight,
      background,
    },
  };
};

const contextMenuItemSx = {
  justifyContent: 'flex-start',
  textTransform: 'none',
  fontFamily: 'Inter, sans-serif',
  fontSize: '12px',
  color: '#1C3C68',
  padding: '8px 10px',
  '&.Mui-disabled': {
    color: '#B7C4D6',
  },
};

const escapeCypherString = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const buildExploreNeighborsCypher = (nodeId, limit = NEIGHBOR_QUERY_LIMIT) => ({
  source: 'neo4j',
  query: [
    `WITH "${escapeCypherString(nodeId)}" AS node_id`,
    'MATCH (n {id: node_id})-[r]-(m)',
    'WITH n, r, m',
    `LIMIT ${limit}`,
    'RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes,',
    '       collect(r) AS edges',
  ].join('\n'),
});

const getExploreQueryInfo = (entry) => {
  if (!entry || typeof entry !== 'object' || entry.source !== 'neo4j') {
    return null;
  }

  const query = String(entry.query || '');
  const nodeMatch = query.match(/WITH\s+"((?:\\.|[^"\\])*)"\s+AS\s+node_id/i);
  if (!nodeMatch || !/MATCH\s+\(n\s+\{id:\s+node_id\}\)-\[r\]-\(m\)/i.test(query)) {
    return null;
  }

  const limitMatch = query.match(/\bLIMIT\s+(\d+)/i);
  return {
    nodeId: nodeMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
    limit: limitMatch ? Number.parseInt(limitMatch[1], 10) : NEIGHBOR_QUERY_LIMIT,
  };
};

export const mergeExploreNeighborsCypher = (cypherList, nodeId) => {
  const existingIndex = cypherList.findIndex((entry) => getExploreQueryInfo(entry)?.nodeId === String(nodeId));
  if (existingIndex === -1) {
    return [...cypherList, buildExploreNeighborsCypher(nodeId)];
  }

  const existingEntry = cypherList[existingIndex];
  const existingInfo = getExploreQueryInfo(existingEntry);
  const mergedLimit = existingInfo.limit + NEIGHBOR_QUERY_LIMIT;
  const nextCypher = [...cypherList];
  nextCypher[existingIndex] = {
    ...existingEntry,
    query: String(existingEntry.query).replace(/\bLIMIT\s+\d+/i, `LIMIT ${mergedLimit}`),
  };
  return nextCypher;
};

const getEdgeIdentifier = (edge, index) => edge['~id'] || index.toString();

export const restoreAdjacentDeletedIds = (graphData, nodeId, deletedIds, restoreNodes = false) => {
  const nextDeletedIds = new Set(deletedIds);
  const adjacentNodeIds = new Set();
  const adjacentEdges = [];

  (graphData?.edges || []).forEach((edge, index) => {
    const startId = edge['~start'];
    const endId = edge['~end'];
    if (startId === nodeId || endId === nodeId) {
      adjacentEdges.push({ edge, index, startId, endId });
      if (startId === nodeId) {
        adjacentNodeIds.add(endId);
      }
      if (endId === nodeId) {
        adjacentNodeIds.add(startId);
      }
    }
  });

  if (restoreNodes) {
    adjacentNodeIds.forEach((id) => nextDeletedIds.delete(id));
  }

  adjacentEdges.forEach(({ edge, index, startId, endId }) => {
    if (!nextDeletedIds.has(startId) && !nextDeletedIds.has(endId)) {
      nextDeletedIds.delete(getEdgeIdentifier(edge, index));
    }
  });

  return nextDeletedIds;
};

const buildFindConnectionCypher = (nodeId, visibleNodeIds) => ({
  source: 'neo4j',
  query: [
    `WITH "${escapeCypherString(nodeId)}" AS selected_id,`,
    `     [${visibleNodeIds.map((id) => `"${escapeCypherString(id)}"`).join(', ')}] AS node_ids`,
    'MATCH (n {id: selected_id})-[r]-(m)',
    'WHERE m.id IN node_ids AND m.id <> selected_id',
    'WITH n, r, m',
    'LIMIT 200',
    'RETURN collect(DISTINCT n) + collect(DISTINCT m) AS nodes,',
    '       collect(DISTINCT r) AS edges',
  ].join('\n'),
});

const buildGraphRequestKey = (cypherList, mode, engine) => JSON.stringify({
  cypher: cypherList,
  mode,
  engine,
});

const modeOptionSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '2px',
  padding: '8px 10px',
  borderRadius: '6px',
  textAlign: 'left',
  textTransform: 'none',
  '&.Mui-disabled': {
    opacity: 0.5,
  },
};
const modeOptionTitleSx = { fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, lineHeight: '16px', color: '#1C3C68' };
const modeOptionSubtitleSx = { fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 400, lineHeight: '14px', color: '#94A3B8' };

const SwitchToggle = ({ label, icon, enabled, onChange, palette = DEFAULT_VIEWER_PALETTE }) => (
  <Box
    component="button"
    type="button"
    aria-pressed={enabled}
    onClick={onChange}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      height: '36px',
      padding: '0 8px',
      border: `1px solid ${palette.border}`,
      borderRadius: '10px',
      backgroundColor: palette.surface,
      cursor: 'pointer',
      '&:hover': { borderColor: palette.control, backgroundColor: palette.softSurface },
    }}
  >
    {icon}
    <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 400, lineHeight: '16px', color: palette.control, whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
    <span
      style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: enabled ? 'flex-end' : 'flex-start',
        width: '24px',
        height: '16px',
        padding: '2px',
        boxSizing: 'border-box',
        borderRadius: '256px',
        backgroundColor: enabled ? palette.control : '#C9C5BD',
      }}
    >
      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
    </span>
  </Box>
);

export const InfocardData = ({ value, config, dataKey }) => {
  const safeConfig = typeof config === 'string' ? config : '';
  const setting = safeConfig.match(/\(([^)]+)\)/)?.[1];
  const type = setting ? safeConfig.split('(')[0] : safeConfig;

  if (typeof value === 'boolean') {
    return <>{value ? 'Yes' : 'No'}</>;
  }

  if (!type) {
    return <>{formatInfocardValue(value)}</>;
  }

  if (type === 'string') {
    return <>{formatInfocardValue(value)}</>;
  }

  if (type === 'list') {
    return <>{formatInfocardValue(value)}</>;
  }

  if (type === 'int') {
    return <>{value !== undefined && value !== null ? parseInt(value, 10).toLocaleString() : 'No Data'}</>;
  }

  if (type === 'float') {
    return <>{value !== undefined && value !== null ? parseFloat(value).toFixed(setting || 1) : 'No Data'}</>;
  }

  if (["link", "link_static"].includes(type)) {
    const href = getInfocardHref(type === 'link' ? value : dataKey);
    return (
      <Link
        href={href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
            cursor: 'pointer',
          },
        }}
      >
        {href ? 'Open Link ↗' : 'Not Available'}
      </Link>
    );
  }

  if (["label_chr", "label_percentage"].includes(type)) {
    return (
      <div
        style={{
          backgroundColor: setting || '#0FB47D',
          height: '14px',
          padding: '1.5px 4px',
          marginY: '-4px',
          borderRadius: '8.5px',
          textDecoration: 'none',
          color: 'white',
          fontFamily: 'Open Sans',
          fontWeight: '700',
          fontSize: '12px',
        }}
      >
        {value ? (type === 'label_chr' ? `Chr${value}` : `${parseFloat(value).toFixed(1)}%`) : 'No Data'}
      </div>
    );
  }

  return <span>{formatInfocardValue(value)}</span>;
};

const hasInfocardValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
};

const formatPropertyLabel = (key) => key
  .replace(/^alt_id_/i, 'alternate ID ')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const getSafeEdgeMidpoint = (ele) => {
  try {
    if (!ele || typeof ele.midpoint !== 'function') {
      return null;
    }
    const midpoint = ele.midpoint();
    if (!midpoint || !Number.isFinite(midpoint.x) || !Number.isFinite(midpoint.y)) {
      return null;
    }
    return midpoint;
  } catch {
    return null;
  }
};

const getSafeElementPosition = (ele) => {
  try {
    if (!ele || ele.nonempty === false) {
      return null;
    }
    if (typeof ele.removed === 'function' && ele.removed()) {
      return null;
    }
    if (typeof ele.isNode === 'function' && ele.isNode()) {
      const pos = ele.position?.();
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
        return null;
      }
      return pos;
    }
    return getSafeEdgeMidpoint(ele);
  } catch {
    return null;
  }
};

const CANONICAL_NODE_LABEL_PRIORITY = graphInfocard.canonical_node_label_priority || [];
const GENERIC_NODE_LABELS = new Set(
  (graphInfocard.generic_node_labels || []).map((label) => label.toLowerCase()),
);
const HIDDEN_INFO_PROPERTIES = new Set(graphInfocard.hidden_info_properties || []);
const EVIDENCE_LIMITATION_PROPERTIES = new Map([
  ['human_mechanism_status', 'Human mechanism status'],
  ['evidence_limitation', 'Limitation'],
  ['model_support_scope', 'Model support'],
  ['required_human_evidence', 'Required human evidence'],
  ['evidence_gap_source_ids', 'Supporting source IDs'],
  ['evidence_assessments', 'Evidence assessments'],
]);

const normalizeNodeType = (label) => label;

export const isHiddenInfoProperty = (key) => {
  const normalizedKey = String(key || '');
  return HIDDEN_INFO_PROPERTIES.has(normalizedKey)
    || /(?:^|_)checksum(?:$|_)/i.test(normalizedKey)
    || /_sha256$/i.test(normalizedKey)
    || /^render(?:_|[A-Z]|$)/.test(normalizedKey)
    || /^layout(?:_|$)/i.test(normalizedKey)
    || /^navigation(?:_|$)/i.test(normalizedKey)
    || /(?:^|_)overlay(?:$|_)/i.test(normalizedKey);
};

const isStructuredInfocardValue = (value) => (
  Boolean(value) && typeof value === 'object'
);

export const getCanonicalNodeLabel = (node) => {
  const labels = Array.isArray(node?.['~labels'])
    ? node['~labels'].filter(Boolean).map(String)
    : (node?.['~labels'] ? [String(node['~labels'])] : []);
  const labelsByLower = new Map(labels.map((label) => [label.toLowerCase(), label]));
  const canonicalLabel = CANONICAL_NODE_LABEL_PRIORITY.find(
    (label) => labelsByLower.has(label.toLowerCase()),
  );

  return canonicalLabel
    || labels.find((label) => !GENERIC_NODE_LABELS.has(label.toLowerCase()))
    || labels[0]
    || 'Coding_element';
};

export const getNodeType = (node, viewNodeColors = EMPTY_VIEWER_COLORS) => {
  const labels = (Array.isArray(node?.['~labels']) ? node['~labels'] : [])
    .filter(Boolean)
    .map(String);
  const viewLocalLabels = labels.filter(
    (label) => Object.prototype.hasOwnProperty.call(viewNodeColors, label),
  );
  const viewLocalOnlyLabel = viewLocalLabels.find(
    (label) => !graphInfocard.nodes?.[label] && !nodeColors[label],
  );
  if (viewLocalOnlyLabel) return viewLocalOnlyLabel;

  const canonicalLabel = getCanonicalNodeLabel(node);
  const orderedLabels = [canonicalLabel, ...labels.filter((label) => label !== canonicalLabel)];
  return orderedLabels
    .map(normalizeNodeType)
    .find((label) => graphInfocard.nodes?.[label]?.info_panel
      || nodeColors[label]
      || Object.prototype.hasOwnProperty.call(viewNodeColors, label))
    || 'Coding_element';
};

export const buildViewNodeStyles = (
  viewNodeColors = EMPTY_VIEWER_COLORS,
  viewNodeBorderColors = EMPTY_VIEWER_COLORS,
  viewNodeTextColors = EMPTY_VIEWER_COLORS,
) => Object.entries(viewNodeColors).flatMap(([type, color]) => ([
  {
    selector: `node[type = "${type}"][Level = "Core"]`,
    style: {
      shape: 'round-rectangle',
      label: 'data(label)',
      'border-width': 1,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'data(labelWrap)',
      'text-max-width': 'data(labelMaxWidth)',
      padding: '4px',
      'background-color': color,
      'border-color': viewNodeBorderColors[type] || color,
      color: viewNodeTextColors[type] || '#193336',
    },
  },
  {
    selector: `node[type = "${type}"][Level = "Neighbor"]`,
    style: {
      shape: 'round-rectangle',
      label: 'data(label)',
      'border-width': 1,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'data(labelWrap)',
      'text-max-width': 'data(labelMaxWidth)',
      padding: '4px',
      'border-color': viewNodeBorderColors[type] || color,
      color: viewNodeTextColors[type] || '#333333',
    },
  },
]));

export const getNodeLabel = (node) => {
  const properties = node?.['~properties'] || {};
  if (Object.prototype.hasOwnProperty.call(properties, 'display_label')) {
    return String(properties.display_label ?? '').replace(/_/g, ' ');
  }
  const baseName = properties.name || properties.id || node?.['~id'] || '';

  if (baseName && baseName.length <= 15) {
    return baseName.replace(/_/g, ' ');
  }

  return String(baseName).replace(/_/g, ' ');
};

const getInfoPanel = (isEdge, type, infoPanelOverrides = {}) => {
  const kind = isEdge ? 'edge' : 'node';
  const runtimePanel = infoPanelOverrides?.[kind]?.[type];
  if (Array.isArray(runtimePanel)) return runtimePanel;
  const configuredPanel = (isEdge ? graphInfocard.edges : graphInfocard.nodes)?.[type]?.info_panel;
  if (Array.isArray(configuredPanel)) return configuredPanel;
  const profileName = isEdge
    ? graphInfocard.edge_panel_by_type?.[type]
    : graphInfocard.node_panel_by_label?.[type];
  const profile = (isEdge ? graphInfocard.edge_panels : graphInfocard.node_panels)?.[profileName];
  return profile || (isEdge ? graphInfocard.default_edge_info_panel : graphInfocard.default_node_info_panel);
};

const getBoxCorners = (posData) => {
  if (
    Array.isArray(posData?.start_xy) &&
    Array.isArray(posData?.end_xy) &&
    posData.start_xy.length >= 2 &&
    posData.end_xy.length >= 2 &&
    Number.isFinite(posData.start_xy[0]) &&
    Number.isFinite(posData.start_xy[1]) &&
    Number.isFinite(posData.end_xy[0]) &&
    Number.isFinite(posData.end_xy[1])
  ) {
    return {
      startX: posData.start_xy[0],
      startY: posData.start_xy[1],
      endX: posData.end_xy[0],
      endY: posData.end_xy[1],
    };
  }

  return null;
};

const getRenderPosition = (posData) => {
  if (Number.isFinite(posData?.x) && Number.isFinite(posData?.y)) {
    return {
      x: scaleX(posData.x),
      y: scaleYPosition(posData.y),
    };
  }

  const boxCorners = getBoxCorners(posData);
  if (boxCorners) {
    return {
      x: scaleX((boxCorners.startX + boxCorners.endX) / 2),
      y: scaleYPosition((boxCorners.startY + boxCorners.endY) / 2),
    };
  }

  return null;
};

const getRenderWidth = (posData) => {
  if (
    Number.isFinite(posData?.genome_start_x) &&
    Number.isFinite(posData?.genome_end_x)
  ) {
    return scaleX(posData.genome_end_x - posData.genome_start_x);
  }

  const boxCorners = getBoxCorners(posData);
  if (boxCorners) {
    return scaleX(Math.abs(boxCorners.endX - boxCorners.startX));
  }

  return Number.isFinite(posData?.width) ? scaleX(posData.width) : posData?.width;
};

const getRenderHeight = (posData) => {
  const boxCorners = getBoxCorners(posData);
  if (boxCorners) {
    return scaleHeight(Math.abs(boxCorners.endY - boxCorners.startY));
  }

  return Number.isFinite(posData?.height) ? scaleHeight(posData.height) : posData?.height;
};

export const getGenomeLaneModelYs = (genomeRegion, genomeTracks) => {
  const regionLanes = Array.isArray(genomeRegion?.lanes) ? genomeRegion.lanes : [];
  const trackLanes = Array.isArray(genomeTracks?.lanes) ? genomeTracks.lanes : [];
  const fallbackGroups = Array.isArray(genomeRegion?.groups) && genomeRegion.groups.length
    ? genomeRegion.groups
    : (Array.isArray(genomeTracks?.groups) ? genomeTracks.groups : []);
  const fallbackLanesByName = new Map();
  fallbackGroups.forEach((group) => {
    (Array.isArray(group?.lanes) ? group.lanes : []).forEach((lane) => {
      if (!fallbackLanesByName.has(lane?.name)) {
        fallbackLanesByName.set(lane?.name, lane);
      }
    });
  });
  const lanes = regionLanes.length
    ? regionLanes
    : (trackLanes.length ? trackLanes : Array.from(fallbackLanesByName.values()));

  return lanes
    .filter((lane) => lane?.name && Number.isFinite(lane.y))
    .map((lane, laneIndex) => ({
      ...lane,
      key: `${lane.name}:${laneIndex}`,
      modelY: lane.y,
    }));
};

const getLabelMaxWidth = (renderWidth) => {
  if (!Number.isFinite(renderWidth)) {
    return undefined;
  }

  return Math.max(renderWidth - 8, 6);
};

const getEdgeCurveDistance = (edgeId) => {
  const source = String(edgeId || '');
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }

  const curveDistances = [-70, -50, -35, 35, 50, 70];
  return curveDistances[Math.abs(hash) % curveDistances.length];
};

const toRenderedRoutePoint = (point) => ({
  x: scaleX(Number(point?.[0])),
  y: scaleYPosition(Number(point?.[1])),
});

const toRelativeControlPoint = (point, source, target) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!Number.isFinite(lengthSquared) || lengthSquared <= 1e-9) {
    return null;
  }
  const rendered = toRenderedRoutePoint(point);
  if (!Number.isFinite(rendered.x) || !Number.isFinite(rendered.y)) {
    return null;
  }
  const weight = ((rendered.x - source.x) * dx + (rendered.y - source.y) * dy) / lengthSquared;
  const projectedX = source.x + weight * dx;
  const projectedY = source.y + weight * dy;
  const distance = ((rendered.x - projectedX) * -dy + (rendered.y - projectedY) * dx)
    / Math.sqrt(lengthSquared);
  return { distance, weight };
};

export const edgeRouteToCytoscapeData = (route, source, target) => {
  if (!route || !source || !target) {
    return null;
  }
  const points = route.route_type === 'bezier' ? route.control_points : route.waypoints;
  if (!['bezier', 'polyline'].includes(route.route_type) || !Array.isArray(points)) {
    return null;
  }
  const converted = points
    .map((point) => toRelativeControlPoint(point, source, target))
    .filter(Boolean);
  if (!converted.length && points.length) {
    return null;
  }
  const distances = converted.map(({ distance }) => String(Number(distance.toFixed(3)))).join(' ');
  const weights = converted.map(({ weight }) => String(Number(weight.toFixed(6)))).join(' ');
  if (route.route_type === 'polyline') {
    return {
      routeCurveStyle: 'segments',
      segmentDistances: distances,
      segmentWeights: weights,
    };
  }
  // Cytoscape's unbundled Bézier renderer can overshoot an endpoint when an
  // obstacle-avoidance control point projects outside the source-target span.
  // Preserve that exact safe corridor with rounded segments instead.
  if (converted.some(({ weight }) => weight < 0 || weight > 1)) {
    return {
      routeCurveStyle: 'round-segments',
      segmentDistances: distances,
      segmentWeights: weights,
      segmentRadii: converted.map(() => '36').join(' '),
    };
  }
  return {
    routeCurveStyle: 'unbundled-bezier',
    curveDistance: distances || '0',
    curveWeight: weights || '0.5',
  };
};

export const edgeLabelToCytoscapeData = (route, source, target, label) => {
  if (!route) {
    return { displayLabel: label, labelMarginX: '0', labelMarginY: '0' };
  }
  if (!source || !target || route.label_visible === false) {
    return { displayLabel: '', labelMarginX: '0', labelMarginY: '0' };
  }
  const anchor = Array.isArray(route.label_anchor) ? toRenderedRoutePoint(route.label_anchor) : null;
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    return { displayLabel: label, labelMarginX: '0', labelMarginY: '0' };
  }
  const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  return {
    displayLabel: label,
    labelMarginX: String(Number((anchor.x - midpoint.x).toFixed(3))),
    labelMarginY: String(Number((anchor.y - midpoint.y).toFixed(3))),
  };
};

export const buildPreviousLayout = (coordData, edgeRoutes, metadata) => {
  const layout = metadata?.layout;
  if (layout?.engine !== 'optimized_v1' || !layout?.config_fingerprint || !coordData) {
    return null;
  }
  return {
    version: layout.version || 1,
    config_fingerprint: layout.config_fingerprint,
    xy_json: coordData,
    edge_routes: edgeRoutes || {},
  };
};

const buildTrackBackgroundNode = (genomeRegion) => {
  if (!genomeRegion) {
    return null;
  }

  return {
    data: {
      id: '__track_background__',
      label: '',
      trackBackground: 'true',
      renderWidth: scaleX(genomeRegion.width),
      renderHeight: scaleHeight(genomeRegion.height),
    },
    position: {
      x: scaleX(genomeRegion.x + (genomeRegion.width / 2)),
      y: scaleYPosition(genomeRegion.y + (genomeRegion.height / 2)),
    },
    selectable: false,
    grabbable: false,
    pannable: false,
    locked: true,
  };
};

const buildCellBackgroundNodes = (cellRegions) => (cellRegions || [])
  .filter((region) => region?.id
    && Number.isFinite(region.x)
    && Number.isFinite(region.y)
    && Number.isFinite(region.width)
    && Number.isFinite(region.height))
  .map((region) => ({
    data: {
      id: `__cell_background__:${region.id}`,
      label: region.label || 'Cell',
      cellBackground: 'true',
      cellFill: region.fill || '#EFF6FF',
      cellBorder: region.border || '#3B82F6',
      cellTitleFontSize: Number(region.title_font_size) || 20,
      renderWidth: scaleX(region.width),
      renderHeight: scaleYPosition(region.height),
    },
    position: {
      x: scaleX(region.x),
      y: scaleYPosition(region.y),
    },
    selectable: false,
    grabbable: false,
    pannable: false,
    locked: true,
  }));

const buildMechanismBackgroundNodes = (mechanismRegions, titleMode) => (mechanismRegions || [])
  .filter((region) => region?.id
    && Number.isFinite(region.x)
    && Number.isFinite(region.y)
    && Number.isFinite(region.width)
    && Number.isFinite(region.height))
  .map((region) => ({
    data: {
      id: `__mechanism_background__:${region.id}`,
      mechanismRegionId: region.id,
      label: ['header_band_v1', 'region_tab_v1'].includes(titleMode) ? '' : (region.display_label
        || (Array.isArray(region.title_lines) ? region.title_lines.join('\n') : '')
        || region.label
        || region.id),
      mechanismBackground: 'true',
      mechanismFill: region.fill || '#F8FAFC',
      mechanismBorder: region.border || '#94A3B8',
      mechanismTitleFontSize: Number(region.title_font_size) || 26,
      mechanismTitleMarginY: Number(region.title_margin_y) || 24,
      mechanismTitleColor: region.title_text_color || region.border || '#334155',
      mechanismTitleBackground: region.title_background_color || '#FFFFFF',
      mechanismTitleBackgroundOpacity: Number.isFinite(Number(region.title_background_opacity))
        ? Number(region.title_background_opacity)
        : 0.96,
      mechanismTitleMaxWidth: Math.max(120, scaleX(region.width) - 48),
      renderWidth: scaleX(region.width),
      renderHeight: scaleYPosition(region.height),
    },
    position: {
      x: scaleX(region.x + region.width / 2),
      y: scaleYPosition(region.y + region.height / 2),
    },
    selectable: false,
    grabbable: false,
    pannable: false,
    locked: true,
  }));

export const buildMechanismTitleNodes = (mechanismRegions, titleStyle = {}) => (
  ['header_band_v1', 'region_tab_v1'].includes(titleStyle?.mode) ? (mechanismRegions || []) : []
).filter((region) => region?.id
  && Number.isFinite(region.x)
  && Number.isFinite(region.y)
  && Number.isFinite(region.width))
  .map((region) => {
    if (titleStyle?.mode === 'region_tab_v1') {
      const tab = region.label_node || {};
      const compactTag = (tab.shape || titleStyle.default_shape) === 'compact-tag';
      const lines = Array.isArray(tab.title_lines)
        ? tab.title_lines.slice(0, 2)
        : (Array.isArray(region.title_lines) ? region.title_lines.slice(0, 2) : [region.label || region.id]);
      if (![tab.x, tab.y, tab.width, tab.height].every(Number.isFinite)) return null;
      return {
        data: {
          id: `__mechanism_title__:${region.id}`,
          label: lines.join('\n'),
          mechanismTitle: 'true',
          mechanismTitleMode: 'region_tab_v1',
          mechanismTitleVariant: compactTag ? 'compact-tag' : 'standard',
          mechanismTitleShape: compactTag ? 'polygon' : (tab.shape || titleStyle.default_shape || 'round-rectangle'),
          mechanismTitleFill: tab.fill || region.fill || '#E8E1D8',
          mechanismTitleBorder: tab.border || region.border || '#567F74',
          mechanismTitleColor: tab.text_color || titleStyle.text_color || '#304B49',
          mechanismTitleFontSize: Math.max(34, Math.min(46, Number(tab.font_size) || 40)),
          mechanismTitleTextMaxWidth: scaleX(tab.width) * 0.94,
          renderWidth: scaleX(tab.width),
          renderHeight: scaleHeight(tab.height),
        },
        position: { x: scaleX(tab.x), y: scaleYPosition(tab.y) },
        selectable: false,
        grabbable: false,
        pannable: false,
        locked: true,
      };
    }
    const bandHeight = Number(region.header_band_height || titleStyle.band_height) || 180;
    const padding = Number(titleStyle.horizontal_padding) || 28;
    const lines = Array.isArray(region.title_lines) ? region.title_lines.slice(0, 2) : [region.label || region.id];
    return {
      data: {
        id: `__mechanism_title__:${region.id}`,
        label: lines.join('\n'),
        mechanismTitle: 'true',
        mechanismTitleMode: 'header_band_v1',
        mechanismTitleShape: 'round-rectangle',
        mechanismTitleFill: region.title_background_color || titleStyle.surface || '#FFF9F0',
        mechanismTitleBorder: region.border || '#567F74',
        mechanismTitleColor: region.title_text_color || titleStyle.text_color || '#304B49',
        mechanismTitleFontSize: Math.max(30, Math.min(42, Number(region.title_font_size) || 34)),
        renderWidth: Math.max(120, scaleX(region.width) - padding * 2),
        renderHeight: Math.max(54, scaleHeight(bandHeight) - 14),
      },
      position: {
        x: scaleX(region.x + region.width / 2),
        y: scaleYPosition(region.y + bandHeight / 2),
      },
      selectable: false,
      grabbable: false,
      pannable: false,
      locked: true,
    };
  }).filter(Boolean);

const buildCanvasImageNode = (image) => {
  if (
    !image?.url
    || !Number.isFinite(image.x)
    || !Number.isFinite(image.y)
    || !Number.isFinite(image.width)
    || !Number.isFinite(image.height)
  ) {
    return null;
  }

  return {
    data: {
      id: '__canvas_image__',
      label: '',
      canvasImage: 'true',
      canvasImageUrl: image.url,
      canvasImageOpacity: clampOpacity(image.opacity, 0.72),
      canvasImageFit: image.fit || 'contain',
      canvasImageBackground: image.background_color || '#FCFAF6',
      renderWidth: scaleX(image.width),
      renderHeight: scaleHeight(image.height),
    },
    position: {
      x: scaleX(image.x + image.width / 2),
      y: scaleYPosition(image.y + image.height / 2),
    },
    selectable: false,
    grabbable: false,
    pannable: false,
    locked: true,
  };
};

const viewModeLabel = (viewMode) => ({
  genome_mode: 'Genome browser mode',
  cell_type_mode: 'Cell type mode',
  kg_only: 'KG mode',
}[viewMode] || 'KG mode');

export const InfocardMenu = ({ hoveredData, infoPanelOverrides }) => {
  const isEdge = hoveredData?.source && hoveredData?.target;
  const schema = getInfoPanel(isEdge, hoveredData?.type, infoPanelOverrides);
  const titleColumn = schema?.find(([label]) => label === 'Title');
  const footerInfo = (schema?.find(([label]) => label === 'Footer')?.[1] || [])
    .filter(([, key]) => !isHiddenInfoProperty(key) && hasInfocardValue(hoveredData?.[key]));
  const evidenceLimitationRows = isEdge
    ? []
    : Array.from(EVIDENCE_LIMITATION_PROPERTIES.entries())
      .filter(([key]) => hasInfocardValue(hoveredData?.[key]));
  const configuredKeys = new Set([
    titleColumn?.[1],
    ...footerInfo.map(([, key]) => key),
    ...EVIDENCE_LIMITATION_PROPERTIES.keys(),
    ...schema.flatMap(([, content]) => Array.isArray(content)
      ? content.map(([, key]) => key)
      : [content]),
  ]);
  const additionalRows = Object.entries(hoveredData || {})
    .filter(([key, value]) => !configuredKeys.has(key)
      && !isHiddenInfoProperty(key)
      && !key.startsWith('preview_')
      && !['label', 'type', 'Level', 'source', 'target', 'source_name', 'target_name', 'renderWidth', 'renderHeight', 'labelMaxWidth'].includes(key)
      && hasInfocardValue(value))
    .sort(([left], [right]) => left.localeCompare(right));
  const titleValue = isEdge
    ? hoveredData?.type
    : getNodeLabel({ '~properties': hoveredData, '~id': hoveredData?.id });

  return (
    hoveredData && (schema?.length > 0 ? (
      <>
        <Box
          sx={{
            display: 'flex',
            paddingY: '17px',
            textAlign: 'center',
            backgroundColor: '#E4F0F1',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Open Sans',
              fontWeight: '700',
              fontSize: '20px',
              lineHeight: '20px',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            <InfocardData
              value={titleValue?.replace?.(/_/g, ' ')}
              dataKey={titleColumn?.[1]}
            />
          </Typography>
        </Box>
        {schema.map(([title, content, config]) => {
          if (['Title', 'Footer'].includes(title)) return null;
          const visibleContent = Array.isArray(content)
            ? content.filter(([, key]) => !isHiddenInfoProperty(key)
              && !EVIDENCE_LIMITATION_PROPERTIES.has(key)
              && hasInfocardValue(hoveredData?.[key]))
            : content;
          if ((Array.isArray(content) && !visibleContent.length)
            || (!Array.isArray(content) && (isHiddenInfoProperty(content)
              || EVIDENCE_LIMITATION_PROPERTIES.has(content)
              || !hasInfocardValue(hoveredData?.[content])))) return null;
          return (
            <Box
              key={title}
              sx={{
                width: 'calc(100% - 32px)',
                display: 'flex',
                flexDirection: 'column',
                padding: '16px',
                borderBottom: '1px solid #F0F0F0',
                gap: '12px',
              }}
            >
              <Typography
                sx={{
                  alignSelf: 'center',
                  fontFamily: 'Open Sans',
                  fontWeight: '600',
                  fontSize: '10px',
                  color: '#6B7880',
                  lineHeight: '7px',
                  textTransform: 'uppercase',
                }}
              >
                {title}
              </Typography>
              {Array.isArray(visibleContent) ? (
                visibleContent.map(([label, key, rowConfig]) => (
                  <Box
                    key={key}
                    sx={{ display: 'grid', gridTemplateColumns: 'minmax(92px, 0.8fr) minmax(0, 1.2fr)', columnGap: '10px', alignItems: 'start' }}
                  >
                    <Typography
                      sx={{
                        fontFamily: 'Open Sans',
                        fontWeight: '600',
                        fontSize: '12px',
                        color: '#6B7880',
                        lineHeight: '14px',
                        marginTop: '-5px',
                      }}
                    >
                      {label}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{
                        textAlign: isStructuredInfocardValue(hoveredData[key]) ? 'left' : 'right', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: isStructuredInfocardValue(hoveredData[key]) ? '14em' : '4.2em', overflow: isStructuredInfocardValue(hoveredData[key]) ? 'auto' : 'hidden', display: isStructuredInfocardValue(hoveredData[key]) ? 'block' : '-webkit-box', WebkitLineClamp: isStructuredInfocardValue(hoveredData[key]) ? 'unset' : 3, WebkitBoxOrient: 'vertical',
                        fontFamily: 'Open Sans',
                        fontWeight: '600',
                        fontSize: '12px',
                        color: '#263238',
                        marginLeft: '8px',
                        lineHeight: '14px',
                        marginTop: '-5px',
                      }}
                    >
                      <InfocardData value={hoveredData[key]} dataKey={key} config={rowConfig} />
                    </Typography>
                  </Box>
                ))
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Typography
                    sx={{
                      marginTop: '-5px',
                      fontFamily: 'Open Sans',
                      fontWeight: '600',
                      fontSize: '10px',
                      lineHeight: '15px',
                      wordWrap: 'break-word',
                      color: '#263238',
                      textAlign: 'justify', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '7.5em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {(() => {
                      const rawValue = hoveredData[visibleContent];
                      const processedData = config !== 'string' && typeof rawValue === 'string'
                        ? addWhitespace(rawValue)
                        : rawValue;
                      const processedKey = config === 'string' ? addWhitespace(visibleContent) : visibleContent;
                      return <InfocardData value={processedData} dataKey={processedKey} config={config} />;
                    })()}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
        {evidenceLimitationRows.length > 0 && (
          <Box
            sx={{
              width: 'calc(100% - 32px)',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              borderTop: '1px solid #E2B85B',
              borderBottom: '1px solid #E2B85B',
              backgroundColor: '#FFF4D6',
              gap: '12px',
            }}
          >
            <Typography
              sx={{
                alignSelf: 'center',
                padding: '4px 9px',
                borderRadius: '999px',
                backgroundColor: '#E8B44E',
                color: '#3B2A08',
                fontFamily: 'Open Sans',
                fontWeight: 700,
                fontSize: '10px',
                lineHeight: '12px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Evidence limitation
            </Typography>
            {evidenceLimitationRows.map(([key, label]) => {
              const value = hoveredData[key];
              const structured = isStructuredInfocardValue(value);
              return (
                <Box
                  key={key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: structured ? '1fr' : 'minmax(92px, 0.8fr) minmax(0, 1.2fr)',
                    gap: '6px 10px',
                    alignItems: 'start',
                  }}
                >
                  <Typography sx={{ fontFamily: 'Open Sans', fontWeight: 600, fontSize: '12px', color: '#75520C', lineHeight: '16px' }}>
                    {label}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      minWidth: 0,
                      maxHeight: structured ? '16em' : 'none',
                      overflow: structured ? 'auto' : 'visible',
                      textAlign: structured ? 'left' : 'right',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      fontFamily: structured ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Open Sans',
                      fontWeight: structured ? 400 : 600,
                      fontSize: structured ? '10px' : '12px',
                      color: '#3B2A08',
                      lineHeight: structured ? '14px' : '16px',
                    }}
                  >
                    <InfocardData value={value} dataKey={key} config={structured ? 'string' : undefined} />
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
        {additionalRows.length > 0 && <Box sx={{ width: 'calc(100% - 32px)', display: 'flex', flexDirection: 'column', padding: '16px', borderBottom: '1px solid #F0F0F0', gap: '12px' }}>
          <Typography sx={{ alignSelf: 'center', fontFamily: 'Open Sans', fontWeight: '600', fontSize: '10px', color: '#6B7880', lineHeight: '7px', textTransform: 'uppercase' }}>
            Additional properties
          </Typography>
          {additionalRows.map(([key, value]) => (
            <Box key={key} sx={{ display: 'grid', gridTemplateColumns: 'minmax(92px, 0.8fr) minmax(0, 1.2fr)', columnGap: '10px', alignItems: 'start' }}>
              <Typography sx={{ fontFamily: 'Open Sans', fontWeight: '600', fontSize: '12px', color: '#6B7880', lineHeight: '14px', marginTop: '-5px' }}>{formatPropertyLabel(key)}</Typography>
              <Typography component="span" sx={{ textAlign: isStructuredInfocardValue(value) ? 'left' : 'right', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: isStructuredInfocardValue(value) ? '14em' : '4.2em', overflow: isStructuredInfocardValue(value) ? 'auto' : 'hidden', display: isStructuredInfocardValue(value) ? 'block' : '-webkit-box', WebkitLineClamp: isStructuredInfocardValue(value) ? 'unset' : 3, WebkitBoxOrient: 'vertical', fontFamily: isStructuredInfocardValue(value) ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Open Sans', fontWeight: isStructuredInfocardValue(value) ? '400' : '600', fontSize: isStructuredInfocardValue(value) ? '10px' : '12px', color: '#263238', marginLeft: '8px', lineHeight: '14px', marginTop: '-5px' }}>
                <InfocardData value={value} dataKey={key} config={Array.isArray(value) ? 'list' : undefined} />
              </Typography>
            </Box>
          ))}
        </Box>}
        {footerInfo.length > 0 && <Box
          sx={{
            display: 'flex',
            minHeight: '30px',
            padding: '5px 10px',
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(360deg, #CACFD5 -73.08%, #F4F6F8 75%)',
          }}
        >
          <Typography sx={{ fontWeight: '600', fontSize: '9px', color: '#5F7885', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }}>
            {footerInfo.map(([label, key, footerConfig], index) => (
              index === 0 ? (
                <span key={index}>
                  {`${label}: `}
                  <InfocardData value={hoveredData[key]} dataKey={key} config={footerConfig} />
                </span>
              ) : (
                <span key={index}>
                  {` | ${label}: `}
                  <InfocardData value={hoveredData[key]} dataKey={key} config={footerConfig} />
                </span>
              )
            ))}
          </Typography>
        </Box>}
      </>
    ) : (
      <div
        style={{
          padding: '16px',
          fontFamily: 'Open Sans',
          fontWeight: '600',
          alignContent: 'center',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
          {hoveredData?.HGNC_symbol || hoveredData?.id}
        </div>
        {Object.entries(hoveredData || {}).map(([key, value]) => (
          key !== 'type' && (
            key === 'link' || key === 'url' ? (
              <div key={key}>
                <span style={{ fontWeight: 500 }}>{key}:</span>{' '}
                <a href={getInfocardHref(value) || undefined} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>
                  {getInfocardHref(value) ? 'Open Link ↗' : 'Not Available'}
                </a>
              </div>
            ) : (
              <div key={key}>
                <span style={{ fontWeight: 500 }}>{key}:</span> {String(value)}
              </div>
            )
          )
        ))}
      </div>
    ))
  );
};

export default function StandaloneKnowledgeGraph({
  graphData = null,
  coordData = null,
  edgeRoutes = null,
  metadata = null,
  queryRequest = null,
  queryExamples = [],
  assetBaseUrl = '',
  containerHeight = '600px',
  defaultLegendVisible = false,
  developerMode = null,
  reviewMode = null,
  searchConfig = null,
  exactPreviewCapture = false,
  sx = {},
}) {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const infocardRef = useRef(null);
  const hoveredIdRef = useRef(null);
  const appearTimeoutRef = useRef(null);
  const fadeOutTimeoutRef = useRef(null);
  const toolbarRowRef = useRef(null);
  const toolbarTitleRef = useRef(null);
  const toolbarZoomGroupMeasureRef = useRef(null);
  const toolbarSecondaryGroupRef = useRef(null);
  const clickMenuEnabledRef = useRef(true);
  const developerDirtyRef = useRef(false);
  const developerDialogRef = useRef(null);
  const contextMenuRef = useRef(null);
  const modeMenuRef = useRef(null);
  const focusMenuRef = useRef(null);
  const baseCypherRef = useRef(null);
  const graphCacheRef = useRef(new Map());
  const lastFetchedKeyRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const interactionAbortRef = useRef(null);
  const queryResultPage = useSelector((state) => state.queryResultPage?.queryResultPage);

  const [activeNode, setActiveNode] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [infocardPosition, setInfocardPosition] = useState({ x: 0, y: 0 });
  const [infocardVisible, setInfocardVisible] = useState(false);
  const [legendVisible, setLegendVisible] = useState(defaultLegendVisible);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [initZoom, setInitZoom] = useState(1);
  const [infocardHovered, setInfocardHovered] = useState(false);
  const [nodeHovered, setNodeHovered] = useState(false);
  const [infocardEnabled, setInfocardEnabled] = useState(true);
  const [clickMenuEnabled, setClickMenuEnabled] = useState(true);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [focusMenuOpen, setFocusMenuOpen] = useState(false);
  const [activeFocusLabel, setActiveFocusLabel] = useState('Overview');
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [pathwayPreview, setPathwayPreview] = useState(null);
  const [pathwayPreviewLoadError, setPathwayPreviewLoadError] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [viewMode, setViewMode] = useState(metadata?.layout?.mode || 'kg_only');
  const [layoutEngine, setLayoutEngine] = useState(metadata?.layout?.engine || queryRequest?.layout_engine || 'legacy');
  const [showZoomToolbarGroup, setShowZoomToolbarGroup] = useState(true);
  const [thumbnailImage, setThumbnailImage] = useState('');
  const [thumbnailViewport, setThumbnailViewport] = useState(null);
  const [viewportState, setViewportState] = useState({
    zoom: 1,
    panX: 0,
    panY: 0,
    width: 0,
    height: 0,
  });

  // Interaction state: a "current state" is a query list (Cypher history) plus a
  // deleted-element list. Explore neighbors / find connection / delete node / delete
  // edge are the only operations that advance this history, so undo/redo only ever
  // replays combinations of (query list, deleted list) - never camera/drag state.
  const [interactionHistory, setInteractionHistory] = useState(null);
  const [interactionGraph, setInteractionGraph] = useState(null);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [reviewSelectionGraph, setReviewSelectionGraph] = useState(null);
  const [highlightedIds, setHighlightedIds] = useState(() => new Set());
  const [developerSelection, setDeveloperSelection] = useState(null);
  const [pendingDeveloperNavigation, setPendingDeveloperNavigation] = useState(null);
  const [developerEditorDirty, setDeveloperEditorDirty] = useState(false);
  const [developerRecordOverrides, setDeveloperRecordOverrides] = useState({});
  const [infoPanelOverrides, setInfoPanelOverrides] = useState({ node: {}, edge: {} });
  const [layoutChanges, setLayoutChanges] = useState({});
  const [layoutHistory, setLayoutHistory] = useState({ past: [], future: [] });
  const developerEnabled = Boolean(developerMode?.enabled && metadata?.viewer?.developer_mode);
  const reviewEnabled = Boolean(reviewMode?.enabled);
  const reviewDownloadAllowed = reviewMode?.allowDownload === true;

  useEffect(() => {
    clickMenuEnabledRef.current = clickMenuEnabled;
  }, [clickMenuEnabled]);

  useEffect(() => () => {
    interactionAbortRef.current?.abort();
  }, []);

  const baseDisplayGraphData = interactionGraph?.graphData ?? queryResult?.graphData ?? graphData;
  const displayGraphData = useMemo(() => {
    if (!baseDisplayGraphData || !Object.keys(developerRecordOverrides).length) return baseDisplayGraphData;
    return {
      ...baseDisplayGraphData,
      nodes: (baseDisplayGraphData.nodes || []).map((record) => developerRecordOverrides[record['~id']] || record),
      edges: (baseDisplayGraphData.edges || []).map((record) => developerRecordOverrides[record['~id']] || record),
    };
  }, [baseDisplayGraphData, developerRecordOverrides]);
  const displayCoordData = interactionGraph?.coordData ?? queryResult?.coordData ?? coordData;
  const changedLayoutPositions = useMemo(() => Object.fromEntries(
    Object.entries(layoutChanges).filter(([id, position]) => {
      const original = displayCoordData?.[id] || {};
      return position.x !== original.x || position.y !== original.y;
    }),
  ), [layoutChanges, displayCoordData]);
  const layoutDirty = Object.keys(changedLayoutPositions).length > 0;
  useEffect(() => {
    developerDirtyRef.current = layoutDirty || developerEditorDirty;
  }, [layoutDirty, developerEditorDirty]);
  const displayEdgeRoutes = interactionGraph?.edgeRoutes ?? queryResult?.edgeRoutes ?? edgeRoutes;
  const displayMetadata = interactionGraph?.metadata ?? queryResult?.metadata ?? metadata;
  const effectiveMetadata = displayMetadata
    ? { ...displayMetadata, layout: { ...displayMetadata.layout, mode: viewMode } }
    : null;
  const viewerPalette = {
    ...DEFAULT_VIEWER_PALETTE,
    ...(effectiveMetadata?.layout?.viewer_palette || {}),
  };
  const viewerNodeColors = effectiveMetadata?.layout?.node_colors || EMPTY_VIEWER_COLORS;
  const viewerNodeBorderColors = effectiveMetadata?.layout?.node_border_colors || EMPTY_VIEWER_COLORS;
  const viewerNodeTextColors = effectiveMetadata?.layout?.node_text_colors || EMPTY_VIEWER_COLORS;
  const layeredNavigationEnabled = Boolean(effectiveMetadata?.viewer?.layered_navigation);
  const previousLayerRoute = effectiveMetadata?.navigation?.previous_layer_route;
  const previousLayerLabel = effectiveMetadata?.navigation?.previous_layer_label || 'Back to previous layer';
  const viewerToolbarButtonSx = {
    ...toolbarButtonSx,
    border: `1px solid ${viewerPalette.border}`,
    backgroundColor: viewerPalette.surface,
    color: viewerPalette.control,
    '&:hover': {
      borderColor: viewerPalette.control,
      backgroundColor: viewerPalette.softSurface,
    },
  };
  const displayQueryRequest = queryResult?.request || queryRequest;
  const activeCypherList = interactionHistory?.present.cypher || displayQueryRequest?.cypher || [];
  const activeDeletedIdList = interactionHistory?.present.deletedIds || EMPTY_DELETED_ID_LIST;
  const activeDeletedIds = useMemo(() => new Set(activeDeletedIdList), [activeDeletedIdList]);
  const visibleGraphExport = useMemo(() => buildVisibleGraphExport(
    displayGraphData || queryResultPage?.combined_query_result,
    activeDeletedIds,
  ), [displayGraphData, queryResultPage?.combined_query_result, activeDeletedIds]);
  const canUndo = developerEnabled ? Boolean(layoutHistory.past.length) : Boolean(interactionHistory?.past.length);
  const canRedo = developerEnabled ? Boolean(layoutHistory.future.length) : Boolean(interactionHistory?.future.length);
  const exportNodeLimit = Number(displayMetadata?.layout?.static_export_limit) || MAX_VISIBLE_NODES;
  const activeLegend = Array.isArray(displayMetadata?.legend) ? displayMetadata.legend : legendSchema;

  const getVisibleNodeIds = () => {
    const ids = new Set((displayGraphData?.nodes || []).map((node) => node['~id']));
    activeDeletedIds.forEach((id) => ids.delete(id));
    return ids;
  };

  const getVisibleEdgeIds = () => {
    const ids = new Set((displayGraphData?.edges || []).map((edge, index) => edge['~id'] || index.toString()));
    activeDeletedIds.forEach((id) => ids.delete(id));
    return ids;
  };

  const pushInteractionHistory = (nextPresent) => {
    setInteractionHistory((current) => {
      if (!current) {
        return current;
      }
      return { past: [...current.past, current.present], present: nextPresent, future: [] };
    });
  };

  const clearHighlightSoon = () => {
    clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedIds(new Set()), HIGHLIGHT_DURATION_MS);
  };

  const closeContextMenu = () => setContextMenu(null);

  const findRawRecord = (kind, id) => (
    kind === 'edge'
      ? (displayGraphData?.edges || []).find((record) => record['~id'] === id)
      : (displayGraphData?.nodes || []).find((record) => record['~id'] === id)
  );

  const openDeveloperRecord = (kind, id) => {
    const record = findRawRecord(kind, id);
    const element = cyRef.current?.getElementById(id);
    if (!record || !element?.nonempty()) return;
    const data = element.data();
    setContextMenu(null);
    setDeveloperSelection({
      kind,
      id,
      type: kind === 'edge' ? record['~type'] : data.type,
      name: data.name || data.label || id,
      record,
      graphLink: data.graph_link,
      preview: getNodePrimaryAction(data) === 'preview' ? data : null,
      derivedData: data,
      source: record?.['~properties']?.source_file || record?.['~properties']?.data_source_url || 'graph.json',
    });
  };

  const developerNavigate = (graphLink) => {
    if (!graphLink || typeof graphLink !== 'string' || !graphLink.startsWith('/')) return;
    const dirty = developerDirtyRef.current;
    if (dirty) {
      setPendingDeveloperNavigation(graphLink);
      return;
    }
    window.location.assign(graphLink);
  };

  const focusSearchNode = (nodeId) => {
    const cy = cyRef.current;
    const node = cy?.getElementById(nodeId);
    if (!node?.nonempty()) {
      setActionMessage({ text: 'This search result is not present in the current graph view.', severity: 'warning' });
      return false;
    }
    const configuredZoom = Number(effectiveMetadata?.layout?.search_focus_zoom) || 0.9;
    const targetZoom = Math.min(maximumZoom, Math.max(cy.zoom(), configuredZoom));
    cy.stop();
    cy.animate({ center: { eles: node }, zoom: targetZoom }, { duration: 360 });
    setHighlightedIds(new Set([nodeId]));
    clearHighlightSoon();
    return true;
  };

  const handleSearchResultOpen = (record, location) => {
    if (!location?.route || !location?.node_id) return;
    setSearchDialogOpen(false);
    const currentViewId = displayMetadata?.view_id || displayMetadata?.authoring?.view_id;
    if (location.view_id === currentViewId && focusSearchNode(location.node_id)) return;
    const parameters = new URLSearchParams();
    parameters.set('focus', location.node_id);
    const target = `${String(location.route).split('?', 1)[0]}?${parameters.toString()}`;
    if (searchConfig?.onOpenResult) {
      searchConfig.onOpenResult({ record, location, target });
      return;
    }
    developerNavigate(target);
  };

  const applyLayoutSnapshot = (snapshot) => {
    const cy = cyRef.current;
    if (!cy) return;
    Object.entries(snapshot).forEach(([id, position]) => {
      const element = cy.getElementById(id);
      if (element?.nonempty()) element.position({ x: position.x * 0.5, y: position.y });
    });
    updateThumbnail();
  };

  const handleSaveLayout = async () => {
    if (!developerMode?.adapter || !layoutDirty) return true;
    try {
      await developerMode.adapter.saveLayout({
        viewId: displayMetadata?.authoring?.view_id || displayMetadata?.view_id,
        positions: changedLayoutPositions,
      });
      setLayoutChanges({});
      setLayoutHistory({ past: [], future: [] });
      setActionMessage({ text: developerMode.adapter.mode === 'export' ? 'Validated layout patch downloaded.' : 'Layout saved.', severity: 'success' });
      return true;
    } catch (error) {
      setActionMessage({ text: error.message || 'Failed to save layout.', severity: 'error' });
      return false;
    }
  };

  const saveAndContinueDeveloperNavigation = async () => {
    if (developerEditorDirty) {
      const saved = await developerDialogRef.current?.save?.();
      if (!saved) return;
    }
    if (layoutDirty && !(await handleSaveLayout())) return;
    const destination = pendingDeveloperNavigation;
    setPendingDeveloperNavigation(null);
    if (destination) window.location.assign(destination);
  };

  useEffect(() => {
    if (queryResult?.metadata?.layout?.mode) {
      setViewMode(queryResult.metadata.layout.mode);
    }
    setLayoutEngine(queryResult?.metadata?.layout?.engine || queryResult?.request?.layout_engine || 'legacy');
  }, [queryResult]);

  // Two things can require a graph fetch: (1) a brand-new base query list arriving
  // (first load, or a fresh manual query from the debug dialog), which resets the
  // whole interaction history; or (2) the active (cypher list, mode) pair changing
  // because explore/find-connection appended a query, undo/redo moved through
  // history, or the user switched modes. These are handled in one effect so the
  // second case can never run against a stale cypher list from before the first
  // case's state has propagated. Deleting an element never changes this key, so it
  // never triggers a refetch - the delete list is applied purely as a client-side
  // filter at render time.
  useEffect(() => {
    const baseCypher = queryResult?.request?.cypher || queryRequest?.cypher;
    const isNewBase = Boolean(baseCypher) && baseCypher !== baseCypherRef.current;

    if (isNewBase) {
      baseCypherRef.current = baseCypher;

      const baselineMode = queryResult?.metadata?.layout?.mode
        || metadata?.layout?.mode
        || queryResult?.request?.layout_mode
        || queryRequest?.layout_mode
        || 'kg_only';
      const baselineEngine = queryResult?.metadata?.layout?.engine
        || queryResult?.request?.layout_engine
        || queryRequest?.layout_engine
        || 'legacy';
      const staticGraphData = queryResult?.graphData ?? graphData;
      const hasStaticGraph = Boolean(staticGraphData?.nodes);

      setInteractionHistory({ past: [], present: { cypher: baseCypher, deletedIds: [] }, future: [] });
      setActionMessage(null);
      setContextMenu(null);
      setHighlightedIds(new Set());

      if (hasStaticGraph) {
        // Caller supplied a ready-made graph (e.g. a debug-dialog result). Use it
        // directly and mark it fetched so the fetch branch below stays idle.
        const baseline = {
          graphData: staticGraphData,
          coordData: queryResult?.coordData ?? coordData,
          edgeRoutes: queryResult?.edgeRoutes ?? edgeRoutes,
          metadata: queryResult?.metadata ?? metadata,
          request: queryResult?.request ?? { ...(queryRequest || {}), cypher: baseCypher },
        };
        const key = buildGraphRequestKey(baseCypher, baselineMode, baselineEngine);
        graphCacheRef.current.set(key, baseline);
        lastFetchedKeyRef.current = key;
        setInteractionGraph(baseline);
      } else {
        // Only a query list was supplied (e.g. the sample page). Clear the fetched
        // marker so the re-render triggered by these state updates falls through to
        // the fetch branch and actually loads the base graph from the API.
        lastFetchedKeyRef.current = null;
        setInteractionGraph(null);
      }

      if (viewMode !== baselineMode) {
        setViewMode(baselineMode);
      }
      if (layoutEngine !== baselineEngine) {
        setLayoutEngine(baselineEngine);
      }
      return undefined;
    }

    const cypherList = interactionHistory?.present.cypher;
    if (!cypherList) {
      return undefined;
    }

    const key = buildGraphRequestKey(cypherList, viewMode, layoutEngine);
    if (key === lastFetchedKeyRef.current) {
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    interactionAbortRef.current?.abort();
    interactionAbortRef.current = controller;
    (async () => {
      setInteractionLoading(true);
      try {
        let result = graphCacheRef.current.get(key);
        if (!result) {
          const previousLayout = buildPreviousLayout(displayCoordData, displayEdgeRoutes, displayMetadata);
          result = await requestGraphViewer({
            ...(displayQueryRequest || {}),
            cypher: cypherList,
            layout_mode: viewMode,
            layout_engine: layoutEngine,
            ...(previousLayout ? { previous_layout: previousLayout } : {}),
          }, { signal: controller.signal });
          graphCacheRef.current.set(key, result);
        }
        if (!cancelled) {
          lastFetchedKeyRef.current = key;
          setInteractionGraph(result);
        }
      } catch (error) {
        if (!cancelled) {
          setActionMessage({ text: error.message || 'Failed to load graph.', severity: 'error' });
        }
      } finally {
        if (!cancelled) {
          setInteractionLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (interactionAbortRef.current === controller) {
        interactionAbortRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryResult, queryRequest, interactionHistory?.present.cypher, viewMode, layoutEngine]);

  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);

  useLayoutEffect(() => {
    const recomputeToolbarFit = () => {
      const rowEl = toolbarRowRef.current;
      const titleEl = toolbarTitleRef.current;
      const zoomGroupEl = toolbarZoomGroupMeasureRef.current;
      const secondaryGroupEl = toolbarSecondaryGroupRef.current;
      if (!rowEl || !titleEl || !zoomGroupEl || !secondaryGroupEl) {
        return;
      }

      const rowGap = 16;
      const zoomGroupDividerWidth = 1;
      const safetyMargin = 8;
      const neededWidth = titleEl.offsetWidth
        + rowGap
        + zoomGroupEl.offsetWidth
        + rowGap
        + zoomGroupDividerWidth
        + rowGap
        + secondaryGroupEl.offsetWidth
        + safetyMargin;

      setShowZoomToolbarGroup(neededWidth <= rowEl.clientWidth);
    };

    recomputeToolbarFit();

    const observer = new ResizeObserver(recomputeToolbarFit);
    [toolbarRowRef, toolbarTitleRef, toolbarZoomGroupMeasureRef, toolbarSecondaryGroupRef].forEach((ref) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });
    window.addEventListener('resize', recomputeToolbarFit);
    document.fonts?.ready?.then(recomputeToolbarFit);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recomputeToolbarFit);
    };
  }, []);

  const center = cyRef.current
    ? { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 }
    : { x: 0, y: 0 };

  const genomeRegion = ['genome_track', 'genome_mode'].includes(viewMode)
    ? effectiveMetadata?.layout?.genome_region
    : null;
  const cellRegions = viewMode === 'cell_type_mode'
    ? effectiveMetadata?.layout?.cell_regions
    : EMPTY_GRAPH_REGIONS;
  const mechanismRegions = viewMode === 'cell_type_mode'
    ? effectiveMetadata?.layout?.mechanism_regions
    : EMPTY_GRAPH_REGIONS;
  const canvasImage = effectiveMetadata?.layout?.background_image || null;
  const minimumZoom = Number(effectiveMetadata?.layout?.min_zoom) || 0.6;
  const maximumZoom = Number(effectiveMetadata?.layout?.max_zoom) || 4;
  const edgeLabelZoomThreshold = Number(effectiveMetadata?.layout?.edge_label_zoom_threshold) || null;

  const trackOverlay = (() => {
    if (!genomeRegion || !viewportState.width || !viewportState.height) {
      return null;
    }

    const { zoom, panY } = viewportState;
    const lanes = getGenomeLaneModelYs(
      genomeRegion,
      effectiveMetadata?.layout?.genome_tracks,
    );
    const laneLabels = lanes.map((lane) => ({
      key: lane.key,
      name: lane.name,
      centerY: scaleYPosition(lane.modelY) * zoom + panY,
    }));

    return {
      laneLabels,
    };
  })();

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom({ level: Math.min(maximumZoom, cyRef.current.zoom() * 1.2), renderedPosition: center });
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom({ level: Math.max(minimumZoom, cyRef.current.zoom() / 1.2), renderedPosition: center });
    }
  };

  const handleRecenter = () => {
    if (cyRef.current) {
      if (effectiveMetadata?.layout?.initial_view === 'fit') {
        cyRef.current.fit(cyRef.current.elements(), 48);
      } else {
        cyRef.current.zoom(initZoom);
        cyRef.current.center();
      }
    }
  };

  const handleFocusRegion = (region) => {
    setFocusMenuOpen(false);
    setActiveFocusLabel(region?.label || 'Overview');
    if (!cyRef.current) {
      return;
    }
    if (!region) {
      cyRef.current.fit(cyRef.current.elements(), 48);
      return;
    }
    const background = cyRef.current.getElementById(`__mechanism_background__:${region.id}`);
    if (background?.nonempty()) {
      cyRef.current.fit(background, 72);
      const focusZoom = Number(effectiveMetadata?.layout?.module_focus_zoom) || 0.24;
      if (cyRef.current.zoom() < focusZoom) {
        cyRef.current.zoom(Math.min(maximumZoom, focusZoom));
        cyRef.current.center(background);
      }
    }
  };

  const handleModeChange = (nextMode) => {
    setModeMenuOpen(false);
    if (nextMode === viewMode) {
      return;
    }
    if (!activeCypherList.length) {
      setActionMessage({ text: 'Run a graph query before switching layout mode.', severity: 'error' });
      return;
    }
    setViewMode(nextMode);
  };

  const handleExploreNeighbors = async (nodeId) => {
    closeContextMenu();
    if (isOverflowId(nodeId)) {
      setActionMessage({ text: 'Overflow nodes cannot be explored directly.', severity: 'info' });
      return;
    }
    if (!activeCypherList.length) {
      setActionMessage({ text: 'Run a graph query before exploring neighbors.', severity: 'error' });
      return;
    }

    const visibleNodeIds = getVisibleNodeIds();

    interactionAbortRef.current?.abort();
    const controller = new AbortController();
    interactionAbortRef.current = controller;
    setInteractionLoading(true);
    try {
      const nextCypher = mergeExploreNeighborsCypher(activeCypherList, nodeId);
      const key = buildGraphRequestKey(nextCypher, viewMode, layoutEngine);
      let result = graphCacheRef.current.get(key);
      if (!result) {
        const previousLayout = buildPreviousLayout(displayCoordData, displayEdgeRoutes, displayMetadata);
        result = await requestGraphViewer({
          ...(displayQueryRequest || {}),
          cypher: nextCypher,
          layout_mode: viewMode,
          layout_engine: layoutEngine,
          ...(previousLayout ? { previous_layout: previousLayout } : {}),
        }, { signal: controller.signal });
        graphCacheRef.current.set(key, result);
      }

      const candidateNodeIds = Array.from(new Set((result.graphData?.nodes || []).map((node) => node['~id'])));
      const restoredDeletedIds = restoreAdjacentDeletedIds(result.graphData, nodeId, activeDeletedIds, true);
      const existingNodeIds = new Set((displayGraphData?.nodes || []).map((node) => node['~id']));
      const newNodeIds = candidateNodeIds.filter((id) => !existingNodeIds.has(id));
      const remainingBudget = Math.max(0, MAX_VISIBLE_NODES - visibleNodeIds.size);
      const acceptedIds = newNodeIds.slice(0, remainingBudget);
      const overflowIds = newNodeIds.slice(remainingBudget);

      const nextDeletedIds = restoredDeletedIds;
      overflowIds.forEach((id) => nextDeletedIds.add(id));

      lastFetchedKeyRef.current = key;
      setInteractionGraph(result);
      pushInteractionHistory({ cypher: nextCypher, deletedIds: Array.from(nextDeletedIds) });
      setHighlightedIds(new Set(acceptedIds));
      clearHighlightSoon();

      if (newNodeIds.length === 0) {
        setActionMessage({ text: 'All available neighbors are already shown.', severity: 'info' });
      } else if (overflowIds.length > 0) {
        setActionMessage({ text: `Added ${acceptedIds.length} neighbors. ${overflowIds.length} not shown because the canvas limit is ${MAX_VISIBLE_NODES} nodes.`, severity: 'info' });
      } else {
        setActionMessage({ text: `Added ${acceptedIds.length} neighbor${acceptedIds.length === 1 ? '' : 's'}.`, severity: 'success' });
      }
    } catch (error) {
      if (interactionAbortRef.current === controller) {
        setActionMessage({ text: error.message || 'Failed to explore neighbors.', severity: 'error' });
      }
    } finally {
      if (interactionAbortRef.current === controller) {
        interactionAbortRef.current = null;
        setInteractionLoading(false);
      }
    }
  };

  const handleFindConnection = async (nodeId) => {
    closeContextMenu();
    if (isOverflowId(nodeId)) {
      setActionMessage({ text: 'Overflow nodes cannot be used for connection searches.', severity: 'info' });
      return;
    }
    if (!activeCypherList.length) {
      setActionMessage({ text: 'Run a graph query before finding connections.', severity: 'error' });
      return;
    }

    const visibleNodeIds = getVisibleNodeIds();
    const visibleEdgeIds = getVisibleEdgeIds();

    interactionAbortRef.current?.abort();
    const controller = new AbortController();
    interactionAbortRef.current = controller;
    setInteractionLoading(true);
    try {
      const nextCypher = [...activeCypherList, buildFindConnectionCypher(nodeId, Array.from(visibleNodeIds))];
      const key = buildGraphRequestKey(nextCypher, viewMode, layoutEngine);
      let result = graphCacheRef.current.get(key);
      if (!result) {
        const previousLayout = buildPreviousLayout(displayCoordData, displayEdgeRoutes, displayMetadata);
        result = await requestGraphViewer({
          ...(displayQueryRequest || {}),
          cypher: nextCypher,
          layout_mode: viewMode,
          layout_engine: layoutEngine,
          ...(previousLayout ? { previous_layout: previousLayout } : {}),
        }, { signal: controller.signal });
        graphCacheRef.current.set(key, result);
      }

      const candidateEdgeIds = (result.graphData?.edges || []).map((edge, index) => edge['~id'] || index.toString());
      const newEdgeIds = candidateEdgeIds.filter((id) => !visibleEdgeIds.has(id));
      const nextDeletedIds = restoreAdjacentDeletedIds(result.graphData, nodeId, activeDeletedIds);

      lastFetchedKeyRef.current = key;
      setInteractionGraph(result);
      pushInteractionHistory({ cypher: nextCypher, deletedIds: Array.from(nextDeletedIds) });
      setHighlightedIds(new Set(newEdgeIds));
      clearHighlightSoon();

      if (newEdgeIds.length === 0) {
        setActionMessage({ text: 'All known connections from this node are already shown.', severity: 'info' });
      } else {
        setActionMessage({ text: `Added ${newEdgeIds.length} connection${newEdgeIds.length === 1 ? '' : 's'}.`, severity: 'success' });
      }
    } catch (error) {
      if (interactionAbortRef.current === controller) {
        setActionMessage({ text: error.message || 'Failed to find connections.', severity: 'error' });
      }
    } finally {
      if (interactionAbortRef.current === controller) {
        interactionAbortRef.current = null;
        setInteractionLoading(false);
      }
    }
  };

  const handleDeleteElement = (elementId) => {
    closeContextMenu();
    const nextDeletedIds = new Set(activeDeletedIds);
    nextDeletedIds.add(elementId);
    pushInteractionHistory({ cypher: activeCypherList, deletedIds: Array.from(nextDeletedIds) });
    setActionMessage({ text: 'Removed from view. Use undo to restore.', severity: 'info' });
  };

  const handleUndo = () => {
    closeContextMenu();
    if (developerEnabled) {
      setLayoutHistory((current) => {
        if (!current.past.length) return current;
        const previous = current.past[current.past.length - 1];
        setLayoutChanges(previous);
        applyLayoutSnapshot(previous);
        return { past: current.past.slice(0, -1), future: [layoutChanges, ...current.future] };
      });
      setActionMessage({ text: 'Undid last layout change.', severity: 'info' });
      return;
    }
    setInteractionHistory((current) => {
      if (!current || current.past.length === 0) {
        return current;
      }
      const previous = current.past[current.past.length - 1];
      return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
    });
    setActionMessage({ text: 'Undid last change.', severity: 'info' });
  };

  const handleRedo = () => {
    closeContextMenu();
    if (developerEnabled) {
      setLayoutHistory((current) => {
        if (!current.future.length) return current;
        const next = current.future[0];
        setLayoutChanges(next);
        applyLayoutSnapshot(next);
        return { past: [...current.past, layoutChanges], future: current.future.slice(1) };
      });
      setActionMessage({ text: 'Redid layout change.', severity: 'info' });
      return;
    }
    setInteractionHistory((current) => {
      if (!current || current.future.length === 0) {
        return current;
      }
      const next = current.future[0];
      return { past: [...current.past, current.present], present: next, future: current.future.slice(1) };
    });
    setActionMessage({ text: 'Redid change.', severity: 'info' });
  };

  const handleResetGraph = () => {
    closeContextMenu();
    if (!baseCypherRef.current) {
      return;
    }
    setInteractionHistory({ past: [], present: { cypher: baseCypherRef.current, deletedIds: [] }, future: [] });
    setActionMessage({ text: 'Graph reset to the original query.', severity: 'info' });
  };

  const closePathwayPreview = () => {
    setPathwayPreview(null);
    setPathwayPreviewLoadError(false);
  };

  const openPathwayPreviewDetail = () => {
    const graphLink = pathwayPreview?.graph_link;
    if (typeof graphLink === 'string' && graphLink.startsWith('/')) {
      window.location.assign(graphLink);
    }
  };

  const handleDownload = () => {
    if (!cyRef.current) {
      return;
    }
    const png = cyRef.current.png(
      exportNodeLimit > MAX_VISIBLE_NODES
        ? { full: true, maxWidth: 8000, maxHeight: 8000, bg: '#FFFFFF' }
        : { full: true, scale: 8 },
    );
    const link = document.createElement('a');
    link.href = png;
    link.download = 'knowledge_graph.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadMenuOpen(false);
  };

  const openJsonPreview = () => {
    if (!visibleGraphExport) return;
    setDownloadMenuOpen(false);
    setJsonPreviewOpen(true);
  };

  const handleDownloadJson = (payload = visibleGraphExport) => {
    if (!payload) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    link.download = 'knowledge_graph.json';
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
    setJsonPreviewOpen(false);
  };

  const handleFullscreen = () => {
    const viewer = containerRef.current?.parentElement?.parentElement;
    if (!viewer) {
      return;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      viewer.requestFullscreen?.();
    }
  };

  const updateThumbnail = () => {
    const cy = cyRef.current;
    if (!cy || !cy.elements().length) {
      return;
    }

    const bounds = cy.elements().boundingBox();
    const extent = cy.extent();
    const width = Math.max(bounds.w, 1);
    const height = Math.max(bounds.h, 1);
    const contentLeft = 0;
    const contentTop = 0;
    const contentWidth = 168;
    const contentHeight = 80;
    const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

    const project = (x, y) => ({
      x: contentLeft + ((x - bounds.x1) / width) * contentWidth,
      y: contentTop + ((y - bounds.y1) / height) * contentHeight,
    });
    const topLeft = project(clamp(extent.x1, bounds.x1, bounds.x2), clamp(extent.y1, bounds.y1, bounds.y2));
    const bottomRight = project(clamp(extent.x2, bounds.x1, bounds.x2), clamp(extent.y2, bounds.y1, bounds.y2));

    // Bound the raster size: full-resolution export of the static mechanism
    // canvas exceeds browser canvas limits and otherwise returns `data:,`.
    setThumbnailImage(cy.png({
      full: true,
      maxWidth: 336,
      maxHeight: 160,
      bg: '#FFFFFF',
    }));
    setThumbnailViewport({
      left: topLeft.x,
      top: topLeft.y,
      width: Math.max(8, bottomRight.x - topLeft.x),
      height: Math.max(8, bottomRight.y - topLeft.y),
    });
  };

  const handleThumbnailClick = (event) => {
    const cy = cyRef.current;
    if (!cy || !thumbnailViewport) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const contentLeft = 0;
    const contentTop = 0;
    const contentWidth = 168;
    const contentHeight = 80;
    const x = Math.max(0, Math.min(contentWidth, event.clientX - rect.left - contentLeft));
    const y = Math.max(0, Math.min(contentHeight, event.clientY - rect.top - contentTop));
    const bounds = cy.elements().boundingBox();
    const modelPosition = {
      x: bounds.x1 + (x / contentWidth) * Math.max(bounds.w, 1),
      y: bounds.y1 + (y / contentHeight) * Math.max(bounds.h, 1),
    };
    cy.animate({
      pan: {
        x: cy.width() / 2 - modelPosition.x * cy.zoom(),
        y: cy.height() / 2 - modelPosition.y * cy.zoom(),
      },
      duration: 180,
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const { top: containerTop, left: containerLeft } = container.getBoundingClientRect();
    const ele = activeNode;

    if (!ele || !cyRef.current || !infocardEnabled) {
      return;
    }

    const modelPos = getSafeElementPosition(ele);
    if (!modelPos) {
      setInfocardVisible(false);
      return;
    }

    const { x: modelX, y: modelY } = modelPos;
    const nodeWidth = ele.isNode?.() ? ele.outerWidth() * cyRef.current.zoom() : 20;
    const nodeHeight = ele.isNode?.() ? ele.outerHeight() * cyRef.current.zoom() : 20;
    const x = modelX * cyRef.current.zoom() + cyRef.current.pan().x;
    const y = modelY * cyRef.current.zoom() + cyRef.current.pan().y;

    const infocard = infocardRef.current;
    if (!infocard) {
      return;
    }

    infocard.style.display = 'block';
    const { width: infocardWidth, height: infocardHeight } = infocard.getBoundingClientRect();

    let top = containerTop + y - infocardHeight - nodeHeight / 2 - 2;
    let left = containerLeft + x + nodeWidth / 2 + 2;

    if (left + infocardWidth > window.innerWidth - 10) {
      left = containerLeft + x - infocardWidth - nodeWidth / 2 - 2;
    }

    if (top < 10) {
      top = containerTop + y + nodeHeight / 2 + 2;
    }

    left = Math.max(10, Math.min(left, window.innerWidth - infocardWidth - 10));
    top = Math.max(10, Math.min(top, window.innerHeight - infocardHeight - 10));

    setInfocardPosition({ x: left, y: top });
  }, [activeNode, hoveredId, nodeHovered, infocardEnabled]);

  useEffect(() => {
    if (!infocardEnabled || contextMenu) {
      clearTimeout(appearTimeoutRef.current);
      clearTimeout(fadeOutTimeoutRef.current);
      setInfocardVisible(false);
      return undefined;
    }

    if (!infocardHovered && !nodeHovered) {
      clearTimeout(appearTimeoutRef.current);
      fadeOutTimeoutRef.current = setTimeout(() => {
        setInfocardVisible(false);
      }, 250);
    } else if (nodeHovered) {
      clearTimeout(fadeOutTimeoutRef.current);
      appearTimeoutRef.current = setTimeout(() => {
        const node = cyRef.current?.getElementById(hoveredIdRef.current);
        setActiveNode(node?.nonempty ? node : null);
        setInfocardVisible(true);
      }, 180);
    }

    return () => {
      clearTimeout(fadeOutTimeoutRef.current);
      clearTimeout(appearTimeoutRef.current);
    };
  }, [hoveredId, infocardEnabled, infocardHovered, nodeHovered, contextMenu]);

  useEffect(() => {
    const result = displayGraphData || queryResultPage?.combined_query_result;
    const positionData = displayCoordData || queryResultPage?.xy_json || {};
    const deletedIds = new Set(interactionHistory?.present.deletedIds || []);

    if (!result?.nodes || !result?.edges || !containerRef.current) {
      return undefined;
    }

    const uniqueNodesMap = {};
    result.nodes.forEach((node) => {
      if (deletedIds.has(node['~id'])) {
        return;
      }
      uniqueNodesMap[node['~id']] = node;
    });

    const graphNodes = Object.values(uniqueNodesMap).map((node) => {
      const fallbackPosData = {
        x: Math.random() * 250 - 125,
        y: Math.random() * 200 - 125,
        Level: 'Core',
      };
      const posData = positionData[node['~id']] || fallbackPosData;
      const renderPosition = getRenderPosition(posData) || getRenderPosition(fallbackPosData);
      const renderWidth = getRenderWidth(posData);
      const renderHeight = getRenderHeight(posData);
      const nodeType = getNodeType(node, viewerNodeColors);
      const previewNodeData = getNodeBodyPreviewData(
        nodeType,
        node['~properties'],
        assetBaseUrl,
        effectiveMetadata?.layout?.pathway_preview_node_body,
      );
      const nodeTextBackplateData = getNodeTextBackplateData(effectiveMetadata?.layout);
      const imageNodeBackgroundData = getImageNodeBackgroundData(
        node['~properties'],
        effectiveMetadata?.layout,
      );
      const imageNodeOpacityData = getImageNodeOpacityData(node['~properties']);

      return {
        data: {
          id: node['~id'],
          ...node['~properties'],
          label: getNodeLabel(node),
          type: nodeType,
          Level: posData.Level || 'Core',
          renderFontSize: Number(effectiveMetadata?.layout?.node_font_size) || 6,
          renderWidth,
          renderHeight,
          labelMaxWidth: getLabelMaxWidth(renderWidth),
          labelWrap: effectiveMetadata?.layout?.node_text_wrap === 'wrap' ? 'wrap' : 'ellipsis',
          ...nodeTextBackplateData,
          ...imageNodeBackgroundData,
          ...imageNodeOpacityData,
          ...previewNodeData,
        },
        position: renderPosition,
      };
    });

    const nodes = (() => {
      const backgroundNode = buildTrackBackgroundNode(genomeRegion);
      const canvasImageNode = buildCanvasImageNode(canvasImage);
      const cellBackgroundNodes = buildCellBackgroundNodes(cellRegions);
      const titleStyle = effectiveMetadata?.layout?.mechanism_region_title_style || {};
      const mechanismBackgroundNodes = buildMechanismBackgroundNodes(mechanismRegions, titleStyle.mode);
      const mechanismTitleNodes = buildMechanismTitleNodes(mechanismRegions, titleStyle);
      return [
        ...(canvasImageNode ? [canvasImageNode] : []),
        ...mechanismBackgroundNodes,
        ...mechanismTitleNodes,
        ...(backgroundNode ? [backgroundNode] : []),
        ...cellBackgroundNodes,
        ...graphNodes,
      ];
    })();

    const nodeNameMap = graphNodes.reduce((acc, node) => {
      acc[node.data.id] = node.data.label;
      return acc;
    }, {});
    const nodePositionMap = graphNodes.reduce((acc, node) => {
      acc[node.data.id] = node.position;
      return acc;
    }, {});

    const uniqueEdgesMap = {};
    result.edges.forEach((edge, index) => {
      const edgeId = edge['~id'] || index.toString();
      if (deletedIds.has(edgeId) || deletedIds.has(edge['~start']) || deletedIds.has(edge['~end'])) {
        return;
      }
      uniqueEdgesMap[edgeId] = edge;
    });

    const edgeTextBackplateData = getEdgeTextBackplateData(effectiveMetadata?.layout);
    const edges = Object.values(uniqueEdgesMap).map((edge) => {
      const edgeId = edge['~id'];
      const source = edgeIsInverted[edge['~type']] ? edge['~end'] : edge['~start'];
      const target = edgeIsInverted[edge['~type']] ? edge['~start'] : edge['~end'];
      const routeData = edgeRouteToCytoscapeData(
        displayEdgeRoutes?.[edgeId],
        nodePositionMap[source],
        nodePositionMap[target],
      );
      const label = edgeLabels[edge['~type']] || edge['~type'].replace(/_/g, ' ');
      const labelData = edgeLabelToCytoscapeData(
        displayEdgeRoutes?.[edgeId],
        nodePositionMap[source],
        nodePositionMap[target],
        label,
      );
      return {
        data: {
          id: edgeId,
          source,
        source_name: nodeNameMap[edge['~start']],
          target,
        target_name: nodeNameMap[edge['~end']],
          type: edge['~type'],
          label,
          renderFontSize: Number(effectiveMetadata?.layout?.edge_font_size) || 4,
          renderEdgeWidth: Number(effectiveMetadata?.layout?.edge_width) || 1,
          renderEdgeOpacity: Number(effectiveMetadata?.layout?.edge_opacity) || 1,
          renderEdgeColor: effectiveMetadata?.layout?.edge_color || '#D3D3D3',
          renderArrowScale: Number(effectiveMetadata?.layout?.edge_arrow_scale) || 0.4,
          renderTargetArrowShape: 'triangle',
          baseLabel: labelData.displayLabel,
          displayLabel: edgeLabelZoomThreshold ? '' : labelData.displayLabel,
          labelMarginX: labelData.labelMarginX,
          labelMarginY: labelData.labelMarginY,
          routeCurveStyle: routeData?.routeCurveStyle || (viewMode === 'kg_only' ? 'straight' : 'unbundled-bezier'),
          ...(['segments', 'round-segments'].includes(routeData?.routeCurveStyle) ? {
            segmentDistances: routeData.segmentDistances,
            segmentWeights: routeData.segmentWeights,
            ...(routeData.segmentRadii ? { segmentRadii: routeData.segmentRadii } : {}),
          } : {
            curveDistance: routeData?.curveDistance || String(getEdgeCurveDistance(edgeId)),
            curveWeight: routeData?.curveWeight || '0.5',
          }),
          ...edge['~properties'],
          ...edgeTextBackplateData,
          renderLineStyle: normalizeEdgeLineStyle(edge['~properties']?.renderLineStyle),
        },
      };
    });

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: { nodes, edges },
      style: nodeStyle.concat([
        {
          selector: 'node[renderWidth]',
          style: {
            width: 'data(renderWidth)',
          },
        },
        {
          selector: 'node[renderFontSize]',
          style: {
            'font-size': 'data(renderFontSize)',
          },
        },
        {
          selector: 'node[type = "Anatomy"]',
          style: {
            'background-color': '#FFFFFF',
            'background-opacity': 1,
            'border-color': '#64748B',
            'border-width': 2,
            color: '#0F172A',
          },
        },
        ...buildViewNodeStyles(viewerNodeColors, viewerNodeBorderColors, viewerNodeTextColors),
        {
          selector: 'node[image_url]',
          style: {
            shape: 'data(image_shape)',
            'background-image': 'data(image_url)',
            'background-fit': 'data(image_fit)',
            ...getRasterImageOpacityStyle('data(imageNodeImageOpacity)'),
            'background-color': 'data(imageNodeBackgroundColor)',
            'border-color': 'data(image_border_color)',
            'border-width': 'data(image_border_width)',
            'text-valign': 'bottom',
            'text-margin-y': '10px',
            'text-background-color': 'data(nodeTextBackgroundColor)',
            'text-background-opacity': 'data(nodeTextBackgroundOpacity)',
            'text-background-padding': '5px',
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          selector: 'node[previewNodeImageUrl]',
          style: {
            shape: 'round-rectangle',
            'background-image': 'data(previewNodeImageUrl)',
            'background-fit': 'data(previewNodeImageFit)',
            'background-image-crossorigin': 'anonymous',
            ...getRasterImageOpacityStyle(1),
            'background-color': 'data(previewNodeImageBackground)',
            'border-color': 'data(previewNodeImageBorderColor)',
            'border-width': 'data(previewNodeImageBorderWidth)',
            'text-valign': 'bottom',
            'text-margin-y': '10px',
            'text-background-color': 'data(nodeTextBackgroundColor)',
            'text-background-opacity': 'data(nodeTextBackgroundOpacity)',
            'text-background-padding': '5px',
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          selector: 'node[renderHeight]',
          style: {
            height: 'data(renderHeight)',
          },
        },
        {
          selector: 'node[labelMaxWidth][trackBackground != "true"][cellBackground != "true"][mechanismBackground != "true"]',
          style: {
            'text-wrap': 'data(labelWrap)',
            'text-max-width': 'data(labelMaxWidth)',
          },
        },
        {
          selector: 'node[trackBackground = "true"]',
          style: {
            shape: 'round-rectangle',
            label: '',
            'background-color': '#E2ECF5',
            'background-opacity': 0.95,
            'border-width': 1,
            'border-color': '#A7BED0',
            'z-index-compare': 'manual',
            'z-index': 0,
            'events': 'no',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[canvasImage = "true"]',
          style: {
            shape: 'rectangle',
            label: '',
            'background-image': 'data(canvasImageUrl)',
            'background-fit': 'data(canvasImageFit)',
            ...getRasterImageOpacityStyle('data(canvasImageOpacity)'),
            'background-color': 'data(canvasImageBackground)',
            'border-width': 0,
            'z-index-compare': 'manual',
            'z-index': -2,
            events: 'no',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[cellBackground = "true"]',
          style: {
            shape: 'ellipse',
            label: 'data(label)',
            'background-color': 'data(cellFill)',
            'background-opacity': 0.28,
            'border-width': 5,
            'border-color': 'data(cellBorder)',
            color: 'data(cellBorder)',
            'font-size': 'data(cellTitleFontSize)',
            'font-weight': 700,
            'text-valign': 'top',
            'text-margin-y': '-12px',
            'z-index-compare': 'manual',
            'z-index': 0,
            'events': 'no',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[mechanismBackground = "true"]',
          style: {
            shape: 'round-rectangle',
            label: 'data(label)',
            'background-color': 'data(mechanismFill)',
            'background-opacity': 0.38,
            'border-width': 3,
            'border-style': 'dashed',
            'border-color': 'data(mechanismBorder)',
            color: 'data(mechanismTitleColor)',
            'font-size': 'data(mechanismTitleFontSize)',
            'font-weight': 700,
            'text-wrap': 'wrap',
            'text-max-width': 'data(mechanismTitleMaxWidth)',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-x': '0px',
            'text-margin-y': 'data(mechanismTitleMarginY)',
            'text-background-color': 'data(mechanismTitleBackground)',
            'text-background-opacity': 'data(mechanismTitleBackgroundOpacity)',
            'text-background-padding': '10px',
            'text-background-shape': 'roundrectangle',
            'z-index-compare': 'manual',
            'z-index': -1,
            'events': 'no',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[mechanismTitle = "true"]',
          style: {
            shape: 'data(mechanismTitleShape)',
            label: 'data(label)',
            'background-color': 'data(mechanismTitleFill)',
            'background-opacity': 1,
            'border-width': 3,
            'border-color': 'data(mechanismTitleBorder)',
            color: 'data(mechanismTitleColor)',
            'font-size': 'data(mechanismTitleFontSize)',
            'font-weight': 800,
            'text-wrap': 'wrap',
            'text-valign': 'center',
            'text-halign': 'left',
            'text-margin-x': '-12px',
            'z-index-compare': 'manual',
            'z-index': 20,
            events: 'no',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[mechanismTitleMode = "region_tab_v1"]',
          style: {
            'border-width': 4,
            'text-halign': 'center',
            'text-margin-x': '0px',
            'text-max-width': 'data(mechanismTitleTextMaxWidth)',
            'text-wrap': 'wrap',
          },
        },
        {
          selector: 'node[mechanismTitleVariant = "compact-tag"]',
          style: {
            shape: 'polygon',
            'shape-polygon-points': '-1 -1 0.76 -1 1 0 0.76 1 -1 1',
          },
        },
        {
          selector: 'node[trackBackground != "true"][cellBackground != "true"][mechanismBackground != "true"][mechanismTitle != "true"][canvasImage != "true"]',
          style: {
            'z-index-compare': 'manual',
            'z-index': 10,
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'data(routeCurveStyle)',
            label: 'data(displayLabel)',
            'text-background-color': 'data(edgeTextBackgroundColor)',
            'text-background-opacity': 'data(edgeTextBackgroundOpacity)',
            'text-background-padding': '3px',
            'text-margin-x': 'data(labelMarginX)',
            'text-margin-y': 'data(labelMarginY)',
            'text-wrap': 'ellipsis',
            'text-max-width': '150px',
            'z-index-compare': 'manual',
            'z-index': 5,
          },
        },
        {
          selector: 'edge[renderFontSize]',
          style: {
            'font-size': 'data(renderFontSize)',
          },
        },
        {
          selector: 'edge[renderEdgeWidth]',
          style: {
            width: 'data(renderEdgeWidth)',
            opacity: 'data(renderEdgeOpacity)',
            'line-color': 'data(renderEdgeColor)',
            'line-style': 'data(renderLineStyle)',
            'target-arrow-color': 'data(renderEdgeColor)',
            'target-arrow-shape': 'data(renderTargetArrowShape)',
            'arrow-scale': 'data(renderArrowScale)',
          },
        },
        {
          selector: 'edge[routeCurveStyle = "unbundled-bezier"]',
          style: {
            'control-point-distances': 'data(curveDistance)',
            'control-point-weights': 'data(curveWeight)',
          },
        },
        {
          selector: 'edge[routeCurveStyle = "segments"]',
          style: {
            'segment-distances': 'data(segmentDistances)',
            'segment-weights': 'data(segmentWeights)',
          },
        },
        {
          selector: 'edge[routeCurveStyle = "round-segments"]',
          style: {
            'segment-distances': 'data(segmentDistances)',
            'segment-weights': 'data(segmentWeights)',
            'segment-radii': 'data(segmentRadii)',
            'radius-type': 'arc-radius',
          },
        },
        {
          selector: 'node.kg-highlight-new',
          style: {
            'border-width': 3,
            'border-color': '#F59E0B',
          },
        },
        {
          selector: 'edge.kg-highlight-new',
          style: {
            'line-color': '#F59E0B',
            'target-arrow-color': '#F59E0B',
            width: 3,
          },
        },
      ]),
      layout: { name: 'preset' },
      zoom: 1.5,
      minZoom: minimumZoom,
      maxZoom: maximumZoom,
      pan: { x: 0, y: 0 },
    });

    const cy = cyRef.current;

    const syncViewportState = () => {
      if (!cyRef.current) {
        return;
      }

      setViewportState({
        zoom: cyRef.current.zoom(),
        panX: cyRef.current.pan().x,
        panY: cyRef.current.pan().y,
        width: cyRef.current.width(),
        height: cyRef.current.height(),
      });
      updateThumbnail();
    };

    const handleHover = (evt) => {
      document.body.style.cursor = 'pointer';
      setNodeHovered(true);
      setHoveredId(evt.target.id());
      if (evt.target.isEdge?.() && edgeLabelZoomThreshold) {
        evt.target.addClass('kg-edge-hover');
        evt.target.data('displayLabel', evt.target.data('baseLabel'));
      }
    };

    const handleOut = (evt) => {
      if (evt.target.id() === hoveredIdRef.current) {
        document.body.style.cursor = 'default';
        setNodeHovered(false);
      }
      if (evt.target.isEdge?.() && edgeLabelZoomThreshold) {
        evt.target.removeClass('kg-edge-hover');
        evt.target.data(
          'displayLabel',
          cy.zoom() >= edgeLabelZoomThreshold ? evt.target.data('baseLabel') : '',
        );
      }
    };

    const handleLeave = () => {
      document.body.style.cursor = 'default';
      setNodeHovered(false);
    };

    const handleEdge = (handler) => (evt) => {
      const ele = evt?.target;
      if (!ele) {
        return;
      }

      const midpoint = getSafeEdgeMidpoint(ele);
      const mouseRendered = cy.renderer()?.projectIntoViewport?.(evt.originalEvent.clientX, evt.originalEvent.clientY);
      if (!midpoint || !mouseRendered || mouseRendered.length < 2) {
        return;
      }

      const dist = Math.sqrt(
        Math.pow(midpoint.x - mouseRendered[0], 2) +
        Math.pow(midpoint.y - mouseRendered[1], 2)
      );

      if (dist < 20) {
        handler(evt);
      }
    };

    const handleNodeTap = (evt) => {
      const node = evt.target;
      if (
        node.data('trackBackground') === 'true'
        || node.data('cellBackground') === 'true'
        || node.data('mechanismBackground') === 'true'
      ) {
        return;
      }
      if (developerEnabled || reviewEnabled) {
        if (clickMenuEnabledRef.current) {
          setContextMenu({ type: 'node', id: node.id(), x: evt.renderedPosition.x, y: evt.renderedPosition.y });
        } else if (node.data('graph_link')) {
          developerNavigate(node.data('graph_link'));
        }
        return;
      }
      const nodeAction = getNodePrimaryAction(node.data());
      if (nodeAction === 'preview') {
        setContextMenu(null);
        setPathwayPreviewLoadError(false);
        setPathwayPreview(node.data());
        return;
      }
      if (nodeAction === 'navigate' && openLinkedGraph(node)) {
        return;
      }
      if (!clickMenuEnabledRef.current) {
        return;
      }
      setContextMenu({ type: 'node', id: node.id(), x: evt.renderedPosition.x, y: evt.renderedPosition.y });
    };

    const handleEdgeTap = (evt) => {
      if (developerEnabled || reviewEnabled) {
        if (clickMenuEnabledRef.current) {
          const edge = evt.target;
          setContextMenu({ type: 'edge', id: edge.id(), x: evt.renderedPosition.x, y: evt.renderedPosition.y });
        }
        return;
      }
      if (!clickMenuEnabledRef.current) {
        return;
      }
      const edge = evt.target;
      setContextMenu({ type: 'edge', id: edge.id(), x: evt.renderedPosition.x, y: evt.renderedPosition.y });
    };

    const handleBackgroundTap = (evt) => {
      if (evt.target === cy) {
        setContextMenu(null);
      }
    };

    const handleDeveloperDrag = (evt) => {
      if (!developerEnabled) return;
      const node = evt.target;
      if (!node?.isNode?.() || node.data('trackBackground') === 'true'
        || node.data('cellBackground') === 'true'
        || node.data('mechanismBackground') === 'true'
        || node.data('canvasImage') === 'true') return;
      const originalPosition = displayCoordData?.[node.id()] || {};
      const nextPosition = inverseLayoutPosition(node.position(), originalPosition);
      setLayoutChanges((current) => {
        const previous = current[node.id()] ? current : { ...current, [node.id()]: originalPosition };
        setLayoutHistory((history) => ({ past: [...history.past, previous], future: [] }));
        return { ...current, [node.id()]: nextPosition };
      });
      setActionMessage({ text: 'Layout changed. Use Save Layout to persist it.', severity: 'info' });
    };

    if (effectiveMetadata?.layout?.initial_view === 'fit') {
      cy.fit(cy.elements(), 48);
    } else {
      cy.reset();
      cy.center();
    }
    setZoomLevel(cy.zoom());
    setInitZoom(cy.zoom());
    const initialFocusNodeId = effectiveMetadata?.layout?.initial_focus_node_id;
    if (typeof initialFocusNodeId === 'string' && cy.getElementById(initialFocusNodeId)?.nonempty()) {
      const focusNode = cy.getElementById(initialFocusNodeId);
      const configuredZoom = Number(effectiveMetadata?.layout?.search_focus_zoom) || 0.9;
      const targetZoom = Math.min(maximumZoom, Math.max(cy.zoom(), configuredZoom));
      cy.stop();
      cy.animate({ center: { eles: focusNode }, zoom: targetZoom }, { duration: 360 });
      setHighlightedIds(new Set([initialFocusNodeId]));
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(
        () => setHighlightedIds(new Set()),
        HIGHLIGHT_DURATION_MS,
      );
    }
    syncViewportState();
    if (reviewEnabled && reviewMode?.allowNodeDragging !== true) {
      cy.nodes().ungrabify();
    }

    cy.container().addEventListener('mouseleave', handleLeave);
    cy.on('mousemove', 'node', handleHover);
    cy.on('mouseout', 'node', handleOut);
    cy.on('mousemove', 'edge', handleEdge(handleHover));
    cy.on('mouseout', 'edge', handleOut);
    cy.on('tap', 'node', handleNodeTap);
    cy.on('tap', 'edge', handleEdge(handleEdgeTap));
    cy.on('tap', handleBackgroundTap);
    cy.on('dragfree', 'node', handleDeveloperDrag);
    cy.on('pan', () => {
      syncViewportState();
      setContextMenu(null);
    });
    cy.on('zoom', () => {
      setContextMenu(null);
      setZoomLevel(cy.zoom());
      if (edgeLabelZoomThreshold) {
        const showLabels = cy.zoom() >= edgeLabelZoomThreshold;
        cy.edges().forEach((edge) => {
          if (!edge.hasClass('kg-edge-hover')) {
            edge.data('displayLabel', showLabels ? edge.data('baseLabel') : '');
          }
        });
      }
      syncViewportState();
    });
    cy.on('resize', () => {
      syncViewportState();
      setContextMenu(null);
    });
    updateThumbnail();

    return () => {
      document.body.style.cursor = 'default';
      cy.removeAllListeners();
      cy.container()?.removeEventListener('mouseleave', handleLeave);
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayCoordData, displayEdgeRoutes, genomeRegion, cellRegions, mechanismRegions, canvasImage, viewerNodeColors, viewerNodeTextColors, displayGraphData, queryResultPage, interactionHistory?.present.deletedIds, assetBaseUrl, effectiveMetadata?.layout?.pathway_preview_node_body, effectiveMetadata?.layout?.node_text_background_color, effectiveMetadata?.layout?.node_text_background_opacity, effectiveMetadata?.layout?.edge_text_background_color, effectiveMetadata?.layout?.edge_text_background_opacity, effectiveMetadata?.layout?.image_background_color, effectiveMetadata?.layout?.initial_focus_node_id, developerEnabled]);

  useEffect(() => {
    if (!exactPreviewCapture) {
      return undefined;
    }
    const cy = cyRef.current;
    if (!cy) {
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    const captureKey = String(
      effectiveMetadata?.authoring?.view_id
      || effectiveMetadata?.layout?.demo?.view_id
      || effectiveMetadata?.view_id
      || window.location.pathname,
    );
    window.__GKB_GRAPH_CAPTURE__ = {
      status: 'waiting',
      representation: 'exact_linked_view',
      capture_key: captureKey,
    };
    document.documentElement.dataset.graphViewerCaptureStatus = 'waiting';

    const wait = (milliseconds) => new Promise((resolve) => {
      timer = window.setTimeout(resolve, milliseconds);
    });
    const nextFrames = () => new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    });
    const preloadGraphImages = async () => {
      const urls = new Set();
      cy.nodes().forEach((node) => {
        ['image_url', 'previewNodeImageUrl', 'canvasImageUrl'].forEach((key) => {
          const url = node.data(key);
          if (typeof url === 'string' && url.trim()) urls.add(url.trim());
        });
      });
      await Promise.all(Array.from(urls).map((url) => new Promise((resolve) => {
        const image = new Image();
        const done = () => resolve();
        image.crossOrigin = 'anonymous';
        image.onload = done;
        image.onerror = done;
        image.src = url;
        window.setTimeout(done, 5000);
      })));
    };

    const run = async () => {
      try {
        await (document.fonts?.ready || Promise.resolve());
        await preloadGraphImages();
        await wait(300);
        let previous = '';
        let matchingCaptures = 0;
        for (let attempt = 1; attempt <= 20 && !cancelled; attempt += 1) {
          await nextFrames();
          if (cancelled || cy.destroyed?.()) return;
          const candidate = createExactGraphCapture(cy, {
            background: viewerPalette.canvas,
          });
          matchingCaptures = candidate.png_data_url === previous
            ? matchingCaptures + 1
            : 0;
          previous = candidate.png_data_url;
          if (matchingCaptures >= 1) {
            window.__GKB_GRAPH_CAPTURE__ = {
              ...candidate,
              status: 'ready',
              capture_key: captureKey,
              stabilization_attempts: attempt,
            };
            document.documentElement.dataset.graphViewerCaptureStatus = 'ready';
            window.dispatchEvent(new CustomEvent('gkb-graph-capture-ready', {
              detail: { capture_key: captureKey },
            }));
            return;
          }
          await wait(150);
        }
        if (!cancelled) throw new Error('The graph image did not stabilize before the capture deadline.');
      } catch (error) {
        if (!cancelled) {
          window.__GKB_GRAPH_CAPTURE__ = {
            status: 'error',
            representation: 'exact_linked_view',
            capture_key: captureKey,
            error: error?.message || String(error),
          };
          document.documentElement.dataset.graphViewerCaptureStatus = 'error';
        }
      }
    };
    run();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (window.__GKB_GRAPH_CAPTURE__?.capture_key === captureKey) {
        delete window.__GKB_GRAPH_CAPTURE__;
        delete document.documentElement.dataset.graphViewerCaptureStatus;
      }
    };
  }, [
    exactPreviewCapture,
    viewerPalette.canvas,
    displayGraphData,
    displayCoordData,
    effectiveMetadata?.authoring?.view_id,
    effectiveMetadata?.layout?.demo?.view_id,
    effectiveMetadata?.view_id,
  ]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.elements('.kg-highlight-new').removeClass('kg-highlight-new');
    highlightedIds.forEach((id) => {
      const ele = cy.getElementById(id);
      if (ele?.nonempty()) {
        ele.addClass('kg-highlight-new');
      }
    });
  }, [highlightedIds]);

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };
    const handleDocumentPointerDown = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleDocumentPointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleDocumentPointerDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!modeMenuOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setModeMenuOpen(false);
      }
    };
    const handleDocumentPointerDown = (event) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target)) {
        setModeMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleDocumentPointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleDocumentPointerDown);
    };
  }, [modeMenuOpen, reviewEnabled, reviewMode?.allowNodeDragging]);

  useEffect(() => {
    if (!focusMenuOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setFocusMenuOpen(false);
      }
    };
    const handleDocumentPointerDown = (event) => {
      if (focusMenuRef.current && !focusMenuRef.current.contains(event.target)) {
        setFocusMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleDocumentPointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleDocumentPointerDown);
    };
  }, [focusMenuOpen]);

  const zoomToolbarButtons = (
    <>
      <Button disabled onClick={handleFullscreen} variant="outlined" startIcon={<ZoomOutMapIcon sx={{ fontSize: '16px' }} />} sx={viewerToolbarButtonSx}>Fullscreen</Button>
      <Button onClick={handleZoomIn} variant="outlined" disabled={zoomLevel >= maximumZoom} startIcon={<ZoomInIcon sx={{ fontSize: '16px' }} />} sx={viewerToolbarButtonSx}>Zoom in</Button>
      <Button onClick={handleZoomOut} variant="outlined" disabled={zoomLevel <= minimumZoom} startIcon={<ZoomOutIcon sx={{ fontSize: '16px' }} />} sx={viewerToolbarButtonSx}>Zoom out</Button>
      <Button onClick={handleRecenter} variant="outlined" startIcon={<CenterFocusStrongIcon sx={{ fontSize: '16px' }} />} sx={viewerToolbarButtonSx}>Recenter</Button>
    </>
  );
  const exactLinkedViewPreview = isExactLinkedViewPreview(pathwayPreview);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', width: '100%', height: '100%', color: viewerPalette.ink, ...sx }}>
      <Box ref={toolbarRowRef} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', height: '80px', padding: '0 32px', background: viewerPalette.surface, flexWrap: 'nowrap' }}>
        <Box ref={toolbarTitleRef} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 600, lineHeight: '22px', color: viewerPalette.ink }}>
            {displayMetadata?.viewer?.title || 'Knowledge Graph Viewer'}
          </Typography>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 400, lineHeight: '16px', color: viewerPalette.mutedInk, marginTop: '2px' }}>
            {displayMetadata?.viewer?.subtitle || 'Neighbor Exploration'}
          </Typography>
        </Box>
        <Box
          ref={toolbarZoomGroupMeasureRef}
          aria-hidden="true"
          sx={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '8px', top: 0, left: 0, zIndex: -1 }}
        >
          {zoomToolbarButtons}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'nowrap', flexShrink: 0 }}>
          {showZoomToolbarGroup && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {zoomToolbarButtons}
              </Box>
              <Box sx={{ width: '1px', alignSelf: 'stretch', backgroundColor: viewerPalette.border }} />
            </>
          )}
          <Box ref={toolbarSecondaryGroupRef} sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {searchConfig?.index?.records?.length > 0 && (
              <Button
                onClick={() => setSearchDialogOpen(true)}
                variant="outlined"
                startIcon={<SearchIcon sx={{ fontSize: '16px' }} />}
                sx={viewerToolbarButtonSx}
              >
                Search
              </Button>
            )}
            {!reviewEnabled && <Box sx={{ position: 'relative' }}>
              <Button onClick={() => setDownloadMenuOpen((previous) => !previous)} variant="outlined" startIcon={<FileDownloadIcon sx={{ fontSize: '16px' }} />} sx={viewerToolbarButtonSx}>Download</Button>
              {downloadMenuOpen && (
                <Box sx={{ position: 'absolute', top: '44px', left: 0, width: '174px', padding: '6px', background: viewerPalette.surface, border: `1px solid ${viewerPalette.border}`, borderRadius: '8px', boxShadow: `0 5px 15px ${viewerPalette.shadow}`, zIndex: 20 }}>
                  <Button onClick={handleDownload} fullWidth size="small" sx={{ justifyContent: 'flex-start', color: '#1C3C68', textTransform: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}>Download PNG</Button>
                  <Button
                    onClick={openJsonPreview}
                    aria-haspopup="dialog"
                    fullWidth
                    size="small"
                    sx={{ justifyContent: 'flex-start', color: '#1C3C68', textTransform: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}
                  >
                    Preview &amp; download JSON
                  </Button>
                </Box>
              )}
            </Box>}
            {reviewEnabled && (
              <Button
                onClick={() => {
                  setReviewSelectionGraph(null);
                  setJsonPreviewOpen(true);
                }}
                variant="outlined"
                startIcon={<DataObjectIcon sx={{ fontSize: '16px' }} />}
                sx={viewerToolbarButtonSx}
              >
                Graph content
              </Button>
            )}
            <SwitchToggle label="Hover info" icon={<VisibilityOutlinedIcon sx={{ fontSize: '16px', color: viewerPalette.control }} />} enabled={infocardEnabled} onChange={() => setInfocardEnabled((previous) => !previous)} palette={viewerPalette} />
            <SwitchToggle label="Click menu" icon={<AdsClickIcon sx={{ fontSize: '16px', color: viewerPalette.control }} />} enabled={clickMenuEnabled} onChange={() => setClickMenuEnabled((previous) => !previous)} palette={viewerPalette} />
            {mechanismRegions.length > 0 && (
              <Box ref={focusMenuRef} sx={{ position: 'relative' }}>
                <Button onClick={() => setFocusMenuOpen((previous) => !previous)} variant="outlined" startIcon={<HubIcon sx={{ fontSize: '15px' }} />} endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '12px' }} />} sx={{ ...viewerToolbarButtonSx, maxWidth: '190px' }}>
                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeFocusLabel}</Box>
                </Button>
                {focusMenuOpen && (
                  <Box sx={{ position: 'absolute', top: '44px', right: 0, width: '270px', maxHeight: '420px', overflowY: 'auto', padding: '6px', background: viewerPalette.surface, border: `1px solid ${viewerPalette.border}`, borderRadius: '8px', boxShadow: `0 5px 15px ${viewerPalette.shadow}`, zIndex: 20 }}>
                    <Button fullWidth onClick={() => handleFocusRegion(null)} sx={modeOptionSx}>
                      <Typography component="span" sx={modeOptionTitleSx}>Overview</Typography>
                      <Typography component="span" sx={modeOptionSubtitleSx}>Fit the complete T1D mechanism</Typography>
                    </Button>
                    {mechanismRegions.map((region) => (
                      <Button key={region.id} fullWidth onClick={() => handleFocusRegion(region)} sx={modeOptionSx}>
                        <Typography component="span" sx={modeOptionTitleSx}>{region.label}</Typography>
                        <Typography component="span" sx={modeOptionSubtitleSx}>Focus this mechanism module</Typography>
                      </Button>
                    ))}
                  </Box>
                )}
              </Box>
            )}
            <Box ref={modeMenuRef} sx={{ position: 'relative' }}>
              <Button onClick={() => setModeMenuOpen((previous) => !previous)} variant="outlined" startIcon={<GridViewIcon sx={{ fontSize: '15px' }} />} endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '12px' }} />} sx={viewerToolbarButtonSx}>
                {viewModeLabel(viewMode)}
              </Button>
              {modeMenuOpen && (
                <Box sx={{ position: 'absolute', top: '44px', right: 0, width: '220px', padding: '6px', background: viewerPalette.surface, border: `1px solid ${viewerPalette.border}`, borderRadius: '8px', boxShadow: `0 5px 15px ${viewerPalette.shadow}`, zIndex: 20 }}>
                  <Button fullWidth disabled={interactionLoading || !activeCypherList.length} onClick={() => handleModeChange('kg_only')} sx={modeOptionSx}>
                    <Typography component="span" sx={modeOptionTitleSx}>KG mode</Typography>
                    <Typography component="span" sx={modeOptionSubtitleSx}>Generic graph layout</Typography>
                  </Button>
                  <Button fullWidth disabled={interactionLoading || !activeCypherList.length} onClick={() => handleModeChange('genome_mode')} sx={modeOptionSx}>
                    <Typography component="span" sx={modeOptionTitleSx}>Genome browser mode</Typography>
                    <Typography component="span" sx={modeOptionSubtitleSx}>Genome tracks + KG around</Typography>
                  </Button>
                  <Button fullWidth disabled={interactionLoading || !activeCypherList.length} onClick={() => handleModeChange('cell_type_mode')} sx={modeOptionSx}>
                    <Typography component="span" sx={modeOptionTitleSx}>Cell type mode</Typography>
                    <Typography component="span" sx={modeOptionSubtitleSx}>Cell membranes + molecular context</Typography>
                  </Button>
                </Box>
              )}
            </Box>
              <IconButton onClick={handleUndo} disabled={!canUndo} size="small" sx={{ width: '36px', height: '36px', border: `1px solid ${viewerPalette.border}`, borderRadius: '10px' }} aria-label="Undo">
              <UndoIcon sx={{ fontSize: '18px', color: canUndo ? viewerPalette.control : '#C9C5BD' }} />
            </IconButton>
            <IconButton onClick={handleRedo} disabled={!canRedo} size="small" sx={{ width: '36px', height: '36px', border: `1px solid ${viewerPalette.border}`, borderRadius: '10px' }} aria-label="Redo">
              <RedoIcon sx={{ fontSize: '18px', color: canRedo ? viewerPalette.control : '#C9C5BD' }} />
            </IconButton>
            <Button onClick={handleResetGraph} variant="outlined" startIcon={<SyncIcon sx={{ fontSize: '16px' }} />} sx={{ ...viewerToolbarButtonSx, color: viewerPalette.ink }}>Reset graph</Button>
          </Box>
        </Box>
      </Box>
      <div style={{ position: 'relative', height: containerHeight, minHeight: '460px', overflow: 'hidden', background: viewerPalette.canvas }}>
      {actionMessage && (
        <Alert severity={actionMessage.severity} onClose={() => setActionMessage(null)} sx={{ position: 'absolute', top: '12px', right: '16px', zIndex: 8, maxWidth: '420px' }}>
          {actionMessage.text}
        </Alert>
      )}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: viewerPalette.canvas,
            border: 'none',
            position: 'relative',
            zIndex: 1,
          }}
        />
      {trackOverlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 2,
            maxHeight: '80vh',
            overflowX: 'hidden',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          {trackOverlay.laneLabels.map((lane) => (
            <div
              key={lane.key}
              style={{
                position: 'absolute',
                left: '226px',
                top: lane.centerY,
                transform: 'translateY(-50%)',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid rgba(140, 174, 201, 0.6)',
                color: '#37566F',
                fontFamily: 'Open Sans',
                fontSize: '12px',
                fontWeight: 700,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(80, 108, 130, 0.12)',
              }}
            >
              {lane.name}
            </div>
          ))}
        </div>
      )}
      {typeof document !== 'undefined' && createPortal(
        <div
          ref={infocardRef}
          onMouseEnter={() => setInfocardHovered(true)}
          onMouseLeave={() => setInfocardHovered(false)}
          style={{
            fontFamily: 'Open Sans',
            fontWeight: 400,
            position: 'fixed',
            left: infocardPosition.x,
            top: infocardPosition.y,
            background: layeredNavigationEnabled ? viewerPalette.surface : '#fff',
            border: layeredNavigationEnabled ? `1px solid ${viewerPalette.border}` : 'none',
            borderRadius: '8px',
            maxHeight: '80vh',
            overflowX: 'hidden',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            color: '#333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: INFOCARD_Z_INDEX,
            width: 'min(430px, calc(100vw - 24px))',
            pointerEvents: infocardVisible ? 'auto' : 'none',
            opacity: infocardVisible ? 1 : 0,
            display: 'block',
            transform: 'translateY(0px)',
            transition: 'opacity 0.15s, left 0.15s, top 0.15s',
            willChange: 'transform, opacity',
            wordWrap: 'break-word',
          }}
        >
          <GraphInfocard
            hoveredData={activeNode?.data()}
            infoPanelOverrides={infoPanelOverrides}
            theme={layeredNavigationEnabled ? {
              surface: viewerPalette.surface,
              softSurface: viewerPalette.softSurface,
              border: viewerPalette.border,
              ink: viewerPalette.ink,
              mutedInk: viewerPalette.mutedInk,
              link: viewerPalette.control,
              accentFill: viewerNodeColors[activeNode?.data()?.type],
              accentBorder: viewerNodeBorderColors[activeNode?.data()?.type],
              accentText: viewerNodeTextColors[activeNode?.data()?.type],
            } : undefined}
          />
        </div>,
        document.body,
      )}
      {contextMenu && (
        <Box
          ref={contextMenuRef}
          sx={{
            position: 'absolute',
            left: contextMenu.x + 10,
            top: contextMenu.y + 10,
            width: '190px',
            padding: '6px',
            background: viewerPalette.surface,
            border: `1px solid ${viewerPalette.border}`,
            borderRadius: '8px',
            boxShadow: '0 5px 15px rgba(48, 69, 82, 0.18)',
            zIndex: 30,
          }}
        >
          {developerEnabled || reviewEnabled ? (
            <>
              {contextMenu.type === 'node' && cyRef.current?.getElementById(contextMenu.id)?.data('graph_link') && (
                <Button
                  fullWidth
                  onClick={() => {
                    const data = cyRef.current.getElementById(contextMenu.id).data();
                    setContextMenu(null);
                    developerNavigate(data.graph_link);
                  }}
                  startIcon={<HubIcon sx={{ fontSize: '16px' }} />}
                  sx={contextMenuItemSx}
                >
                  {navigationLabel(cyRef.current.getElementById(contextMenu.id).data())}
                </Button>
              )}
              <Button
                fullWidth
                onClick={() => {
                  if (developerEnabled) {
                    openDeveloperRecord(contextMenu.type, contextMenu.id);
                    return;
                  }
                  const record = findRawRecord(contextMenu.type, contextMenu.id);
                  if (!record) return;
                  setReviewSelectionGraph(contextMenu.type === 'node'
                    ? { nodes: [record], edges: [] }
                    : { nodes: [], edges: [record] });
                  setContextMenu(null);
                  setJsonPreviewOpen(true);
                }}
                startIcon={<DataObjectIcon sx={{ fontSize: '16px' }} />}
                sx={contextMenuItemSx}
              >
                Show all data
              </Button>
            </>
          ) : contextMenu.type === 'node' ? (
            <>
              <Button
                fullWidth
                disabled={interactionLoading || isOverflowId(contextMenu.id)}
                onClick={() => handleExploreNeighbors(contextMenu.id)}
                startIcon={<HubIcon sx={{ fontSize: '16px' }} />}
                sx={contextMenuItemSx}
              >
                Explore neighbors
              </Button>
              <Button
                fullWidth
                disabled={interactionLoading || isOverflowId(contextMenu.id)}
                onClick={() => handleFindConnection(contextMenu.id)}
                startIcon={<LinkIcon sx={{ fontSize: '16px' }} />}
                sx={contextMenuItemSx}
              >
                Find connection
              </Button>
              <Button
                fullWidth
                onClick={() => handleDeleteElement(contextMenu.id)}
                startIcon={<DeleteOutlineIcon sx={{ fontSize: '16px' }} />}
                sx={{ ...contextMenuItemSx, color: '#B42318' }}
              >
                Delete node
              </Button>
            </>
          ) : (
            <Button
              fullWidth
              onClick={() => handleDeleteElement(contextMenu.id)}
              startIcon={<DeleteOutlineIcon sx={{ fontSize: '16px' }} />}
              sx={{ ...contextMenuItemSx, color: '#B42318' }}
            >
              Delete edge
            </Button>
          )}
        </Box>
      )}
        {layeredNavigationEnabled && previousLayerRoute && (
          <Button
            onClick={() => developerNavigate(previousLayerRoute)}
            startIcon={<ArrowBackIcon />}
            sx={{
              ...viewerToolbarButtonSx,
              position: 'absolute', top: '24px', left: '32px', zIndex: 6,
              height: '44px', padding: '0 14px', fontWeight: 700,
              boxShadow: `0px 8px 12px ${viewerPalette.shadow}`,
            }}
          >
            {previousLayerLabel}
          </Button>
        )}
        <div
          style={{
            position: layeredNavigationEnabled ? 'static' : 'absolute',
            top: layeredNavigationEnabled ? undefined : '24px',
            left: layeredNavigationEnabled ? undefined : '32px',
            display: layeredNavigationEnabled ? 'contents' : 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
            height: 'calc(100% - 48px)',
            width: '208px',
            zIndex: 4,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: '0 1 auto', minHeight: 0, overflow: 'hidden', maxHeight: layeredNavigationEnabled ? '40vh' : undefined, position: layeredNavigationEnabled ? 'absolute' : undefined, right: layeredNavigationEnabled ? '88px' : undefined, bottom: layeredNavigationEnabled ? '24px' : undefined, width: layeredNavigationEnabled ? '208px' : undefined, zIndex: layeredNavigationEnabled ? 6 : undefined, background: viewerPalette.surface, border: `0.75px solid ${viewerPalette.border}`, borderRadius: '16px', boxShadow: `0px 8px 12px ${viewerPalette.shadow}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12.75px', borderBottom: legendVisible ? '0.75px solid #F1F5F9' : 'none' }}>
              <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 600, lineHeight: '24px', color: viewerPalette.ink }}>
                Legend
              </Typography>
              <IconButton onClick={() => setLegendVisible((prev) => !prev)} size="small" sx={{ width: '28px', height: '28px' }} aria-label={legendVisible ? 'Collapse legend' : 'Expand legend'}>
                {legendVisible ? <KeyboardArrowUpIcon sx={{ fontSize: '16px' }} /> : <KeyboardArrowDownIcon sx={{ fontSize: '16px' }} />}
              </IconButton>
            </div>
            {legendVisible && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: layeredNavigationEnabled ? 'calc(40vh - 62px)' : undefined, padding: '12px 20px 16px' }}>
                <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: viewerPalette.mutedInk, paddingBottom: '8px' }}>
                  Node types
                </Typography>
                {Array.isArray(activeLegend) && activeLegend.map(({ label, color }) => (
                  <LegendItem key={label} label={label} color={color} />
                ))}
              </div>
            )}
          </div>
          <Box
            onClick={handleThumbnailClick}
            sx={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', gap: '12px', padding: '16px 20px', position: layeredNavigationEnabled ? 'absolute' : 'relative', left: layeredNavigationEnabled ? '32px' : undefined, bottom: layeredNavigationEnabled ? '24px' : undefined, width: layeredNavigationEnabled ? '208px' : undefined, zIndex: layeredNavigationEnabled ? 6 : undefined, background: viewerPalette.surface, border: `0.75px solid ${viewerPalette.border}`, borderRadius: '16px', boxShadow: `0px 8px 12px ${viewerPalette.shadow}` }}
          >
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: viewerPalette.mutedInk }}>
              Overview
            </Typography>
            <Box sx={{ position: 'relative', width: '100%', height: '80px', background: viewerPalette.overview, border: `0.75px solid ${viewerPalette.overviewBorder}`, borderRadius: '14px', overflow: 'hidden', cursor: 'crosshair' }}>
              {thumbnailImage && <img src={thumbnailImage} alt="Graph overview" style={{ width: '100%', height: '100%', objectFit: 'fill', opacity: 0.85 }} />}
              {thumbnailViewport && <div style={{ position: 'absolute', left: `${thumbnailViewport.left}px`, top: `${thumbnailViewport.top}px`, width: `${thumbnailViewport.width}px`, height: `${thumbnailViewport.height}px`, boxSizing: 'border-box', border: '2px solid #3F88C5', pointerEvents: 'none' }} />}
            </Box>
          </Box>
        </div>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            right: '16px',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            padding: '16px 12px',
            background: viewerPalette.surface,
            borderRadius: '12px',
            boxShadow: `0px 8px 12px ${viewerPalette.shadow}`,
            zIndex: 4,
          }}
        >
          <IconButton disabled onClick={handleFullscreen} size="small" sx={{ padding: 0 }}>
            <ZoomOutMapIcon sx={{ fontSize: '24px', color: viewerPalette.control }} />
          </IconButton>
          <IconButton onClick={handleZoomIn} disabled={zoomLevel >= maximumZoom} size="small" sx={{ padding: 0 }}>
            <ZoomInIcon sx={{ fontSize: '24px', color: viewerPalette.control }} />
          </IconButton>
          <IconButton onClick={handleZoomOut} disabled={zoomLevel <= minimumZoom} size="small" sx={{ padding: 0 }}>
            <ZoomOutIcon sx={{ fontSize: '24px', color: viewerPalette.control }} />
          </IconButton>
          <IconButton onClick={handleRecenter} size="small" sx={{ padding: 0 }}>
            <CenterFocusStrongIcon sx={{ fontSize: '24px', color: viewerPalette.control }} />
          </IconButton>
        </Box>
      </div>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '120px', padding: '16px 32px', background: viewerPalette.surface, borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '28px', paddingRight: '32px', borderRight: '1px solid #CCD4FF' }}>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: viewerPalette.control }}>Metadata</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
              <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500, color: '#94A3B8' }}>Graph status</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Box sx={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 400, color: '#10B981' }}>
                  {viewModeLabel(viewMode)}
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '28px', padding: '0 32px', borderRight: '1px solid #CCD4FF' }}>
            <Box>
              <Typography sx={metaLabelSx}>Layout engine</Typography>
              <Typography sx={metaValueSx}>
                {displayMetadata?.layout?.engine === 'optimized_v1'
                  ? 'Optimized v1'
                  : String(displayMetadata?.layout?.engine || 'legacy').replace(/_/g, ' ')}
              </Typography>
            </Box>
            <Box><Typography sx={metaLabelSx}>Nodes</Typography><Typography sx={metaValueSx}>{displayMetadata?.filtered_node_count ?? displayGraphData?.nodes?.length ?? 0}</Typography></Box>
            <Box><Typography sx={metaLabelSx}>Edges</Typography><Typography sx={metaValueSx}>{displayMetadata?.filtered_edge_count ?? displayGraphData?.edges?.length ?? 0}</Typography></Box>
            <Box><Typography sx={metaLabelSx}>Visible nodes</Typography><Typography sx={metaValueSx}>{displayMetadata?.real_visible_node_count ?? displayGraphData?.nodes?.length ?? 0}</Typography></Box>
            <Box><Typography sx={metaLabelSx}>Visible edges</Typography><Typography sx={metaValueSx}>{displayMetadata?.filtered_edge_count ?? displayGraphData?.edges?.length ?? 0}</Typography></Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 32px', justifyContent: 'center' }}>
            <Typography sx={metaLabelSx}>Last updated</Typography>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 400, color: '#0F172A' }}>{displayMetadata?.last_updated || '—'}</Typography>
          </Box>
        </Box>
        {!reviewEnabled && <Button
          onClick={developerEnabled ? handleSaveLayout : () => setQueryDialogOpen(true)}
          disabled={developerEnabled && (!developerMode?.permissions?.saveLayout || !layoutDirty)}
          sx={{
            height: '44px',
            minWidth: '175px',
            padding: '6px 50px',
            borderRadius: '8px',
            backgroundColor: viewerPalette.control,
            color: '#FFFFFF',
            fontFamily: 'Inter, sans-serif',
            fontSize: '16px',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { backgroundColor: viewerPalette.controlHover, boxShadow: 'none' },
          }}
        >
          {developerEnabled ? 'Save Layout' : 'Query Graph'}
        </Button>}
      </Box>
      {!developerEnabled && !reviewEnabled && (
        <GraphViewerQueryDialog
          open={queryDialogOpen}
          examples={queryExamples}
          initialRequest={displayQueryRequest}
          onClose={() => setQueryDialogOpen(false)}
          onResult={(payload) => {
            setQueryResult(payload);
            setViewMode(payload.metadata?.layout?.mode || 'kg_only');
            setLayoutEngine(payload.metadata?.layout?.engine || payload.request?.layout_engine || 'legacy');
            setActionMessage(null);
          }}
        />
      )}
      <GraphViewerDataExportDialog
        open={jsonPreviewOpen}
        onClose={() => {
          setJsonPreviewOpen(false);
          setReviewSelectionGraph(null);
        }}
        onDownload={handleDownloadJson}
        allowDownload={!reviewEnabled || reviewDownloadAllowed}
        graphData={reviewSelectionGraph || visibleGraphExport}
        downloadDisabled={((reviewSelectionGraph || visibleGraphExport)?.nodes?.length || 0) > exportNodeLimit}
        downloadLimit={exportNodeLimit}
      />
      {searchConfig?.index?.records?.length > 0 && (
        <GraphViewerSearchDialog
          open={searchDialogOpen}
          index={searchConfig.index}
          indexUrl={searchConfig.indexUrl}
          currentViewId={displayMetadata?.view_id || displayMetadata?.authoring?.view_id || ''}
          searchProvider={searchConfig.searchProvider}
          onClose={() => setSearchDialogOpen(false)}
          onOpenResult={handleSearchResultOpen}
        />
      )}
      {developerEnabled && (
        <Suspense fallback={null}>
          <GraphViewerDeveloperDialog
            ref={developerDialogRef}
            open={Boolean(developerSelection)}
            selection={developerSelection}
            adapter={developerMode.adapter}
            viewId={displayMetadata?.authoring?.view_id || displayMetadata?.view_id}
            permissions={developerMode.permissions || {}}
            infoPanelOverrides={infoPanelOverrides}
            onInfoPanelOverride={(kind, type, panel) => setInfoPanelOverrides((current) => ({
              ...current,
              [kind]: panel
                ? { ...current[kind], [type]: panel }
                : Object.fromEntries(Object.entries(current[kind] || {}).filter(([key]) => key !== type)),
            }))}
            onRecordSaved={(record) => {
              setDeveloperRecordOverrides((current) => ({ ...current, [record['~id']]: record }));
              setDeveloperSelection((current) => (current ? { ...current, record } : current));
            }}
            onClose={() => setDeveloperSelection(null)}
            onNavigate={() => developerNavigate(developerSelection?.graphLink)}
            onPreview={() => {
              if (developerSelection?.preview) {
                setDeveloperSelection(null);
                setPathwayPreviewLoadError(false);
                setPathwayPreview(developerSelection.preview);
              }
            }}
            onDirtyChange={setDeveloperEditorDirty}
          />
        </Suspense>
      )}
      <Dialog open={Boolean(pendingDeveloperNavigation)} onClose={() => setPendingDeveloperNavigation(null)}>
        <DialogTitle>Unsaved Developer Mode changes</DialogTitle>
        <DialogContent>
          <Typography>Save or export the current data, schema, and layout edits before opening the linked graph.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDeveloperNavigation(null)}>Cancel</Button>
          <Button onClick={() => {
            const destination = pendingDeveloperNavigation;
            setPendingDeveloperNavigation(null);
            if (destination) window.location.assign(destination);
          }}>Discard and Continue</Button>
          <Button variant="contained" onClick={saveAndContinueDeveloperNavigation}>
            {developerMode?.adapter?.mode === 'export' ? 'Export and Continue' : 'Save and Continue'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(pathwayPreview)}
        onClose={closePathwayPreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '18px',
            overflow: 'hidden',
            background: '#FFFDF9',
          },
        }}
      >
        <DialogTitle sx={{ padding: '22px 28px 10px', fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#24493F' }}>
          {pathwayPreview?.preview_title || 'Underlying KG pathway preview'}
        </DialogTitle>
        <DialogContent sx={{ padding: '12px 28px 18px' }}>
          <Typography sx={{ marginBottom: '12px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#66756F' }}>
            {exactLinkedViewPreview
              ? 'Exact cached rendering of the linked detail view, using the same nodes, edges, coordinates, routes, labels, and graph-viewer styles.'
              : 'Build-time DFS traversal of the linked graph. Solid edges form the traversal tree; dashed edges preserve additional biological connections.'}
          </Typography>
          {pathwayPreview?.preview_not_canonical_pathway_diagram && (
            <Alert severity="info" sx={{ marginBottom: '12px' }}>
              KG-derived mechanism preview; this is not a canonical Reactome pathway diagram.
            </Alert>
          )}
          <Box
            sx={{
              height: { xs: '300px', md: '55vh' },
              minHeight: { xs: '260px', md: '340px' },
              maxHeight: '560px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #E4DCCF',
              borderRadius: '14px',
              overflow: 'hidden',
              background: '#FAF4EB',
            }}
          >
            {pathwayPreviewLoadError ? (
              <Alert severity="error">The cached pathway figure could not be loaded.</Alert>
            ) : pathwayPreview ? (
              <img
                src={resolvePreviewAssetUrl(previewReferenceFor(pathwayPreview), assetBaseUrl)}
                alt={pathwayPreview.preview_alt || `KG-derived pathway preview for ${pathwayPreview.name || pathwayPreview.label || 'selected node'}`}
                onError={() => setPathwayPreviewLoadError(true)}
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            ) : null}
          </Box>
          {pathwayPreview && (
            <Typography sx={{ marginTop: '10px', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#66756F' }}>
              {exactLinkedViewPreview
                ? `${pathwayPreview.preview_node_count || 0} nodes · ${pathwayPreview.preview_edge_count || 0} edges · complete linked detail view`
                : `${pathwayPreview.preview_node_count || 0} nodes · ${pathwayPreview.preview_edge_count || 0} edges · DFS depth ${pathwayPreview.preview_depth || 0}${pathwayPreview.preview_truncated ? ' · truncated to preview budget' : ''}`}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ padding: '0 28px 22px', gap: '8px' }}>
          <Button onClick={closePathwayPreview} sx={{ textTransform: 'none', color: '#5F6F69' }}>Close</Button>
          <Button
            variant="contained"
            disabled={!pathwayPreview?.graph_link}
            onClick={openPathwayPreviewDetail}
            sx={{ textTransform: 'none', backgroundColor: '#24493F', '&:hover': { backgroundColor: '#19362F' } }}
          >
            Open interactive detail
          </Button>
        </DialogActions>
      </Dialog>
      </div>
    </>
  );
}
