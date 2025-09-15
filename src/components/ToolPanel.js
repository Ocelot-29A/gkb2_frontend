import React, {
  useEffect,
  useState,
} from 'react';

import { NestedMenuItem } from 'mui-nested-menu';

import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Button,
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

const entityTypes = [
  { label: "Gene", color: "#dbeafe" },
  { label: "Other Coding Element", color: "#bfdbfe" },
  { label: "Non Coding Element", color: "#e9d5ff" },
  { label: "Variants", color: "#bbf7d0" },
  { label: "ThreeD Structure", color: "#fde68a" },
  { label: "Chromatin Organization", color: "#fed7aa" },
  { label: "Ontology Term (GO, CL...)", color: "#fecaca" },
];

const commonTypes = [
  { label: "Gene", color: "#dbeafe" },
  { label: "Other Coding Element", color: "#bfdbfe" },
  { label: "Non Coding Element", color: "#e9d5ff" },
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
          handleAddNode({ label: entity.label, color: entity.color });
        }}
      >
        <ListItemIcon sx={{ minWidth: '0px' }}>
          <Box
            sx={{
              width: "16px",
              height: "16px",
              backgroundColor: entity.color,
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
                    backgroundColor: entity.color,
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



export function BioEntityPanel({ handleAddNode, handleChangeMode }) {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    handleChangeMode(tab === 1);
  }, [tab, handleChangeMode]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  return (
    <Paper elevation={3} sx={{
      background: '#F4F9FF',
      width: '340px',
      borderRadius: '10px',
      border: '1px solid #7F7D7D',
      overflow: 'hidden',
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
        <Tab label="Add Node" />
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
                      backgroundColor: entity.color,
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
                  <IconButton edge="end" size="small" color="primary" onClick={() => handleAddNode({ label: entity.label, color: entity.color })}>
                    <AddIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Edge Content Placeholder
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Similar structure as Add Node can go here.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export function InfoPanel({ selectedNode }) {
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

  const label = (selectedNode && selectedNode.length) ? (
    selectedNode.slice(0, 2).map((node) => (node.label)).join(", ") +
    (selectedNode.length > 2 ? ", ..." : "")
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
        Selected Node
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


