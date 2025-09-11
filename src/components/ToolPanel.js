import React, { useEffect, useState } from "react";
import {
  Tabs,
  Tab,
  Box,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Paper,
  ListItemIcon,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

const entityTypes = [
  { label: "Gene", color: "#dbeafe" },
  { label: "Other Coding Element", color: "#bfdbfe" },
  { label: "Non Coding Element", color: "#e9d5ff" },
  { label: "Variants", color: "#bbf7d0" },
  { label: "ThreeD Structure", color: "#fde68a" },
  { label: "Chromatin Organization", color: "#fed7aa" },
  { label: "Ontology Term (GO, CL...)", color: "#fecaca" },
];

export default function BioEntityPanel({handleAddNode, handleChangeMode}) {
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
                  <IconButton edge="end" size="small" color="primary" onClick={() => handleAddNode({label:entity.label, color: entity.color})}>
                    <AddIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>

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
