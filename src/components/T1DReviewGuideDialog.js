import React from 'react';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

const sectionSx = { marginBottom: '16px' };
const headingSx = { color: '#24493F', fontSize: '15px', fontWeight: 700, marginBottom: '5px' };
const bodySx = { color: '#4B5D57', fontSize: '14px', lineHeight: 1.6 };

export default function T1DReviewGuideDialog({ open, onClose }) {
  const contact = process.env.REACT_APP_CONTACT_EMAIL || 'T1D Immune GPS project team';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="review-guide-title">
      <DialogTitle id="review-guide-title" sx={{ color: '#24493F', fontWeight: 700 }}>
        How to review T1D Immune GPS
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={sectionSx}>
          <Typography sx={headingSx}>Purpose</Typography>
          <Typography sx={bodySx}>
            This preliminary research demonstration connects immune tolerance, lymphatic drainage,
            immune priming, pancreatic-islet inflammation, CD8 recognition, and beta-cell injury.
          </Typography>
        </Box>
        <Box sx={sectionSx}>
          <Typography sx={headingSx}>Three levels of detail</Typography>
          <Typography sx={bodySx}>
            Layer 1 is a multi-organ overview. Layer 2 organizes major biological processes.
            Layer 3 shows selected cells, genes, proteins, molecular mechanisms, and evidence context.
          </Typography>
        </Box>
        <Box sx={sectionSx}>
          <Typography sx={headingSx}>Navigation</Typography>
          <Typography sx={bodySx}>
            Click a node and choose the first menu item to open its pathway or detailed graph.
            Choose Show all data for the selected record, or Graph content for readable node and
            relationship tables for the complete view. This review site does not permit editing or downloading.
          </Typography>
        </Box>
        <Box sx={sectionSx}>
          <Typography sx={headingSx}>CD8 example</Typography>
          <Typography sx={bodySx}>
            Pancreatic islet → Islet major events → CD8 recognition &amp; killing.
          </Typography>
        </Box>
        <Box sx={sectionSx}>
          <Typography sx={headingSx}>Evidence notice</Typography>
          <Typography sx={bodySx}>
            The graph combines knowledge-graph records, curated scientific interpretation, model-system
            evidence, and clearly marked generated demonstration fallbacks. It is an early research prototype,
            not a clinical decision tool. Human observations and mechanistic model evidence should be interpreted separately.
          </Typography>
        </Box>
        <Typography sx={{ ...bodySx, color: '#6B7B75', fontSize: '12px' }}>
          Release: T1D Immune GPS V6 · Contact: {contact}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ padding: '12px 20px' }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', backgroundColor: '#24493F' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
