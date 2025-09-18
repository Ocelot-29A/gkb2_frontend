import React, {
  useEffect,
  useState,
} from 'react';

import { NestedMenuItem } from 'mui-nested-menu';

import {
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

import EdgeSchema from '../schema/clean_edge_schema.json';
import NodeSchema from '../schema/clean_node_schema.json';
import NodeColors from '../schema/node_color.json';

// Utility functions
export const getLabel = (data) => {
  return typeToVisu(data.edgeType) || data.name || data.nodeId || typeToVisu(data.nodeType) || data.id;
}

export function typeToVisu(type) {
  if (!type) return undefined;
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

export function typeToTypeList(type) {
  function findPath(node, target, path = []) {
    if (node.label.toLowerCase() === target.toLowerCase()) {
      return [...path, node.label];
    }

    if (node.children) {
      for (const child of node.children) {
        const result = findPath(child, target, [...path, node.label]);
        if (result) return result;
      }
    }

    return null;
  }
  return findPath(NodeSchema, type)?.slice(1) || [];
}

export function isType(type) {
  return !!typeToTypeList(type).length;
}

export function typeListToType(types) {
  const typeSet = new Set(types);

  function dfs(node) {
    if (node.children) {
      for (const child of node.children) {
        const res = dfs(child);
        if (res) return res;
      }
    }

    if (typeSet.has(node.label)) {
      return node.label;
    }

    return null;
  }

  return dfs(NodeSchema);
}


function typeIncludes(supertype, subtype) {
  if (supertype?.[0] === '~') return !typeIncludes(supertype.slice(1), subtype);
  if (subtype === supertype) return true;
  const path = typeToTypeList(subtype);
  return path.includes(supertype);
}

export function getEdges(nodeTypeFrom, nodeTypeTo) {
  return Object.keys(EdgeSchema).filter((edgeType) => {
    const edge = EdgeSchema[edgeType];
    return typeIncludes(edge.from, nodeTypeFrom) &&
      typeIncludes(edge.to, nodeTypeTo);
  });
}

// Component
export default function NodeTypeSelector({ superType, handleChangeType, defaultType, typeConstraint = [] }) {
  const [selected, setSelected] = useState(defaultType);
  const [openNodes, setOpenNodes] = useState({}); // track open/close per node

  useEffect(() => {
    setSelected(defaultType);
    setOpenNodes(Object.fromEntries(typeToTypeList(defaultType).slice(0, -1).map(t => [t, true])));
  }, [defaultType]);

  useEffect(() => {
    handleChangeType(selected);
  }, [selected, handleChangeType]);

  const rootNode = NodeSchema.children.find(c => c.label === superType);
  if (!rootNode) return <Typography>Invalid type: {superType}</Typography>;

  const handleToggle = (label) => {
    setOpenNodes(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleSelect = (label) => {
    setSelected(label);
  };

  const renderNode = (node, indent = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isOpen = !!openNodes[node.label];
    const disabled = typeConstraint.map(t => typeIncludes(t, node.label)).includes(false);

    return (
      <Box key={node.label}>
        <Box sx={{ display: 'flex', alignItems: 'center', pl: indent * 2 }}>
          {hasChildren ? (
            <IconButton size="small" onClick={() => handleToggle(node.label)}>
              {isOpen ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          ) : <Box sx={{ width: 34 }} />} {/* Placeholder for alignment */}
          <Checkbox
            checked={selected === node.label}
            onChange={() => handleSelect(node.label)}
            icon={<RadioButtonUncheckedIcon />}
            checkedIcon={<CheckCircleIcon />}
            disabled={disabled}
          />
          <Typography sx={{ color: disabled ? 'text.disabled' : 'text.primary' }}>{typeToVisu(node.label)}</Typography>
        </Box>
        {hasChildren && (
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            {node.children.map((child) => renderNode(child, indent + 1))}
          </Collapse>
        )}
      </Box>
    );
  };

  return <Box>{renderNode(rootNode)}</Box>;
}

export function NodeLabelPopup({ open, cyEle, nodeTypes, onClose, onConfirm }) {
  const [inputProperty, setInputProperty] = useState({
    label: cyEle?.label || "",
    _label: cyEle?._label || "",
  });

  const [typeConstraint, setTypeConstraint] = useState([]);
  useEffect(() => {
    if (nodeTypes) {
      const types =
        [
          ...nodeTypes.inEdgeTypes.map(et => EdgeSchema[et]?.to).filter(t => !!t),
          ...nodeTypes.outEdgeTypes.map(et => EdgeSchema[et]?.from).filter(t => !!t),
        ]
          .filter((value, index, self) => self.indexOf(value) === index);
      setTypeConstraint(types);
    } else {
      setTypeConstraint([]);
    }
  }, [nodeTypes]);

  // Update input when cyEle changes
  React.useEffect(() => {
    if (cyEle) {
      setInputProperty({
        label: cyEle.label || "",
        _label: cyEle._label || "",
      });
    }
  }, [cyEle, open]);

  const handleConfirm = () => {
    const newNode = {
      ...cyEle,
      ...inputProperty
    };
    onConfirm(newNode);
  };

  const superType = typeToTypeList(cyEle?.nodeType || "")[0] || "Entity";

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Edit Node</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Set the type of the node.
        </DialogContentText>
        <NodeTypeSelector superType={superType} defaultType={cyEle?.nodeType} handleChangeType={(newType) => {
          setInputProperty((prev) => ({ ...prev, nodeType: newType }));
        }} typeConstraint={typeConstraint} />
        <DialogContentText>
          Edit the name of the node. (WIP)
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          label="Node Label"
          type="text"
          fullWidth
          value={inputProperty.label}
          onChange={(e) => setInputProperty((prev) => ({ ...prev, label: e.target.value }))}
        />
        <TextField
          autoFocus
          margin="dense"
          label="Node Label 2"
          type="text"
          fullWidth
          value={inputProperty._label}
          onChange={(e) => setInputProperty((prev) => ({ ...prev, _label: e.target.value }))}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Quit
        </Button>
        <Button
          onClick={() => {
            handleConfirm();
            onClose();
          }}
          color="primary"
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function EdgeTypeSelector({ sourceType, targetType, handleChangeType, defaultType }) {
  console.log("EdgeTypeSelector", sourceType, targetType, defaultType);
  const [selected, setSelected] = useState(defaultType);
  const [typeList, setTypeList] = useState([]);

  useEffect(() => {
    setSelected(defaultType);
  }, [defaultType]);

  useEffect(() => {
    const edges = getEdges(sourceType, targetType);
    setTypeList(edges);
  }, [sourceType, targetType]);

  useEffect(() => {
    handleChangeType(selected);
  }, [selected, handleChangeType]);

  if (!EdgeSchema[defaultType]) return <Typography>Invalid type: {defaultType}</Typography>;

  const handleSelect = (label) => {
    setSelected(label);
  };

  return <Box>
    {typeList.map((edgeType) => (
      <Box sx={{ display: 'flex', alignItems: 'center', pl: 0 }}>
        <Checkbox
          checked={selected === edgeType}
          onChange={() => handleSelect(edgeType)}
          icon={<RadioButtonUncheckedIcon />}
          checkedIcon={<CheckCircleIcon />}
        />
        <Typography>{typeToVisu(edgeType)}</Typography>
      </Box>
    ))}
  </Box>;
}

export function EdgeLabelPopup({ open, cyEle, edgeTypes, onClose, onConfirm }) {
  const [inputProperty, setInputProperty] = useState({});

  const handleConfirm = () => {
    const newNode = {
      ...cyEle,
      ...inputProperty
    };
    onConfirm(newNode);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Edit Node</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Set the type of the node.
        </DialogContentText>
        <EdgeTypeSelector
          sourceType={edgeTypes.sourceType}
          targetType={edgeTypes.targetType}
          defaultType={cyEle?.edgeType}
          handleChangeType={(newType) => {
            setInputProperty((prev) => ({ ...prev, edgeType: newType }));
          }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Quit
        </Button>
        <Button
          onClick={() => {
            handleConfirm();
            onClose();
          }}
          color="primary"
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}


const entityTypes = [
  { "label": "Gene", "type": "gene" },

  { "label": "Other Coding Element", "type": "coding_elements" },

  { "label": "Non Coding Element", "type": "non_coding_elements" },

  { "label": "Variants", "type": "variants" },

  { "label": "ThreeD Structure", "type": "threeD_structures" },

  { "label": "Chromatin Organization", "type": "epigenomic_features" },

  { "label": "Ontology Term (GO, CL...)", "type": "ontology" }
]


const commonTypes = [
  { label: "Gene", type: "gene" },
  { label: "Other Coding Element", type: "coding_elements" },
  { label: "Non Coding Element", type: "non_coding_elements" },
  { label: "All Entities", color: "#F566AC" },
];

export function FunctionButton(props) {
  // Helper to add blue color to startIcon if present in props
  const { startIcon, sx, ...restProps } = props;
  const blueStartIcon = startIcon
    ? React.cloneElement(startIcon, {
      sx: { color: "#437AE1", fontSize: "24px !important", ...(startIcon.props.sx || {}) }
    })
    : undefined;

  return (
    <Button
      sx={{
        borderRadius: "8px",
        padding: "6px 14px",
        border: "1px solid #D1D5DB",
        background: "#fff",
        height: "43px",
        textTransform: "none",
        fontFamily: "Inter",
        fontSize: "14px",
        fontWeight: "500",
        color: "black",
        ...sx
      }}
      startIcon={blueStartIcon}
      {...restProps}
    >
      {props.children}
    </Button>
  );
}

export function FunctionButton2(props) {
  // Helper to add blue color to startIcon if present in props
  const { startIcon, disabled, sx, ...restProps } = props;
  const blueStartIcon = startIcon
    ? React.cloneElement(startIcon, {
      sx: { color: "#437AE1", fontSize: "24px !important", ...(startIcon.props.sx || {}) }
    })
    : undefined;

  return (
    <Button
      disabled={disabled}
      sx={{
        height: "44px",
        width: "165px",
        borderRadius: "22px",
        background: disabled ? "linear-gradient(90.46deg, rgba(112, 134, 253, 0.3) 0.44%, rgba(70, 99, 254, 0.3) 99.65%)" : "linear-gradient(90.46deg, #7086FD 0.44%, #4663FE 99.65%)",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white !important',
        textTransform: "none",
        fontFamily: 'Inter',
        fontSize: '20px',
        fontWeight: 600,
        boxShadow: "0px 2px 3.1px 0px #B9B9B933",
        ...sx
      }}
      startIcon={blueStartIcon}
      {...restProps}
    >
      {props.children}
    </Button>
  );
}

export function AddNodeButton({ handleAddNode }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const NodeMenuItem = ({ entity }) => {
    return (
      <MenuItem
        onClick={() => {
          handleClose();
          handleAddNode({ nodeType: entity.type, color: entity.color || NodeColors[entity.type] || "#000000" });
        }}
      >
        <ListItemIcon sx={{ minWidth: '0px' }}>
          <Box
            sx={{
              width: "16px",
              height: "16px",
              backgroundColor: entity.color || NodeColors[entity.type] || "#000000",
              borderRadius: "2px",
              marginRight: "8px",
            }}
          />
        </ListItemIcon>
        <ListItemText primary={entity.label} />
      </MenuItem>
    );
  }

  const Subheader = (props) => {
    return (
      <ListSubheader sx={{
        textTransform: "uppercase",
        lineHeight: "25px",
        fontFamily: "Inter",
        fontWeight: "700",
        fontSize: "11px",
        color: "#A3A3A8",
        paddingLeft: "10px"
      }}>
        {props.children}
      </ListSubheader>
    );
  };

  return (
    <div>
      <FunctionButton
        onClick={handleClick}
        startIcon={<AddIcon sx={{ color: "black" }} />}
        sx={{
          backgroundColor: "#E2EEFF",
          "&:hover": {
            backgroundColor: "#C8E7FF",
          }
        }}
      >
        Add Node
      </FunctionButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <Subheader>Frequently Used</Subheader>
        {
          commonTypes.filter(entity => entity.label !== "All Entities").map((entity, i) => (
            <NodeMenuItem key={i} entity={entity} />
          ))
        }
        <Subheader>All Types</Subheader>
        {
          commonTypes.filter(entity => entity.label === "All Entities").map((entity, i) => (
            <NestedMenuItem
              key={i}
              label={entity.label}
              parentMenuOpen={open}
              leftIcon={
                <Box
                  sx={{
                    alignSelf: "center",
                    mx: "12px",
                    width: "16px",
                    height: "16px",
                    backgroundColor: entity.color || NodeColors[entity.type] || "#000000",
                    borderRadius: "2px",
                  }}
                />
              }
            >
              {entityTypes.map((subEntity, j) => (
                <NodeMenuItem key={j} entity={subEntity} />
              ))}
            </NestedMenuItem>
          ))
        }
      </Menu>
    </div>
  );
}


export function BioEntityPanel({ handleAddNode, handleAddEdge, currSourceTarget, handleChangeMode }) {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    handleChangeMode(tab === 1);
  }, [tab, handleChangeMode]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  return (
    <>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 999,
        mouseEvents: 'none',
        display: currSourceTarget.isDrag ? 'block' : 'none'
      }}>
      </div>
      <Paper elevation={3} sx={{
        background: '#F4F9FF',
        width: '340px',
        borderRadius: '10px',
        overflow: 'hidden',
        zIndex: 1000,
        border: '1px solid #E5E7EB',
        boxShadow: '0px 2px 12px 0px #00000014'
      }}>
        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={handleTabChange}
          centered
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          sx={{
            mb: 2,
            //make not chosen tab's background color light gray
            "& .MuiTab-root": {
              backgroundColor: "#C8E7FF",
            },
            "& .Mui-selected": {
              backgroundColor: "white",
            },
          }}
        >
          <Tab label="Add Node" disabled={currSourceTarget.isDrag} />
          <Tab label="Add Edge" />
        </Tabs>

        {/* Tab content */}
        {tab === 0 && (
          <Box sx={{ px: "20px" }}>
            {/* Quick Add */}
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, mt: 2, mb: 1 }}
            >
              Quick Add Entity
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
              If you know the specific Entity, search and add directly.
            </Typography>

            <TextField
              placeholder="Search for specific bio entity"
              fullWidth
              size="small"
              sx={{ mb: 1, backgroundColor: "white" }}
            />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Example: CFTR, TP53
            </Typography>

            {/* Bio Entity List */}
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Bio Entity List
            </Typography>
            <Typography sx={{ fontFamily: "Inter", fontSize: "14px", fontWeight: 500, color: "#6B7280" }}>
              If you can choose about the specific entity, add a general bio
              entity from the list.
            </Typography>

            <List dense>
              {entityTypes.map((entity, i) => (
                <ListItem
                  key={i}
                  sx={{
                    backgroundColor: "white",
                    borderRadius: 2,
                    mb: 1,
                    py: 1,
                    px: 2,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: '0px' }}>
                    {/* add a square of the same color as the entity using box */}
                    <Box
                      sx={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: entity.color || NodeColors[entity.type] || "#000000",
                        borderRadius: "2px",
                        marginRight: "8px",
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={entity.label}
                    primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" color="primary"
                      onClick={
                        () => handleAddNode({
                          nodeType: entity.type,
                          color: entity.color || NodeColors[entity.type] || "#000000"
                        })
                      }>
                      <AddIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ px: "20px" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Edge Content Placeholder
            </Typography>
            {
              currSourceTarget.source && currSourceTarget.target ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    Add edge from <strong>{getLabel(currSourceTarget.source)}</strong> to <strong>{getLabel(currSourceTarget.target)}</strong>
                  </Typography>
                  {getEdges(currSourceTarget.source.nodeType, currSourceTarget.target.nodeType).length ? (
                    <List dense>
                      {getEdges(currSourceTarget.source.nodeType, currSourceTarget.target.nodeType).map((edgeType, i) => (
                        <ListItem
                          key={i}
                          sx={{
                            backgroundColor: "white",
                            borderRadius: 2,
                            mb: 1,
                            py: 1,
                            px: 2,
                            height: "40px",
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box
                                sx={{
                                  display: "flex",
                                  position: "relative",
                                  alignItems: "center",
                                  backgroundColor: "white", // prevent interference
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1,
                                  minWidth: 200, // longer width
                                }}
                              >
                                <Typography
                                  sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    ml: 1,
                                    whiteSpace: "nowrap",
                                    position: "absolute",
                                    left: "0",
                                  }}
                                >
                                  {"───────────────────▶"}
                                </Typography>
                                <Typography
                                  sx={{
                                    display: "flex",
                                    position: "absolute",
                                    left: "37%",
                                    transform: "translateX(-50%)",
                                    fontSize: 14,
                                    fontWeight: 500,
                                    flexGrow: 1,
                                    backgroundColor: "white"
                                  }}
                                >
                                  {typeToVisu(edgeType)}
                                </Typography>

                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            <IconButton edge="end" size="small" color="primary"
                              onClick={
                                () => handleAddEdge(
                                  currSourceTarget.source,
                                  currSourceTarget.target,
                                  edgeType
                                )
                              }>
                              <AddIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      No edges available.
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No source or target selected.
                </Typography>
              )}

          </Box>
        )}
      </Paper>
    </>
  );
}

export function InfoPanel({ selected }) {
  // print the first two labels, add ", ..." if more
  // let label = "";
  // if (selectedNode) {
  //   if (Array.isArray(selectedNode.label)) {
  //     const labels = selectedNode.label;
  //     label = selectedNode.slice(0, 2).join(", ");
  //     if (labels.length > 2) {
  //       label += ", ...";
  //     }
  //   } else {
  //     label = selectedNode.label;
  //   }
  // }

  const label = (selected && selected.length) ? (
    selected.slice(0, 2).map((node) => (getLabel(node))).join(", ") +
    (selected.length > 2 ? ", ..." : "")
  ) : <span style={{ color: "#6B7280" }}>None</span>

  return (
    <Box sx={{ marginLeft: "20px", }}>
      <Typography
        sx={{
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: "18px",
          lineHeight: "25px",
        }}
      >
        Selected Node(s) and/or Edge(s):
      </Typography>
      <Typography sx={{
        fontFamily: "Inter",
        fontWeight: 400,
        fontSize: "16px",
        lineHeight: "25px",
      }}>
        {label}
      </Typography>
    </Box>
  );
}


