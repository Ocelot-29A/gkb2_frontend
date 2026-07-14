"use client";

import './styles.css';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import cytoscape from 'cytoscape';
import { useSelector } from 'react-redux';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Alert,
  Box,
  Button,
  Link,
  Typography,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';

import zoomInIcon from '../image/fontisto--zoom-minus.svg';
import zoomOutIcon from '../image/fontisto--zoom-plus.svg';
import downloadIcon from '../image/material-symbols--download-rounded.svg';
import recenterIcon from '../image/material-symbols--recenter-rounded.svg';
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

const LegendItem = ({ label, color, sx, isEdge = false }) => (
  <span
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minHeight: '24px',
      padding: '2px 4px',
      borderRadius: '4px',
      backgroundColor: 'transparent',
      fontSize: '11px',
      fontWeight: 600,
      color: '#425A68',
      ...sx,
    }}
  >
    <span
      style={{
        display: 'inline-block',
        flex: '0 0 auto',
        width: isEdge ? '24px' : '13px',
        height: isEdge ? '2px' : '13px',
        borderRadius: isEdge ? '0' : '3px',
        backgroundColor: color || '#D9E1E6',
        border: isEdge ? 'none' : `1px solid ${color || '#D9E1E6'}`,
      }}
    />
    {label}
  </span>
);

const toolbarButtonSx = {
  minHeight: '54px',
  padding: '7px 12px',
  border: '1px solid #E0E7EB',
  borderRadius: '8px',
  backgroundColor: '#FFFFFF',
  color: '#263238',
  boxShadow: '0 1px 3px rgba(42, 63, 78, 0.08)',
  fontFamily: 'Open Sans, sans-serif',
  fontSize: '11px',
  fontWeight: 600,
  lineHeight: 1.15,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  '&:hover': {
    borderColor: '#B8CDD5',
    backgroundColor: '#F8FBFC',
  },
  '&.Mui-disabled': {
    borderColor: '#E0E7EB',
    color: '#7B8A92',
  },
};

const ToolbarToggle = ({ label, enabled, onChange }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', minWidth: '72px', height: '54px' }}>
    <Typography sx={{ fontSize: '10px', color: '#263238', lineHeight: 1, whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onChange}
      style={{ position: 'relative', width: '54px', height: '24px', padding: 0, border: '1px solid #7CB8BF', borderRadius: '13px', background: enabled ? '#55A5AB' : '#DDE7EA', cursor: 'pointer', transition: 'background 0.15s ease' }}
    >
      <span style={{ position: 'absolute', top: '3px', left: enabled ? '31px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(35, 70, 79, 0.28)', transition: 'left 0.15s ease' }} />
      <span style={{ position: 'absolute', left: enabled ? '7px' : '24px', top: '5px', color: enabled ? '#FFFFFF' : '#5C7078', fontFamily: 'Open Sans, sans-serif', fontSize: '9px', fontWeight: 700, lineHeight: 1 }}>
        {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  </Box>
);

const InfocardData = ({ value, config, dataKey }) => {
  const setting = config?.match(/\(([^)]+)\)/)?.[1];
  const type = setting ? config.split('(')[0] : config;

  if (!type) {
    return <>{value || 'No Data'}</>;
  }

  if (type === 'string') {
    return <>{dataKey || 'No Data'}</>;
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

const PANK_TYPE_MAP = {
  Gene: 'coding_elements',
  Transcript: 'gene',
  Protein: 'gene',
  GO_term: 'gene_ontology',
  Exon: 'region',
  CDS_segments: 'region',
  TSS_segment: 'region',
  UTR_segments: 'region',
};

const CANONICAL_NODE_LABEL_PRIORITY = [
  'Gene',
  'Transcript',
  'TSS_segment',
  'Exon',
  'CDS_segments',
  'UTR_segments',
  'Protein',
  'GO_term',
];

const GENERIC_NODE_LABELS = new Set(['ontology', 'coding_element', 'coding_elements']);

const normalizeNodeType = (label) => PANK_TYPE_MAP[label] || label;

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
    || 'coding_elements';
};

const getNodeType = (node) => {
  const labels = Array.isArray(node?.['~labels']) ? node['~labels'] : [];
  const canonicalLabel = getCanonicalNodeLabel(node);
  const orderedLabels = [canonicalLabel, ...labels.filter((label) => label !== canonicalLabel)];
  return orderedLabels
    .map(normalizeNodeType)
    .find((label) => graphInfocard.nodes?.[label]?.info_panel || nodeColors[label]) || 'coding_elements';
};

const getNodeLabel = (node) => {
  const labels = node?.['~labels'] || [];
  const properties = node?.['~properties'] || {};
  const baseName = properties.name;
  const baseId = properties.id || node?.['~id'] || '';

  if (labels.includes('disease')) {
    return 'T1D';
  }

  if (baseName && baseName.length <= 15) {
    return baseName.replace(/_/g, ' ');
  }

  return String(baseId).replace(/_/g, ' ');
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
  const schema = (isEdge ? graphInfocard?.edges : graphInfocard?.nodes)?.[hoveredData?.type]?.info_panel;
  const titleColumn = schema?.find(([label]) => label === 'Title');
  const footerInfo = schema?.find(([label]) => label === 'Footer')?.[1] || [];

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
            }}
          >
            <InfocardData
              value={hoveredData[titleColumn?.[1]]?.replace?.(/_/g, ' ')}
              dataKey={titleColumn?.[1]}
              config={titleColumn?.[2]}
            />
          </Typography>
        </Box>
        {schema.map(([title, content, config]) => (
          ['Title', 'Footer'].includes(title) ? null : (
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
              {Array.isArray(content) ? (
                content.map(([label, key, rowConfig]) => (
                  <Box
                    key={key}
                    sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
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
                        textAlign: 'right',
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
                      textAlign: 'justify',
                    }}
                  >
                    {(() => {
                      const processedData = config !== 'string' ? addWhitespace(hoveredData[content]) : hoveredData[content];
                      const processedKey = config === 'string' ? addWhitespace(content) : content;
                      return <InfocardData value={processedData} dataKey={processedKey} config={config} />;
                    })()}
                  </Typography>
                </Box>
              )}
            </Box>
          )
        ))}
        <Box
          sx={{
            display: 'flex',
            height: '30px',
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(360deg, #CACFD5 -73.08%, #F4F6F8 75%)',
          }}
        >
          <Typography sx={{ fontWeight: '600', fontSize: '9px', color: '#5F7885' }}>
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
        </Box>
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
  const [modeLoading, setModeLoading] = useState(false);
  const [modeError, setModeError] = useState('');
  const [thumbnailImage, setThumbnailImage] = useState('');
  const [thumbnailViewport, setThumbnailViewport] = useState(null);
  const [viewportState, setViewportState] = useState({
    zoom: 1,
    panX: 0,
    panY: 0,
    width: 0,
    height: 0,
  });

  const displayGraphData = queryResult?.graphData || graphData;
  const displayCoordData = queryResult?.coordData || coordData;
  const displayMetadata = queryResult?.metadata || metadata;
  const effectiveMetadata = displayMetadata
    ? { ...displayMetadata, layout: { ...displayMetadata.layout, mode: viewMode } }
    : null;
  const displayQueryRequest = queryResult?.request || queryRequest;

  useEffect(() => {
    if (queryResult?.metadata?.layout?.mode) {
      setViewMode(queryResult.metadata.layout.mode);
    }
  }, [queryResult]);

  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);

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

  const handleModeChange = async (nextMode) => {
    setModeMenuOpen(false);
    setModeError('');
    if (nextMode === viewMode) {
      return;
    }
    if (!displayQueryRequest) {
      setModeError('Run a graph query before switching layout mode.');
      return;
    }

    setModeLoading(true);
    try {
      const request = { ...displayQueryRequest, layout_mode: nextMode };
      const result = await requestGraphViewer(request);
      setQueryResult(result);
      setViewMode(result.metadata?.layout?.mode || nextMode);
    } catch (error) {
      setModeError(error.message || 'Failed to switch graph layout mode.');
    } finally {
      setModeLoading(false);
    }
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

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
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
    const contentLeft = 8;
    const contentTop = 8;
    const contentWidth = 164;
    const contentHeight = 89;
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
    const contentLeft = 8;
    const contentTop = 8;
    const contentWidth = 164;
    const contentHeight = 89;
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
    if (!infocardEnabled) {
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
  }, [hoveredId, infocardEnabled, infocardHovered, nodeHovered]);

  useEffect(() => {
    const result = displayGraphData || queryResultPage?.combined_query_result;
    const positionData = displayCoordData || queryResultPage?.xy_json || {};

    if (!result?.nodes || !result?.edges || !containerRef.current) {
      return undefined;
    }

    const uniqueNodesMap = {};
    result.nodes.forEach((node) => {
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
      uniqueEdgesMap[edge['~id'] || index.toString()] = edge;
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
            'curve-style': 'unbundled-bezier',
            'control-point-distances': 'data(curveDistance)',
            'control-point-weights': 'data(curveWeight)',
            'z-index-compare': 'manual',
            'z-index': 5,
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
    cy.on('pan', syncViewportState);
    cy.on('zoom', () => {
      setZoomLevel(cy.zoom());
      syncViewportState();
    });
    cy.on('resize', syncViewportState);
    updateThumbnail();

    return () => {
      document.body.style.cursor = 'default';
      cy.removeAllListeners();
      cy.container()?.removeEventListener('mouseleave', handleLeave);
      cy.destroy();
      cyRef.current = null;
    };
  }, [displayCoordData, genomeRegion, displayGraphData, queryResultPage]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', width: '100%', height: '100%', color: '#263238', ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 1, padding: '12px 18px 10px', borderBottom: '1px solid #E5EDF3', background: '#FFFFFF', flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: '210px', paddingTop: '4px' }}>
          <Typography sx={{ fontSize: { xs: '12px', md: '16px' }, fontWeight: 700, color: '#172B3A' }}>
            Knowledge Graph Viewer
          </Typography>
          <Typography sx={{ fontSize: '12px', color: '#6D8291', marginTop: '2px' }}>
            Neighbor Exploration
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button onClick={handleFullscreen} size="small" variant="outlined" startIcon={<span style={{ fontSize: '19px', lineHeight: 1 }}>⛶</span>} sx={toolbarButtonSx}>Fullscreen</Button>
            <Button onClick={handleZoomOut} size="small" variant="outlined" disabled={zoomLevel >= 4} startIcon={<img src={zoomOutIcon} alt="" width={20} height={20} />} sx={toolbarButtonSx}>Zoom out</Button>
            <Button onClick={handleZoomIn} size="small" variant="outlined" disabled={zoomLevel <= 0.6} startIcon={<img src={zoomInIcon} alt="" width={20} height={20} />} sx={toolbarButtonSx}>Zoom in</Button>
            <Button onClick={handleRecenter} size="small" variant="outlined" startIcon={<img src={recenterIcon} alt="" width={20} height={20} />} sx={{ ...toolbarButtonSx, width: '108px', whiteSpace: 'normal' }}>Recenter<br />Auto layout</Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box sx={{ position: 'relative' }}>
              <Button onClick={() => setDownloadMenuOpen((previous) => !previous)} size="small" variant="outlined" endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '16px' }} />} startIcon={<img src={downloadIcon} alt="" width={20} height={20} />} sx={{ ...toolbarButtonSx, width: '126px' }}>Download</Button>
              {downloadMenuOpen && (
                <Box sx={{ position: 'absolute', top: '58px', left: 0, width: '174px', padding: '6px', background: '#FFFFFF', border: '1px solid #E0E7EB', borderRadius: '8px', boxShadow: '0 5px 15px rgba(48, 69, 82, 0.18)', zIndex: 20 }}>
                  <Button onClick={handleDownload} fullWidth size="small" startIcon={<span style={{ fontSize: '17px' }}>▧</span>} sx={{ justifyContent: 'flex-start', color: '#263238', textTransform: 'none', fontSize: '11px' }}>Download PNG</Button>
                  <Button onClick={handleDownloadJson} fullWidth size="small" startIcon={<span style={{ fontSize: '17px' }}>{'{}'}</span>} sx={{ justifyContent: 'flex-start', color: '#263238', textTransform: 'none', fontSize: '11px' }}>Download JSON</Button>
                </Box>
              )}
            </Box>
            <ToolbarToggle label="Hover info" enabled={infocardEnabled} onChange={() => setInfocardEnabled((previous) => !previous)} />
            <ToolbarToggle label="Click menu" enabled={clickMenuEnabled} onChange={() => setClickMenuEnabled((previous) => !previous)} />
            <Box sx={{ position: 'relative' }}>
              <Button onClick={() => setModeMenuOpen((previous) => !previous)} size="small" variant="outlined" startIcon={<span style={{ fontSize: '19px', lineHeight: 1 }}>☷</span>} endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '16px' }} />} sx={{ ...toolbarButtonSx, width: '142px', whiteSpace: 'normal' }}>
                <span>Mode<br />{viewMode === 'genome_mode' ? 'Genome browser mode' : 'KG mode'}</span>
              </Button>
              {modeMenuOpen && (
                <Box sx={{ position: 'absolute', top: '58px', right: 0, width: '220px', padding: '6px', background: '#FFFFFF', border: '1px solid #E0E7EB', borderRadius: '8px', boxShadow: '0 5px 15px rgba(48, 69, 82, 0.18)', zIndex: 20 }}>
                  <Button fullWidth disabled={modeLoading || !displayQueryRequest} onClick={() => handleModeChange('kg_only')} sx={{ justifyContent: 'flex-start', color: '#263238', textTransform: 'none', fontSize: '11px', padding: '8px' }}>
                    <span style={{ marginRight: '10px', fontSize: '18px' }}>⌁</span><span><strong>KG mode</strong><br /><small>Generic graph layout</small></span>
                  </Button>
                  <Button fullWidth disabled={modeLoading || !displayQueryRequest} onClick={() => handleModeChange('genome_mode')} sx={{ justifyContent: 'flex-start', color: '#263238', textTransform: 'none', fontSize: '11px', padding: '8px' }}>
                    <span style={{ marginRight: '10px', fontSize: '18px' }}>▦</span><span><strong>Genome browser mode</strong><br /><small>Genome tracks + KG around</small></span>
                  </Button>
                </Box>
              )}
            </Box>
            <Button onClick={handleRecenter} size="small" variant="outlined" startIcon={<span style={{ fontSize: '20px', lineHeight: 1 }}>↻</span>} sx={{ ...toolbarButtonSx, width: '110px', whiteSpace: 'normal' }}>Reset graph</Button>
          </Box>
        </Box>
      </Box>
      <div style={{ position: 'relative', height: containerHeight, minHeight: '460px', overflow: 'hidden', background: '#F9FAFB' }}>
      {modeError && (
        <Alert severity="error" onClose={() => setModeError('')} sx={{ position: 'absolute', top: '12px', right: '16px', zIndex: 8, maxWidth: '420px' }}>
          {modeError}
        </Alert>
      )}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#F9FAFB',
            border: 'none',
            position: 'relative',
            boxShadow: 'inset 0 0 0 1px #E5EDF3, 0 14px 34px -20px rgba(44, 72, 102, 0.45)',
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
        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            height: 'calc(100% - 28px)',
            width: '210px',
            zIndex: 4,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: legendVisible ? '1 1 auto' : '0 0 auto', minHeight: 0, overflow: 'hidden', background: '#fff', width: '210px', boxSizing: 'border-box', padding: '10px 10px 12px', border: '1px solid #E0E9EF', borderRadius: '9px', boxShadow: '0 4px 14px rgba(63, 92, 112, 0.14)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: '28px' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '15px', paddingLeft: '4px', color: '#263238', whiteSpace: 'nowrap' }}>
              Legend
            </Typography>
            <IconButton onClick={() => setLegendVisible((prev) => !prev)} size="small" aria-label={legendVisible ? 'Collapse legend' : 'Expand legend'}>
              {legendVisible ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </div>
          {legendVisible && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '3px', width: '100%', height: '100%', overflowY: 'auto', paddingTop: '10px' }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#263238', padding: '3px 4px 2px', textTransform: 'none' }}>
                Node types
              </Typography>
              {Array.isArray(legendSchema) && legendSchema.map(({ label, color }) => (
                <LegendItem key={label} label={label} color={color} />
              ))}
            </div>
          )}
        </div>
        <Box sx={{ position: 'relative', flex: '0 0 105px', width: '180px', height: '105px', marginTop: '10px', padding: '8px', boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #D9E5EC', borderRadius: '8px', boxShadow: '0 4px 14px rgba(63, 92, 112, 0.18)', cursor: 'crosshair' }} onClick={handleThumbnailClick}>
          <Typography sx={{ position: 'absolute', marginTop: '-6px', marginLeft: '0px', zIndex: 2, fontSize: '9px', fontWeight: 700, color: '#5B7180' }}>Overview</Typography>
          {thumbnailImage && <img src={thumbnailImage} alt="Graph overview" style={{ width: '100%', height: '100%', objectFit: 'fill', opacity: 0.7 }} />}
          {thumbnailViewport && <div style={{ position: 'absolute', left: `${thumbnailViewport.left}px`, top: `${thumbnailViewport.top}px`, width: `${thumbnailViewport.width}px`, height: `${thumbnailViewport.height}px`, boxSizing: 'border-box', border: '2px solid #3F88C5', pointerEvents: 'none' }} />}
        </Box>
        </div>
      <Button onClick={() => setQueryDialogOpen(true)} variant="outlined" sx={{ ...toolbarButtonSx, position: 'absolute', right: '16px', bottom: '16px', minHeight: '38px', zIndex: 5 }}>
        Query graph
      </Button>
      </div>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px 30px 18px', borderTop: '1px solid #E5EDF3', background: '#FFFFFF' }}>
        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#263238' }}>Metadata</Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 2, md: 5 }, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: '130px' }}>
            <Typography sx={{ fontSize: '11px', color: '#263238', fontWeight: 600, marginBottom: '6px' }}>Graph status</Typography>
            <Typography sx={{ fontSize: '11px', color: '#607887' }}>Mode</Typography>
            <Box sx={{ display: 'inline-flex', marginTop: '4px', padding: '4px 10px', borderRadius: '14px', background: '#E2F0E7', color: '#4A8060', fontSize: '11px', fontWeight: 700 }}>
              {viewMode === 'genome_mode' ? 'Genome mode' : 'KG mode'}
            </Box>
          </Box>
          <Box><Typography sx={{ fontSize: '11px', color: '#607887', marginBottom: '7px' }}>Nodes</Typography><Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#263238' }}>{displayMetadata?.filtered_node_count ?? displayGraphData?.nodes?.length ?? 0}</Typography></Box>
          <Box><Typography sx={{ fontSize: '11px', color: '#607887', marginBottom: '7px' }}>Edges</Typography><Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#263238' }}>{displayMetadata?.filtered_edge_count ?? displayGraphData?.edges?.length ?? 0}</Typography></Box>
          <Box><Typography sx={{ fontSize: '11px', color: '#607887', marginBottom: '7px' }}>Visible nodes</Typography><Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#263238' }}>{displayMetadata?.real_visible_node_count ?? displayGraphData?.nodes?.length ?? 0}</Typography></Box>
          <Box><Typography sx={{ fontSize: '11px', color: '#607887', marginBottom: '7px' }}>Visible edges</Typography><Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#263238' }}>{displayMetadata?.filtered_edge_count ?? displayGraphData?.edges?.length ?? 0}</Typography></Box>
          <Box><Typography sx={{ fontSize: '11px', color: '#607887', marginBottom: '7px' }}>Last updated</Typography><Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#263238' }}>{displayMetadata?.last_updated || '—'}</Typography></Box>
        </Box>
      </Box>
      <GraphViewerQueryDialog open={queryDialogOpen} onClose={() => setQueryDialogOpen(false)} onResult={(payload) => { setQueryResult(payload); setViewMode(payload.metadata?.layout?.mode || 'kg_only'); setModeError(''); }} />
      </div>
    </>
  );
}
