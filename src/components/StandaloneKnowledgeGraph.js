"use client";

import './styles.css';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import cytoscape from 'cytoscape';
import { useSelector } from 'react-redux';

import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import {
  Box,
  Collapse,
  Link,
  Typography,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';

import zoomInIcon from '../image/fontisto--zoom-minus.svg';
import zoomOutIcon from '../image/fontisto--zoom-plus.svg';
import InfoDisableIcon
  from '../image/material-symbols--ad-group-off-outline-rounded.svg';
import InfoEnableIcon
  from '../image/material-symbols--ad-group-outline-rounded.svg';
import downloadIcon from '../image/material-symbols--download-rounded.svg';
import recenterIcon from '../image/material-symbols--recenter-rounded.svg';
import graphInfocard from '../schema/graph_viewer_schema.json';
import { addWhitespace } from '../utils/textProcessing';
import {
  edgeIsInverted,
  edgeLabels,
  getContrastingColor,
  legendSchema,
  nodeColors,
  nodeStyle,
} from './style.js';

const CY_LAYOUT_SCALE = 0.5;

const LegendItem = ({ label, color, sx }) => (
  <span
    style={{
      padding: '4px 8px',
      borderRadius: '6px',
      backgroundColor: color || 'white',
      fontSize: '12px',
      color: getContrastingColor(color) || 'black',
      ...sx,
    }}
  >
    {label}
  </span>
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

const normalizeNodeType = (label) => PANK_TYPE_MAP[label] || label;

const TRACK_CAPTION_LABELS = new Set([
  'Transcript',
  'TSS_segment',
  'Exon',
  'CDS_segments',
  'UTR_segments',
]);

const shouldPlaceCaptionBelow = (node) => {
  const labels = node?.['~labels'] || [];
  return labels.some((label) => TRACK_CAPTION_LABELS.has(label));
};

const getNodeType = (node) => {
  const labels = node?.['~labels'] || [];
  return labels
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

const getRenderWidth = (posData) => {
  if (
    Number.isFinite(posData?.genome_start_x) &&
    Number.isFinite(posData?.genome_end_x)
  ) {
    return (posData.genome_end_x - posData.genome_start_x) * CY_LAYOUT_SCALE;
  }

  return Number.isFinite(posData?.width) ? posData.width * CY_LAYOUT_SCALE : posData?.width;
};

const getRenderHeight = (posData) => (
  Number.isFinite(posData?.height) ? posData.height * CY_LAYOUT_SCALE : posData?.height
);

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
      renderWidth: genomeRegion.width * CY_LAYOUT_SCALE,
      renderHeight: genomeRegion.height * CY_LAYOUT_SCALE,
    },
    position: {
      x: (genomeRegion.x + (genomeRegion.width / 2)) * CY_LAYOUT_SCALE,
      y: (genomeRegion.y + (genomeRegion.height / 2)) * CY_LAYOUT_SCALE,
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
  const [viewportState, setViewportState] = useState({
    zoom: 1,
    panX: 0,
    panY: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);

  const center = cyRef.current
    ? { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 }
    : { x: 0, y: 0 };

  const genomeRegion = metadata?.layout?.mode === 'genome_track'
    ? metadata?.layout?.genome_region
    : null;

  const trackOverlay = (() => {
    if (!genomeRegion || !viewportState.width || !viewportState.height) {
      return null;
    }

    const { zoom, panY } = viewportState;
    const lanes = Array.isArray(genomeRegion.lanes) ? genomeRegion.lanes : [];
    const regionTopModel = genomeRegion.y * CY_LAYOUT_SCALE;
    const regionBottomModel = (genomeRegion.y + genomeRegion.height) * CY_LAYOUT_SCALE;

    const laneLabels = lanes.map((lane, index) => {
      const topBoundaryModel = index === 0
        ? regionTopModel
        : ((lanes[index - 1].y + lane.y) / 2) * CY_LAYOUT_SCALE;
      const bottomBoundaryModel = index === lanes.length - 1
        ? regionBottomModel
        : ((lane.y + lanes[index + 1].y) / 2) * CY_LAYOUT_SCALE;

      return {
        name: lane.name,
        top: topBoundaryModel * zoom + panY,
        centerY: (lane.y * CY_LAYOUT_SCALE) * zoom + panY,
        height: (bottomBoundaryModel - topBoundaryModel) * zoom,
      };
    });

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
    const result = graphData || queryResultPage?.combined_query_result;
    const positionData = coordData || queryResultPage?.xy_json || {};

    if (!result?.nodes || !result?.edges || !containerRef.current) {
      return undefined;
    }

    const uniqueNodesMap = {};
    result.nodes.forEach((node) => {
      uniqueNodesMap[node['~id']] = node;
    });

    const graphNodes = Object.values(uniqueNodesMap).map((node) => {
      const posData = positionData[node['~id']] || {
        x: Math.random() * 250 - 125,
        y: Math.random() * 200 - 125,
        Level: 'Core',
      };

      return {
        data: {
          id: node['~id'],
          ...node['~properties'],
          label: getNodeLabel(node),
          type: getNodeType(node),
          Level: posData.Level || 'Core',
          renderWidth: getRenderWidth(posData),
          renderHeight: getRenderHeight(posData),
          captionBelow: shouldPlaceCaptionBelow(node) ? 'true' : 'false',
        },
        position: {
          x: posData.x * CY_LAYOUT_SCALE,
          y: posData.y * CY_LAYOUT_SCALE,
        },
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
        {
          selector: 'node[captionBelow = "true"]',
          style: {
            shape: 'rectangle',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
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

    return () => {
      document.body.style.cursor = 'default';
      cy.removeAllListeners();
      cy.container()?.removeEventListener('mouseleave', handleLeave);
      cy.destroy();
      cyRef.current = null;
    };
  }, [coordData, genomeRegion, graphData, queryResultPage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', justifyContent: 'flex-start', width: '100%', height: '100%', ...sx }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: containerHeight,
          backgroundColor: '#F9FAFB',
          border: 'none',
          borderRadius: '8px',
          position: 'relative',
          boxShadow: '0 18px 40px -22px rgba(44, 72, 102, 0.45), 0 8px 18px -14px rgba(44, 72, 102, 0.28)',
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
              key={lane.name}
              style={{
                position: 'absolute',
                left: '14px',
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
      <Box
        sx={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '7px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0px 4px 15px -3px rgba(100,100,100,0.25)',
        }}
      >
        <IconButton
          onClick={handleZoomOut}
          style={{ padding: '5px', background: 'none', borderRadius: '4px', opacity: zoomLevel >= 4 ? 0.5 : 1 }}
          disabled={zoomLevel >= 4}
        >
          <img src={zoomOutIcon} alt="Zoom Out" width={26} height={26} />
        </IconButton>
        <IconButton
          onClick={handleZoomIn}
          style={{ padding: '5px', background: 'none', borderRadius: '4px', opacity: zoomLevel <= 0.6 ? 0.5 : 1 }}
          disabled={zoomLevel <= 0.6}
        >
          <img src={zoomInIcon} alt="Zoom In" width={26} height={26} />
        </IconButton>
        <IconButton onClick={handleRecenter} style={{ padding: '7px', background: 'none', borderRadius: '4px' }}>
          <img src={recenterIcon} alt="Recenter" width={22} height={22} />
        </IconButton>
        {infocardEnabled ? (
          <IconButton onClick={() => setInfocardEnabled(false)} style={{ padding: '7px', background: 'none', borderRadius: '4px' }}>
            <img src={InfoEnableIcon} alt="Disable Info Card" width={22} height={22} />
          </IconButton>
        ) : (
          <IconButton onClick={() => setInfocardEnabled(true)} style={{ padding: '7px', background: 'none', borderRadius: '4px' }}>
            <img src={InfoDisableIcon} alt="Enable Info Card" width={22} height={22} />
          </IconButton>
        )}
        <IconButton onClick={handleDownload} style={{ padding: '6px', background: 'none', borderRadius: '4px' }}>
          <img src={downloadIcon} alt="Download" width={24} height={24} />
        </IconButton>
      </Box>
      <Box
        sx={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          height: '40px',
          width: '60px',
          display: 'flex',
          background: 'white',
          borderRadius: '6px',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0px 4px 15px -3px rgba(100,100,100,0.25)',
        }}
      >
        <Typography sx={{ fontSize: '16px', color: '#333' }}>
          {Math.round((zoomLevel / initZoom) * 100)}%
        </Typography>
      </Box>
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
      <div style={{ display: 'flex', flexDirection: 'row', gap: '200px' }}>
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '0px 4px 15px -3px rgba(100,100,100,0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', width: legendVisible ? '330px' : '40px', transition: '0.2s' }}>
            <Collapse in={legendVisible} orientation="horizontal" collapsedSize={0}>
              <Typography sx={{ fontWeight: 600, fontSize: '18px', marginBottom: '8px', paddingLeft: '4px' }}>
                Legend
              </Typography>
            </Collapse>
            <IconButton onClick={() => setLegendVisible((prev) => !prev)} size="small">
              {legendVisible ? <KeyboardArrowLeftIcon /> : <KeyboardArrowRightIcon />}
            </IconButton>
          </div>
          <Collapse in={legendVisible} orientation="horizontal" collapsedSize={0}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', width: '330px' }}>
              {legendSchema?.nodes?.map((item) => (
                <LegendItem key={item.name} label={item.name} color={item.color} />
              ))}
              {legendSchema?.edges?.map((item) => (
                <LegendItem key={item.name} label={item.name} sx={{ border: `1px solid ${item.color}`, color: item.color, backgroundColor: 'white' }} />
              ))}
            </div>
          </Collapse>
        </div>
      </div>
    </div>
  );
}