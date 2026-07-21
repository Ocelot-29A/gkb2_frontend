"use client";

import './styles.css';

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import cytoscape from 'cytoscape';
import { useSelector } from 'react-redux';

import AdsClickIcon from '@mui/icons-material/AdsClick';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import GridViewIcon from '@mui/icons-material/GridView';
import HubIcon from '@mui/icons-material/Hub';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LinkIcon from '@mui/icons-material/Link';
import RedoIcon from '@mui/icons-material/Redo';
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
  Link,
  Typography,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';

import graphInfocard from '../schema/graph_viewer_schema.json';
import { addWhitespace } from '../utils/textProcessing';
import GraphViewerQueryDialog, { requestGraphViewer } from './GraphViewerQueryDialog';
import {
  edgeIsInverted,
  edgeLabels,
  legendSchema,
  nodeColors,
  nodeStyle,
} from './style.js';

const CY_LAYOUT_SCALE = 0.5;
const CY_Y_POSITION_MULTIPLIER = 2;

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

export const isOverflowId = (id) => String(id ?? '').startsWith('overflow:');

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

const buildGraphRequestKey = (cypherList, mode) => JSON.stringify({ cypher: cypherList, mode });

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

const SwitchToggle = ({ label, icon, enabled, onChange }) => (
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
      border: '1px solid #E0E4EB',
      borderRadius: '10px',
      backgroundColor: '#FFFFFF',
      cursor: 'pointer',
      '&:hover': { borderColor: '#B9C6D6', backgroundColor: '#F8FAFC' },
    }}
  >
    {icon}
    <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 400, lineHeight: '16px', color: '#1C3C68', whiteSpace: 'nowrap' }}>
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
        backgroundColor: enabled ? '#1A74FF' : '#D0D6E1',
      }}
    >
      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
    </span>
  </Box>
);

const InfocardData = ({ value, config, dataKey }) => {
  const setting = config?.match(/\(([^)]+)\)/)?.[1];
  const type = setting ? config.split('(')[0] : config;

  if (!type) {
    return <>{value || 'No Data'}</>;
  }

  if (type === 'string') {
    return <>{value || 'No Data'}</>;
  }

  if (type === 'list') {
    return <>{Array.isArray(value) ? (value.join('; ') || 'No Data') : (value || 'No Data')}</>;
  }

  if (type === 'int') {
    return <>{value !== undefined && value !== null ? parseInt(value, 10).toLocaleString() : 'No Data'}</>;
  }

  if (type === 'float') {
    return <>{value !== undefined && value !== null ? parseFloat(value).toFixed(setting || 1) : 'No Data'}</>;
  }

  if (["link", "link_static"].includes(type)) {
    const href = type === 'link' ? value : dataKey;
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

  return <span>{value ?? 'No Data'}</span>;
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

const normalizeNodeType = (label) => label;

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

const getNodeType = (node) => {
  const labels = Array.isArray(node?.['~labels']) ? node['~labels'] : [];
  const canonicalLabel = getCanonicalNodeLabel(node);
  const orderedLabels = [canonicalLabel, ...labels.filter((label) => label !== canonicalLabel)];
  return orderedLabels
    .map(normalizeNodeType)
    .find((label) => graphInfocard.nodes?.[label]?.info_panel || nodeColors[label]) || 'Coding_element';
};

const getNodeLabel = (node) => {
  const properties = node?.['~properties'] || {};
  const baseName = properties.name || properties.id || node?.['~id'] || '';

  if (baseName && baseName.length <= 15) {
    return baseName.replace(/_/g, ' ');
  }

  return String(baseName).replace(/_/g, ' ');
};

const getInfoPanel = (isEdge, type) => {
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

const InfocardMenu = ({ hoveredData }) => {
  const isEdge = hoveredData?.source && hoveredData?.target;
  const schema = getInfoPanel(isEdge, hoveredData?.type);
  const titleColumn = schema?.find(([label]) => label === 'Title');
  const footerInfo = (schema?.find(([label]) => label === 'Footer')?.[1] || [])
    .filter(([, key]) => hasInfocardValue(hoveredData?.[key]));
  const configuredKeys = new Set([
    titleColumn?.[1],
    ...footerInfo.map(([, key]) => key),
    ...schema.flatMap(([, content]) => Array.isArray(content)
      ? content.map(([, key]) => key)
      : [content]),
  ]);
  const additionalRows = Object.entries(hoveredData || {})
    .filter(([key, value]) => !configuredKeys.has(key)
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
            ? content.filter(([, key]) => hasInfocardValue(hoveredData?.[key]))
            : content;
          if ((Array.isArray(content) && !visibleContent.length)
            || (!Array.isArray(content) && !hasInfocardValue(hoveredData?.[content]))) return null;
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
                        textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '4.2em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
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
                      const processedData = config !== 'string' ? addWhitespace(hoveredData[visibleContent]) : hoveredData[visibleContent];
                      const processedKey = config === 'string' ? addWhitespace(visibleContent) : visibleContent;
                      return <InfocardData value={processedData} dataKey={processedKey} config={config} />;
                    })()}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
        {additionalRows.length > 0 && <Box sx={{ width: 'calc(100% - 32px)', display: 'flex', flexDirection: 'column', padding: '16px', borderBottom: '1px solid #F0F0F0', gap: '12px' }}>
          <Typography sx={{ alignSelf: 'center', fontFamily: 'Open Sans', fontWeight: '600', fontSize: '10px', color: '#6B7880', lineHeight: '7px', textTransform: 'uppercase' }}>
            Additional properties
          </Typography>
          {additionalRows.map(([key, value]) => (
            <Box key={key} sx={{ display: 'grid', gridTemplateColumns: 'minmax(92px, 0.8fr) minmax(0, 1.2fr)', columnGap: '10px', alignItems: 'start' }}>
              <Typography sx={{ fontFamily: 'Open Sans', fontWeight: '600', fontSize: '12px', color: '#6B7880', lineHeight: '14px', marginTop: '-5px' }}>{formatPropertyLabel(key)}</Typography>
              <Typography component="span" sx={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '4.2em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', fontFamily: 'Open Sans', fontWeight: '600', fontSize: '12px', color: '#263238', marginLeft: '8px', lineHeight: '14px', marginTop: '-5px' }}>
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
                <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>
                  Open Link ↗
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
  metadata = null,
  queryRequest = null,
  queryExamples = [],
  containerHeight = '600px',
  defaultLegendVisible = true,
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
  const contextMenuRef = useRef(null);
  const modeMenuRef = useRef(null);
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
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [viewMode, setViewMode] = useState(metadata?.layout?.mode || 'kg_only');
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
  const [highlightedIds, setHighlightedIds] = useState(() => new Set());

  useEffect(() => {
    clickMenuEnabledRef.current = clickMenuEnabled;
  }, [clickMenuEnabled]);

  useEffect(() => () => {
    interactionAbortRef.current?.abort();
  }, []);

  const displayGraphData = interactionGraph?.graphData ?? queryResult?.graphData ?? graphData;
  const displayCoordData = interactionGraph?.coordData ?? queryResult?.coordData ?? coordData;
  const displayMetadata = interactionGraph?.metadata ?? queryResult?.metadata ?? metadata;
  const effectiveMetadata = displayMetadata
    ? { ...displayMetadata, layout: { ...displayMetadata.layout, mode: viewMode } }
    : null;
  const displayQueryRequest = queryResult?.request || queryRequest;
  const activeCypherList = interactionHistory?.present.cypher || displayQueryRequest?.cypher || [];
  const activeDeletedIds = new Set(interactionHistory?.present.deletedIds || []);
  const canUndo = Boolean(interactionHistory?.past.length);
  const canRedo = Boolean(interactionHistory?.future.length);

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

  useEffect(() => {
    if (queryResult?.metadata?.layout?.mode) {
      setViewMode(queryResult.metadata.layout.mode);
    }
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
          metadata: queryResult?.metadata ?? metadata,
          request: queryResult?.request ?? { ...(queryRequest || {}), cypher: baseCypher },
        };
        const key = buildGraphRequestKey(baseCypher, baselineMode);
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
      return undefined;
    }

    const cypherList = interactionHistory?.present.cypher;
    if (!cypherList) {
      return undefined;
    }

    const key = buildGraphRequestKey(cypherList, viewMode);
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
          result = await requestGraphViewer({ ...(displayQueryRequest || {}), cypher: cypherList, layout_mode: viewMode }, { signal: controller.signal });
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
  }, [queryResult, queryRequest, interactionHistory?.present.cypher, viewMode]);

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
      cyRef.current.zoom({ level: cyRef.current.zoom() / 1.2, renderedPosition: center });
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom({ level: cyRef.current.zoom() * 1.2, renderedPosition: center });
    }
  };

  const handleRecenter = () => {
    if (cyRef.current) {
      cyRef.current.zoom(initZoom);
      cyRef.current.center();
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
      const key = buildGraphRequestKey(nextCypher, viewMode);
      let result = graphCacheRef.current.get(key);
      if (!result) {
        result = await requestGraphViewer({ ...(displayQueryRequest || {}), cypher: nextCypher, layout_mode: viewMode }, { signal: controller.signal });
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
      const key = buildGraphRequestKey(nextCypher, viewMode);
      let result = graphCacheRef.current.get(key);
      if (!result) {
        result = await requestGraphViewer({ ...(displayQueryRequest || {}), cypher: nextCypher, layout_mode: viewMode }, { signal: controller.signal });
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

  const handleDownload = () => {
    if (!cyRef.current) {
      return;
    }
    const png = cyRef.current.png({ full: true, scale: 8 });
    const link = document.createElement('a');
    link.href = png;
    link.download = 'knowledge_graph.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadMenuOpen(false);
  };

  const handleDownloadJson = () => {
    const result = displayGraphData || queryResultPage?.combined_query_result;
    if (!result) {
      return;
    }

    const visibleResult = {
      ...result,
      nodes: (result.nodes || []).filter((node) => !activeDeletedIds.has(node['~id'])),
      edges: (result.edges || []).filter((edge) => (
        !activeDeletedIds.has(edge['~id'])
        && !activeDeletedIds.has(edge['~start'])
        && !activeDeletedIds.has(edge['~end'])
      )),
    };

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(visibleResult, null, 2)], { type: 'application/json' }));
    link.download = 'knowledge_graph.json';
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
    setDownloadMenuOpen(false);
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

    setThumbnailImage(cy.png({ full: true, scale: 1, bg: '#FFFFFF' }));
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

    const { width: containerWidth, top: containerTop, left: containerLeft } = container.getBoundingClientRect();
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

    let top = y - infocardHeight - nodeHeight / 2 - 2;
    let left = x + nodeWidth / 2 + 2;

    if (left + infocardWidth > containerWidth && containerLeft + x - infocardWidth - nodeWidth / 2 > 10) {
      left = x - infocardWidth - nodeWidth / 2 - 2;
    }

    if (top + containerTop < 90) {
      top = y + nodeHeight / 2 + 2;
    }

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

      return {
        data: {
          id: node['~id'],
          ...node['~properties'],
          label: getNodeLabel(node),
          type: getNodeType(node),
          Level: posData.Level || 'Core',
          renderWidth,
          renderHeight,
          labelMaxWidth: getLabelMaxWidth(renderWidth),
        },
        position: renderPosition,
      };
    });

    const nodes = (() => {
      const backgroundNode = buildTrackBackgroundNode(genomeRegion);
      return backgroundNode ? [backgroundNode, ...graphNodes] : graphNodes;
    })();

    const nodeNameMap = graphNodes.reduce((acc, node) => {
      acc[node.data.id] = node.data.label;
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

    const edges = Object.values(uniqueEdgesMap).map((edge) => ({
      data: {
        id: edge['~id'],
        source: edgeIsInverted[edge['~type']] ? edge['~end'] : edge['~start'],
        source_name: nodeNameMap[edge['~start']],
        target: edgeIsInverted[edge['~type']] ? edge['~start'] : edge['~end'],
        target_name: nodeNameMap[edge['~end']],
        type: edge['~type'],
        label: edgeLabels[edge['~type']] || edge['~type'].replace(/_/g, ' '),
        curveDistance: String(getEdgeCurveDistance(edge['~id'])),
        curveWeight: '0.5',
        ...edge['~properties'],
      },
    }));

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
          selector: 'node[renderHeight]',
          style: {
            height: 'data(renderHeight)',
          },
        },
        {
          selector: 'node[labelMaxWidth][trackBackground != "true"]',
          style: {
            'text-wrap': 'ellipsis',
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
          selector: 'node[trackBackground != "true"]',
          style: {
            'z-index-compare': 'manual',
            'z-index': 10,
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': viewMode === 'kg_only' ? 'straight' : 'unbundled-bezier',
            ...(viewMode === 'kg_only' ? {} : {
              'control-point-distances': 'data(curveDistance)',
              'control-point-weights': 'data(curveWeight)',
            }),
            'z-index-compare': 'manual',
            'z-index': 5,
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
      minZoom: 0.6,
      maxZoom: 4,
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
    };

    const handleOut = (evt) => {
      if (evt.target.id() === hoveredIdRef.current) {
        document.body.style.cursor = 'default';
        setNodeHovered(false);
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
      if (!clickMenuEnabledRef.current) {
        return;
      }
      const node = evt.target;
      if (node.data('trackBackground') === 'true') {
        return;
      }
      setContextMenu({ type: 'node', id: node.id(), x: evt.renderedPosition.x, y: evt.renderedPosition.y });
    };

    const handleEdgeTap = (evt) => {
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

    cy.reset();
    cy.center();
    setZoomLevel(cy.zoom());
    setInitZoom(cy.zoom());
    syncViewportState();

    cy.container().addEventListener('mouseleave', handleLeave);
    cy.on('mousemove', 'node', handleHover);
    cy.on('mouseout', 'node', handleOut);
    cy.on('mousemove', 'edge', handleEdge(handleHover));
    cy.on('mouseout', 'edge', handleOut);
    cy.on('tap', 'node', handleNodeTap);
    cy.on('tap', 'edge', handleEdge(handleEdgeTap));
    cy.on('tap', handleBackgroundTap);
    cy.on('pan', () => {
      syncViewportState();
      setContextMenu(null);
    });
    cy.on('zoom', () => {
      setContextMenu(null);
      setZoomLevel(cy.zoom());
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
  }, [displayCoordData, genomeRegion, displayGraphData, queryResultPage, interactionHistory?.present.deletedIds]);

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
  }, [modeMenuOpen]);

  const zoomToolbarButtons = (
    <>
      <Button disabled onClick={handleFullscreen} variant="outlined" startIcon={<ZoomOutMapIcon sx={{ fontSize: '16px' }} />} sx={toolbarButtonSx}>Fullscreen</Button>
      <Button onClick={handleZoomIn} variant="outlined" disabled={zoomLevel <= 0.6} startIcon={<ZoomInIcon sx={{ fontSize: '16px' }} />} sx={toolbarButtonSx}>Zoom in</Button>
      <Button onClick={handleZoomOut} variant="outlined" disabled={zoomLevel >= 4} startIcon={<ZoomOutIcon sx={{ fontSize: '16px' }} />} sx={toolbarButtonSx}>Zoom out</Button>
      <Button onClick={handleRecenter} variant="outlined" startIcon={<CenterFocusStrongIcon sx={{ fontSize: '16px' }} />} sx={toolbarButtonSx}>Recenter</Button>
    </>
  );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', width: '100%', height: '100%', color: '#263238', ...sx }}>
      <Box ref={toolbarRowRef} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', height: '80px', padding: '0 32px', background: '#FFFFFF', flexWrap: 'nowrap' }}>
        <Box ref={toolbarTitleRef} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 600, lineHeight: '22px', color: '#0F172A' }}>
            Knowledge Graph Viewer
          </Typography>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 400, lineHeight: '16px', color: '#94A3B8', marginTop: '2px' }}>
            Neighbor Exploration
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
              <Box sx={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#E0E4EB' }} />
            </>
          )}
          <Box ref={toolbarSecondaryGroupRef} sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box sx={{ position: 'relative' }}>
              <Button onClick={() => setDownloadMenuOpen((previous) => !previous)} variant="outlined" startIcon={<FileDownloadIcon sx={{ fontSize: '16px' }} />} sx={toolbarButtonSx}>Download</Button>
              {downloadMenuOpen && (
                <Box sx={{ position: 'absolute', top: '44px', left: 0, width: '174px', padding: '6px', background: '#FFFFFF', border: '1px solid #E0E4EB', borderRadius: '8px', boxShadow: '0 5px 15px rgba(48, 69, 82, 0.18)', zIndex: 20 }}>
                  <Button onClick={handleDownload} fullWidth size="small" sx={{ justifyContent: 'flex-start', color: '#1C3C68', textTransform: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}>Download PNG</Button>
                  <Button
                    onClick={handleDownloadJson}
                    disabled={getVisibleNodeIds().size > MAX_VISIBLE_NODES}
                    fullWidth
                    size="small"
                    sx={{ justifyContent: 'flex-start', color: '#1C3C68', textTransform: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px', '&.Mui-disabled': { color: '#B7C4D6' } }}
                  >
                    Download JSON
                  </Button>
                  {getVisibleNodeIds().size > MAX_VISIBLE_NODES && (
                    <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: '#94A3B8', padding: '2px 8px 0' }}>
                      JSON export supports up to {MAX_VISIBLE_NODES} visible nodes.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
            <SwitchToggle label="Hover info" icon={<VisibilityOutlinedIcon sx={{ fontSize: '16px', color: '#1C3C68' }} />} enabled={infocardEnabled} onChange={() => setInfocardEnabled((previous) => !previous)} />
            <SwitchToggle label="Click menu" icon={<AdsClickIcon sx={{ fontSize: '16px', color: '#1C3C68' }} />} enabled={clickMenuEnabled} onChange={() => setClickMenuEnabled((previous) => !previous)} />
            <Box ref={modeMenuRef} sx={{ position: 'relative' }}>
              <Button onClick={() => setModeMenuOpen((previous) => !previous)} variant="outlined" startIcon={<GridViewIcon sx={{ fontSize: '15px' }} />} endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '12px' }} />} sx={toolbarButtonSx}>
                {viewMode === 'genome_mode' ? 'Genome browser mode' : 'KG mode'}
              </Button>
              {modeMenuOpen && (
                <Box sx={{ position: 'absolute', top: '44px', right: 0, width: '220px', padding: '6px', background: '#FFFFFF', border: '1px solid #E0E4EB', borderRadius: '8px', boxShadow: '0 5px 15px rgba(48, 69, 82, 0.18)', zIndex: 20 }}>
                  <Button fullWidth disabled={interactionLoading || !activeCypherList.length} onClick={() => handleModeChange('kg_only')} sx={modeOptionSx}>
                    <Typography component="span" sx={modeOptionTitleSx}>KG mode</Typography>
                    <Typography component="span" sx={modeOptionSubtitleSx}>Generic graph layout</Typography>
                  </Button>
                  <Button fullWidth disabled={interactionLoading || !activeCypherList.length} onClick={() => handleModeChange('genome_mode')} sx={modeOptionSx}>
                    <Typography component="span" sx={modeOptionTitleSx}>Genome browser mode</Typography>
                    <Typography component="span" sx={modeOptionSubtitleSx}>Genome tracks + KG around</Typography>
                  </Button>
                </Box>
              )}
            </Box>
            <IconButton onClick={handleUndo} disabled={!canUndo} size="small" sx={{ width: '36px', height: '36px', border: '1px solid #E0E4EB', borderRadius: '10px' }} aria-label="Undo">
              <UndoIcon sx={{ fontSize: '18px', color: canUndo ? '#1C3C68' : '#D1D9E6' }} />
            </IconButton>
            <IconButton onClick={handleRedo} disabled={!canRedo} size="small" sx={{ width: '36px', height: '36px', border: '1px solid #E0E4EB', borderRadius: '10px' }} aria-label="Redo">
              <RedoIcon sx={{ fontSize: '18px', color: canRedo ? '#1C3C68' : '#D1D9E6' }} />
            </IconButton>
            <Button onClick={handleResetGraph} variant="outlined" startIcon={<SyncIcon sx={{ fontSize: '16px' }} />} sx={{ ...toolbarButtonSx, color: '#374151' }}>Reset graph</Button>
          </Box>
        </Box>
      </Box>
      <div style={{ position: 'relative', height: containerHeight, minHeight: '460px', overflow: 'hidden', background: 'transparent' }}>
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
            backgroundColor: 'transparent',
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
            overflow: 'hidden',
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
      <div
        ref={infocardRef}
        onMouseEnter={() => setInfocardHovered(true)}
        onMouseLeave={() => setInfocardHovered(false)}
        style={{
          fontFamily: 'Open Sans',
          fontWeight: 400,
          position: 'absolute',
          left: infocardPosition.x,
          top: infocardPosition.y,
          background: '#fff',
          borderRadius: '8px',
          overflow: 'hidden',
          color: '#333',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          width: '280px',
          pointerEvents: infocardVisible ? 'auto' : 'none',
          opacity: infocardVisible ? 1 : 0,
          display: 'block',
          transform: 'translateY(0px)',
          transition: 'opacity 0.15s, left 0.15s, top 0.15s',
          willChange: 'transform, opacity',
          wordWrap: 'break-word',
        }}
      >
        <InfocardMenu hoveredData={activeNode?.data()} />
      </div>
      {contextMenu && (
        <Box
          ref={contextMenuRef}
          sx={{
            position: 'absolute',
            left: contextMenu.x + 10,
            top: contextMenu.y + 10,
            width: '190px',
            padding: '6px',
            background: '#FFFFFF',
            border: '1px solid #E0E4EB',
            borderRadius: '8px',
            boxShadow: '0 5px 15px rgba(48, 69, 82, 0.18)',
            zIndex: 30,
          }}
        >
          {contextMenu.type === 'node' ? (
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
        <div
          style={{
            position: 'absolute',
            top: '24px',
            left: '32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
            height: 'calc(100% - 48px)',
            width: '208px',
            zIndex: 4,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: '0 1 auto', minHeight: 0, overflow: 'hidden', background: '#FFFFFF', border: '0.75px solid #E2E8F0', borderRadius: '16px', boxShadow: '0px 8px 12px rgba(15, 23, 42, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12.75px', borderBottom: legendVisible ? '0.75px solid #F1F5F9' : 'none' }}>
              <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 600, lineHeight: '24px', color: '#0F172A' }}>
                Legend
              </Typography>
              <IconButton onClick={() => setLegendVisible((prev) => !prev)} size="small" sx={{ width: '28px', height: '28px' }} aria-label={legendVisible ? 'Collapse legend' : 'Expand legend'}>
                {legendVisible ? <KeyboardArrowUpIcon sx={{ fontSize: '16px' }} /> : <KeyboardArrowDownIcon sx={{ fontSize: '16px' }} />}
              </IconButton>
            </div>
            {legendVisible && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', padding: '12px 20px 16px' }}>
                <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#94A3B8', paddingBottom: '8px' }}>
                  Node types
                </Typography>
                {Array.isArray(legendSchema) && legendSchema.map(({ label, color }) => (
                  <LegendItem key={label} label={label} color={color} />
                ))}
              </div>
            )}
          </div>
          <Box
            onClick={handleThumbnailClick}
            sx={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', gap: '12px', padding: '16px 20px', background: '#FFFFFF', border: '0.75px solid #E2E8F0', borderRadius: '16px', boxShadow: '0px 8px 12px rgba(15, 23, 42, 0.08)' }}
          >
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#94A3B8' }}>
              Overview
            </Typography>
            <Box sx={{ position: 'relative', width: '100%', height: '80px', background: '#F0F7FF', border: '0.75px solid #E0EAF5', borderRadius: '14px', overflow: 'hidden', cursor: 'crosshair' }}>
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
            background: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: '0px 8px 12px rgba(15, 23, 42, 0.08)',
            zIndex: 4,
          }}
        >
          <IconButton disabled onClick={handleFullscreen} size="small" sx={{ padding: 0 }}>
            <ZoomOutMapIcon sx={{ fontSize: '24px', color: '#1C3C68' }} />
          </IconButton>
          <IconButton onClick={handleZoomIn} disabled={zoomLevel <= 0.6} size="small" sx={{ padding: 0 }}>
            <ZoomInIcon sx={{ fontSize: '24px', color: '#1C3C68' }} />
          </IconButton>
          <IconButton onClick={handleZoomOut} disabled={zoomLevel >= 4} size="small" sx={{ padding: 0 }}>
            <ZoomOutIcon sx={{ fontSize: '24px', color: '#1C3C68' }} />
          </IconButton>
          <IconButton onClick={handleRecenter} size="small" sx={{ padding: 0 }}>
            <CenterFocusStrongIcon sx={{ fontSize: '24px', color: '#1C3C68' }} />
          </IconButton>
        </Box>
      </div>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '120px', padding: '16px 32px', background: '#FFFFFF', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '28px', paddingRight: '32px', borderRight: '1px solid #CCD4FF' }}>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: '#1C3C68' }}>Metadata</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
              <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500, color: '#94A3B8' }}>Graph status</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Box sx={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 400, color: '#10B981' }}>
                  {viewMode === 'genome_mode' ? 'Genome mode' : 'KG mode'}
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '28px', padding: '0 32px', borderRight: '1px solid #CCD4FF' }}>
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
        <Button
          onClick={() => setQueryDialogOpen(true)}
          sx={{
            height: '44px',
            minWidth: '175px',
            padding: '6px 50px',
            borderRadius: '8px',
            backgroundColor: '#1C3C68',
            color: '#FFFFFF',
            fontFamily: 'Inter, sans-serif',
            fontSize: '16px',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#16304F', boxShadow: 'none' },
          }}
        >
          Query Graph
        </Button>
      </Box>
      <GraphViewerQueryDialog
        open={queryDialogOpen}
        examples={queryExamples}
        onClose={() => setQueryDialogOpen(false)}
        onResult={(payload) => { setQueryResult(payload); setViewMode(payload.metadata?.layout?.mode || 'kg_only'); setActionMessage(null); }}
      />
      </div>
    </>
  );
}
