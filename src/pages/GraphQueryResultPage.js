import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import Cytoscape from 'cytoscape';
import { useDispatch } from 'react-redux';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import InfoIcon from '@mui/icons-material/Info';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';

import {
  typeToTypeList,
  typeToVisu,
} from '../components/ToolPanel';
import { queryOnPrem } from '../redux/onPremSlice';
import NodeColors from '../schema/node_color.json';

const edgeLabels = {
  OCR_in_cell_type: "accessible in",
  OCR_locate_in: "located in",
  express_in: "expressed in",
  function_annotation: "has function",
  fine_mapped_eQTL: "QTL for",
  regulation: "interact with",
};

const GraphViewer = ({ query, onStatsUpdate, onNodeDataUpdate, onNodeSelect, selectedNodeId, nodeFilters }) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    // Load example data
    const loadExampleData = async () => {
      try {
        // const [resultResponse, positionResponse] = await Promise.all([
        //   fetch('/example_result.json').then(res => res.json()),
        //   fetch('/example_x_y.json').then(res => res.json())
        // ]);
        const resultResponse = await dispatch(queryOnPrem({ query })).then(res2 => {
          const result = res2.payload.result || [];
          return result;
        });
        const positionResponse = {};


        const result = resultResponse.results[0];
        const positionData = positionResponse;

        const uniqueNodesMap = {};
        result.nodes.forEach((node) => (uniqueNodesMap[node["~id"]] = node));
        const nodes = Object.values(uniqueNodesMap).map((node) => {
          const type = node["~labels"].find((label) => NodeColors[label]) || "coding_elements";
          const posData = positionData[node["~id"]] || {
            x: Math.random() * 400 - 200,
            y: Math.random() * 300 - 150,
            Level: "Core",
          };
          const pos = {
            x: posData.x * 1.5,
            y: posData.y * 1.5
          };
          return {
            data: {
              id: node["~id"],
              ...node["~properties"],
              label: (
                node["~labels"].includes("disease") || node["~labels"].includes("ontology")
                  ? node["~properties"].id
                  : (node["~labels"].includes("gene") || node["~labels"].includes("coding_elements"))
                    ? (node["~properties"].name || node["~properties"].id)
                    : node["~properties"].id
              ),
              type,
              labels: node["~labels"],
              Level: posData.Level,
              color: NodeColors[type] || NodeColors[typeToTypeList(type)?.[0]] || "#CCCCCC",
            },
            position: pos,
          };
        });

        const uniqueEdgesMap = {};
        result.edges.forEach((edge, index) => (uniqueEdgesMap[edge["~id"] || index.toString()] = edge));
        const edges = Object.values(uniqueEdgesMap).map((edge) => ({
          data: {
            id: edge["~id"],
            source: edge["~start"],
            target: edge["~end"],
            type: edge["~type"],
            label: edgeLabels[edge["~type"]] || edge["~type"].replace(/_/g, " "),
            ...edge["~properties"],
          },
        }));

        if (cyRef.current) {
          cyRef.current.destroy();
        }

        cyRef.current = Cytoscape({
          container: containerRef.current,
          elements: { nodes, edges },
          style: [
            {
              selector: 'node',
              style: {
                shape: "round-rectangle",
                "background-color": "data(color)",
                "border-width": "1px",
                "border-color": "data(color)",
                label: "data(label)",
                "font-size": "11px",
                "text-valign": "center",
                "text-halign": "center",
                color: "black",
                width: "label",
                height: "label",
                "text-margin-y": "0px",
                padding: "6px",
                "text-outline-width": 0,
                "text-outline-color": "#fff",
                "text-outline-opacity": 0,
                "min-width": "50px",
                "min-height": "30px",
                "text-max-width": "80px",
                "text-wrap": "wrap",
                "text-overflow-wrap": "anywhere",
              }
            },
            {
              selector: 'edge',
              style: {
                width: 3,
                "line-color": "#666",
                "target-arrow-color": "#666",
                "target-arrow-shape": "triangle",
                "target-arrow-size": "8px",
                "curve-style": "bezier",
                "label": (edge) => typeToVisu(edge.data().type || edge.data().label),
                "font-size": "9px",
                "text-background-opacity": 0.9,
                "text-background-color": "#fff",
                "text-background-padding": "3px",
                "text-background-shape": "roundrectangle",
                "color": "#333",
                "text-rotation": "autorotate",
                "text-margin-y": -12,
                "text-border-width": 1,
                "text-border-color": "#ddd",
              }
            },
            {
              selector: 'node[Level = "Core"]',
              style: {
                "background-color": "data(color)",
                "border-color": "data(color)",
                color: "black",
              }
            },
            {
              selector: 'node[Level = "Neighbor"]',
              style: {
                "border-color": "data(color)",
                color: "#333",
                "background-color": "white",
              }
            },
            {
              selector: 'node.highlighted',
              style: {
                "border-width": "4px",
                "border-color": "#ff6b6b",
                "background-color": "data(color)",
                "z-index": 999,
                "width": "label",
                "height": "label",
                "min-width": "60px",
                "min-height": "35px",
                "font-size": "12px",
                "font-weight": "bold"
              }
            }
          ],
          layout: { name: "preset" },
          zoom: 0.8,
          minZoom: 0.5,
          maxZoom: 2.5,
          pan: { x: 0, y: 0 },
        });

        const layout = cyRef.current.layout({
          name: 'cose',
          idealEdgeLength: 100,
          nodeOverlap: 20,
          refresh: 20,
          fit: true,
          padding: 30,
          randomize: false,
          componentSpacing: 100,
          nodeRepulsion: 400000,
          edgeElasticity: 100,
          nestingFactor: 5,
          gravity: 80,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0
        });

        layout.run();

        setTimeout(() => {
          cyRef.current.reset();
          cyRef.current.center();
        }, 100);

        cyRef.current.on('tap', 'node', (event) => {
          const node = event.target;
          const nodeId = node.id();

          cyRef.current.elements().removeClass('highlighted');
          node.addClass('highlighted');

          if (onNodeSelect) {
            onNodeSelect(nodeId, node.data());
          }
        });

        cyRef.current.on('tap', (event) => {
          if (event.target === cyRef.current) {
            cyRef.current.elements().removeClass('highlighted');
            if (onNodeSelect) {
              onNodeSelect(null, null);
            }
          }
        });

        if (onStatsUpdate) {
          onStatsUpdate({
            nodes: nodes.length,
            edges: edges.length
          });
        }

        if (onNodeDataUpdate) {
          onNodeDataUpdate(nodes);
        }

      } catch (error) {
        console.error('Error loading example data:', error);
      }
    };

    loadExampleData();

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.elements().removeClass('highlighted');

      if (selectedNodeId) {
        const selectedNode = cyRef.current.getElementById(selectedNodeId);
        if (selectedNode.length > 0) {
          selectedNode.addClass('highlighted');
        }
      }
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (cyRef.current && nodeFilters) {
      cyRef.current.elements().forEach(element => {
        if (element.isNode()) {
          const nodeData = element.data();
          const labels = nodeData.labels || [];

          let category = null;
          if (labels.includes('gene') || labels.includes('coding_elements')) {
            category = 'gene';
          } else if (labels.includes('sequence_variant') || labels.includes('variants') ||
            labels.includes('sequence_SNP') || labels.includes('sequence_insertion')) {
            category = 'sequence_variant';
          } else if (labels.includes('ontology') || labels.includes('disease') ||
            labels.includes('phenotype_or_disease')) {
            category = 'ontology';
          }

          if (category && nodeFilters[category] === false) {
            element.style('display', 'none');
          } else {
            element.style('display', 'element');
          }
        }
      });

      cyRef.current.elements().forEach(element => {
        if (element.isEdge()) {
          const source = element.source();
          const target = element.target();

          if (source.style('display') === 'none' || target.style('display') === 'none') {
            element.style('display', 'none');
          } else {
            element.style('display', 'element');
          }
        }
      });
    }
  }, [nodeFilters]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "500px",
        borderRadius: "8px",
      }}
    />
  );
};

export default function GraphQueryResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });
  const [nodeData, setNodeData] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [nodeFilters, setNodeFilters] = useState({});
  const [availableNodeTypes, setAvailableNodeTypes] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryParam = params.get('query');
    if (queryParam) {
      setQuery(decodeURIComponent(queryParam));
    }
  }, [location.search]);

  const handleBackToQuery = () => {
    navigate('/graphquery');
  };

  const handleFilterChange = (filterName) => {
    setNodeFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleNodeSelect = (nodeId, nodeData) => {
    setSelectedNodeId(nodeId);

    if (nodeId && nodeData) {
      const labels = nodeData.labels || [];
      let category = null;

      if (labels.includes('gene') || labels.includes('coding_elements')) {
        category = 'gene';
      } else if (labels.includes('sequence_variant') || labels.includes('variants') ||
        labels.includes('sequence_SNP') || labels.includes('sequence_insertion')) {
        category = 'sequence_variant';
      } else if (labels.includes('ontology') || labels.includes('disease') ||
        labels.includes('phenotype_or_disease')) {
        category = 'ontology';
      }

      if (category) {
        setExpandedCategories(prev => ({
          ...prev,
          [category]: true
        }));

        setTabValue(0);
      }
    } else {
      setSelectedNodeId(null);
    }
  };

  const categorizeNodes = (nodes) => {
    const categories = {
      'gene': [],
      'sequence_variant': [],
      'ontology': []
    };

    nodes.forEach(node => {
      const labels = node.data.labels || [];

      if (labels.includes('gene') || labels.includes('coding_elements')) {
        categories['gene'].push(node);
      }
      else if (labels.includes('sequence_variant') || labels.includes('variants') ||
        labels.includes('sequence_SNP') || labels.includes('sequence_insertion')) {
        categories['sequence_variant'].push(node);
      }
      else if (labels.includes('ontology') || labels.includes('disease') ||
        labels.includes('phenotype_or_disease')) {
        categories['ontology'].push(node);
      }
    });

    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  };

  const categorizedNodes = categorizeNodes(nodeData);

  const generateAvailableNodeTypes = (nodes) => {
    const typeMap = new Map();

    nodes.forEach(node => {
      const labels = node.data.labels || [];

      let category = null;
      let displayName = null;
      let color = null;

      if (labels.includes('gene') || labels.includes('coding_elements')) {
        category = 'gene';
        displayName = 'Gene';
        color = '#dbeafe';
      } else if (labels.includes('sequence_variant') || labels.includes('variants') ||
        labels.includes('sequence_SNP') || labels.includes('sequence_insertion')) {
        category = 'sequence_variant';
        displayName = 'Sequence Variant';
        color = '#bbf7d0';
      } else if (labels.includes('ontology') || labels.includes('disease') ||
        labels.includes('phenotype_or_disease')) {
        category = 'ontology';
        displayName = 'Ontology';
        color = '#fecaca';
      }

      if (category && !typeMap.has(category)) {
        typeMap.set(category, {
          key: category,
          label: displayName,
          color: color,
          count: 0
        });
      }

      if (category) {
        typeMap.get(category).count++;
      }
    });

    return Array.from(typeMap.values());
  };

  useEffect(() => {
    if (nodeData.length > 0) {
      const types = generateAvailableNodeTypes(nodeData);
      setAvailableNodeTypes(types);

      const initialFilters = {};
      types.forEach(type => {
        initialFilters[type.key] = true;
      });
      setNodeFilters(initialFilters);
    }
  }, [nodeData]);

  useEffect(() => {
    if (selectedNodeId) {
    }
  }, [selectedNodeId]);

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{
        backgroundColor: '#E3F2FD',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid #BBDEFB'
      }}>
        <InfoIcon sx={{ color: '#1976D2', fontSize: '20px' }} />
        <Typography sx={{
          fontSize: '14px',
          color: '#1976D2',
          fontWeight: 500
        }}>
          Only partial results are visualized. Full results can be downloaded via 'Export All'.
        </Typography>
      </Box>
      <Box sx={{
        flex: 1,
        display: 'flex',
        padding: '20px',
        gap: '20px'
      }}>
        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <Paper sx={{
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <Box sx={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {availableNodeTypes.map((nodeType) => (
                <FormControlLabel
                  key={nodeType.key}
                  control={
                    <Switch
                      checked={nodeFilters[nodeType.key] || false}
                      onChange={() => handleFilterChange(nodeType.key)}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Box
                        sx={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '2px',
                          backgroundColor: nodeType.color
                        }}
                      />
                      <Typography sx={{
                        fontSize: '14px',
                        fontWeight: 500
                      }}>
                        {nodeType.label}
                      </Typography>
                      <Typography sx={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>
                        ({nodeType.count})
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
            <Button
              variant="contained"
              startIcon={<FileDownloadIcon />}
              sx={{
                backgroundColor: '#1976D2',
                '&:hover': {
                  backgroundColor: '#1565C0',
                },
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Export
            </Button>
          </Paper>

          <Paper sx={{
            flex: 1,
            minHeight: '500px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <Box sx={{
              width: '100%',
              height: '100%',
              position: 'relative'
            }}>
              <GraphViewer query={query} onStatsUpdate={setGraphStats} onNodeDataUpdate={setNodeData} onNodeSelect={handleNodeSelect} selectedNodeId={selectedNodeId} nodeFilters={nodeFilters} />

              <Box sx={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '8px 16px',
                borderRadius: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <Typography sx={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#333'
                }}>
                  Displaying {graphStats.nodes} nodes, {graphStats.edges} edges
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

        <Paper sx={{
          width: '350px',
          height: 'fit-content',
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Node/Edge Details" />
              <Tab label="Node List" />
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {tabValue === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Dynamic Node/Edge Details Accordions */}
                {Object.entries(categorizedNodes).map(([type, nodes]) => (
                  <Accordion
                    key={type}
                    expanded={expandedCategories[type] || false}
                    onChange={(event, isExpanded) => {
                      setExpandedCategories(prev => ({
                        ...prev,
                        [type]: isExpanded
                      }));
                    }}
                    sx={{ boxShadow: 'none' }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        minHeight: '40px',
                        '&.Mui-expanded': {
                          minHeight: '40px',
                        },
                        '& .MuiAccordionSummary-content': {
                          margin: '8px 0',
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <Chip
                          label={type === 'gene' ? 'Gene' : type === 'sequence_variant' ? 'Sequence Variant' : 'Ontology'}
                          size="small"
                          sx={{
                            textTransform: 'capitalize',
                            fontSize: '12px',
                            backgroundColor: type === 'gene' ? '#dbeafe' : type === 'sequence_variant' ? '#bbf7d0' : '#fecaca',
                            color: 'black',
                            fontWeight: 600
                          }}
                        />
                        <Typography sx={{ fontSize: '14px', fontWeight: 500, flex: 1 }}>
                          {type === 'gene' ? 'gene' : type === 'sequence_variant' ? 'sequence variant' : 'ontology'}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#666' }}>
                          ({nodes.length})
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ padding: '8px 16px 16px' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {nodes.map((node, index) => (
                          <Box key={index} sx={{
                            padding: '8px',
                            backgroundColor: selectedNodeId === node.data.id ? '#e3f2fd' : '#f5f5f5',
                            borderRadius: '4px',
                            border: selectedNodeId === node.data.id ? '2px solid #2196f3' : '1px solid #e0e0e0',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: selectedNodeId === node.data.id ? '#e3f2fd' : '#eeeeee',
                            }
                          }}
                            onClick={() => {
                              setSelectedNodeId(node.data.id);
                            }}
                          >
                            <Typography sx={{
                              fontSize: '12px',
                              fontWeight: selectedNodeId === node.data.id ? 700 : 600,
                              marginBottom: '4px',
                              color: selectedNodeId === node.data.id ? '#1976d2' : 'inherit'
                            }}>
                              {node.data.label}
                            </Typography>
                            <Typography sx={{ fontSize: '10px', color: '#666' }}>
                              ID: {node.data.id}
                            </Typography>
                            {node.data.description && (
                              <Typography sx={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                                {node.data.description.length > 50
                                  ? `${node.data.description.substring(0, 50)}...`
                                  : node.data.description
                                }
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}

            {tabValue === 1 && (
              <Box>
                <Typography sx={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>
                  Node List
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {nodeData.map((node, index) => (
                    <Box key={index} sx={{
                      padding: '12px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      border: '1px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Chip
                        label={(() => {
                          const labels = node.data.labels || [];
                          if (labels.includes('gene') || labels.includes('coding_elements')) return 'Gene';
                          if (labels.includes('sequence_variant') || labels.includes('variants') ||
                            labels.includes('sequence_SNP') || labels.includes('sequence_insertion')) return 'Sequence Variant';
                          if (labels.includes('ontology') || labels.includes('disease') ||
                            labels.includes('phenotype_or_disease')) return 'Ontology';
                          return 'Other';
                        })()}
                        size="small"
                        sx={{
                          textTransform: 'capitalize',
                          fontSize: '10px',
                          backgroundColor: (() => {
                            const labels = node.data.labels || [];
                            if (labels.includes('gene') || labels.includes('coding_elements')) return '#dbeafe';
                            if (labels.includes('sequence_variant') || labels.includes('variants') ||
                              labels.includes('sequence_SNP') || labels.includes('sequence_insertion')) return '#bbf7d0';
                            if (labels.includes('ontology') || labels.includes('disease') ||
                              labels.includes('phenotype_or_disease')) return '#fecaca';
                            return '#e0e0e0';
                          })(),
                          color: 'black',
                          fontWeight: 600
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                          {node.data.label}
                        </Typography>
                        <Typography sx={{ fontSize: '10px', color: '#666' }}>
                          {node.data.id}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
