import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import {
  joinAssetUrl,
  resolveManifestFileUrl,
} from './tCellUmapModel';

const formatCount = (value) => (
  Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : null
);

export default function EmbeddingPortalCard({ embeddingView, assetBaseUrl, linkage = null }) {
  const manifestUrl = useMemo(
    () => joinAssetUrl(assetBaseUrl, embeddingView?.manifest_path),
    [assetBaseUrl, embeddingView?.manifest_path],
  );
  const [manifestSummary, setManifestSummary] = useState(null);
  const [manifestUnavailable, setManifestUnavailable] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const minimizeButtonRef = useRef(null);
  const restoreButtonRef = useRef(null);
  const focusAfterToggleRef = useRef(false);

  useEffect(() => {
    if (!manifestUrl) return undefined;
    const controller = new AbortController();
    let active = true;

    fetch(manifestUrl, { cache: 'no-cache', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load UMAP manifest: ${response.status}`);
        return response.json();
      })
      .then((manifest) => {
        if (!active) return;
        setManifestSummary({
          cellCount: manifest.cell_count,
          donorCount: manifest.donor_count,
          previewUrl: resolveManifestFileUrl(manifestUrl, manifest.files?.preview?.path),
        });
        setManifestUnavailable(false);
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return;
        setManifestUnavailable(true);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [manifestUrl]);

  useEffect(() => {
    if (!focusAfterToggleRef.current) return;
    focusAfterToggleRef.current = false;
    (minimized ? restoreButtonRef : minimizeButtonRef).current?.focus();
  }, [minimized]);

  if (!embeddingView?.target_route) return null;

  const previewUrl = manifestSummary?.previewUrl
    || joinAssetUrl(assetBaseUrl, embeddingView.preview_image_path);
  const cellCount = formatCount(manifestSummary?.cellCount ?? embeddingView.cell_count);
  const donorCount = formatCount(manifestSummary?.donorCount ?? embeddingView.donor_count);
  const linkageSourceSummary = linkage?.sourceNameSummary
    || linkage?.sourceName
    || 'Linked KG context';
  const linkageSourceFull = linkage?.sourceNameFull
    || (Array.isArray(linkage?.sourceNames) ? linkage.sourceNames.join(' + ') : '')
    || linkageSourceSummary;
  const linkageLabelSummary = linkage?.displayLabelSummary
    || linkage?.displayLabel
    || 'Associated data view';
  const linkageLabelFull = linkage?.displayLabelFull
    || (Array.isArray(linkage?.displayLabels) ? linkage.displayLabels.join(' · ') : '')
    || linkageLabelSummary;
  const updateMinimized = (nextValue) => {
    focusAfterToggleRef.current = true;
    setMinimized(nextValue);
  };

  if (minimized) {
    return (
      <Card
        id="scfm-t-cell-embedding-portal"
        data-testid="embedding-portal-card"
        data-state="minimized"
        elevation={0}
        sx={{
          width: 'fit-content',
          maxWidth: '100%',
          ml: 'auto',
          border: '1.5px solid #567F74',
          borderRadius: '16px',
          bgcolor: 'rgba(255, 253, 248, 0.97)',
          boxShadow: '0 10px 24px rgba(54, 93, 87, 0.18)',
        }}
      >
        <Button
          ref={restoreButtonRef}
          onClick={() => updateMinimized(false)}
          aria-label="Restore scFM T-cell UMAP data view"
          aria-expanded="false"
          aria-controls="scfm-t-cell-embedding-portal"
          startIcon={<BubbleChartRoundedIcon />}
          endIcon={<OpenInFullRoundedIcon sx={{ fontSize: 17 }} />}
          sx={{
            minHeight: 48,
            px: 1.75,
            color: '#365D57',
            fontSize: 13,
            fontWeight: 750,
            textTransform: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Data view{cellCount ? ` · ${cellCount} cells` : ''}
        </Button>
      </Card>
    );
  }

  return (
    <Card
      data-testid="embedding-portal-card"
      data-state="expanded"
      elevation={0}
      sx={{
        position: 'relative',
        width: '100%',
        border: '1.5px solid #567F74',
        borderRadius: '22px',
        background: 'linear-gradient(155deg, rgba(229,241,236,0.98), rgba(249,241,230,0.98))',
        boxShadow: '0 16px 34px rgba(54, 93, 87, 0.2)',
        overflow: 'hidden',
      }}
    >
      <CardActionArea
        id="scfm-t-cell-embedding-portal"
        component={RouterLink}
        to={embeddingView.target_route}
        aria-label={`Open ${embeddingView.title || 'scFM T-cell UMAP'}`}
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          flexDirection: 'column',
          textAlign: 'left',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 7.4',
            background: '#FCFBF8',
            borderBottom: '1px solid rgba(86,127,116,0.32)',
            overflow: 'hidden',
          }}
        >
          {previewUrl ? (
            <Box
              component="img"
              src={previewUrl}
              alt={embeddingView.preview_alt || 'RNA-side UMAP preview of the scFM T-cell differentiation data.'}
              sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
            />
          ) : (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={1.5}
              sx={{ width: '100%', height: '100%', color: '#567F74' }}
            >
              {manifestUnavailable ? (
                <BubbleChartRoundedIcon sx={{ fontSize: 72, opacity: 0.72 }} />
              ) : (
                <CircularProgress size={42} sx={{ color: '#567F74' }} />
              )}
              <Typography variant="body2">
                {manifestUnavailable ? 'Preview unavailable · viewer remains accessible' : 'Loading UMAP preview…'}
              </Typography>
            </Stack>
          )}
          <Chip
            label="Layer 3 · data view"
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              color: '#FFFFFF',
              bgcolor: '#365D57',
              fontWeight: 700,
            }}
          />
        </Box>

        <Stack spacing={0.75} sx={{ width: '100%', p: 1.5, boxSizing: 'border-box' }}>
          <Typography
            component="h2"
            sx={{ color: '#304B49', fontSize: 18, fontWeight: 750, lineHeight: 1.2, pr: 3 }}
          >
            {embeddingView.title || 'scFM T-cell differentiation'}
          </Typography>
          <Typography sx={{ color: '#526864', fontSize: 13, lineHeight: 1.4 }}>
            {embeddingView.subtitle || embeddingView.summary || 'Explore the RNA-side UMAP and inspect public cell metadata on hover.'}
          </Typography>
          {linkage?.reason && (
            <Box
              data-testid="resource-linkage-context"
              sx={{
                px: 1.25,
                py: 1.1,
                border: '1px solid rgba(63,113,105,0.28)',
                borderRadius: '12px',
                bgcolor: 'rgba(255,255,255,0.58)',
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: '#365D57', mb: 0.45 }}>
                <LinkRoundedIcon sx={{ fontSize: 17 }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.25 }}>
                  Linked KG context
                  {linkage.edgeCount ? ` · ${linkage.edgeCount} connection${linkage.edgeCount === 1 ? '' : 's'}` : ''}
                </Typography>
              </Stack>
              <Typography
                data-testid="resource-linkage-source"
                title={`${linkageSourceFull} → ${linkage.targetName || 'data view'}`}
                sx={{
                  color: '#315E62',
                  fontSize: 11.5,
                  fontWeight: 750,
                  lineHeight: 1.3,
                  mb: 0.35,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 1,
                  overflow: 'hidden',
                }}
              >
                {linkageSourceSummary} → UMAP data view
              </Typography>
              <Typography
                data-testid="resource-linkage-label"
                title={linkageLabelFull}
                sx={{
                  color: '#4F716A',
                  fontSize: 11.25,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  mb: 0.35,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 1,
                  overflow: 'hidden',
                }}
              >
                {linkageLabelSummary}
              </Typography>
              <Typography
                sx={{
                  color: '#425B57',
                  fontSize: 12,
                  lineHeight: 1.38,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                }}
              >
                {linkage.reason}
              </Typography>
              <Typography sx={{ color: '#56706B', fontSize: 11.25, fontWeight: 700, lineHeight: 1.35, mt: 0.6 }}>
                Data/navigation · context only, not biological process evidence
              </Typography>
            </Box>
          )}
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {cellCount && <Chip size="small" label={`${cellCount} cells`} />}
            {donorCount && <Chip size="small" label={`${donorCount} donors`} />}
            <Chip size="small" label="WebGL" />
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ color: '#365D57' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 750 }}>Open interactive UMAP</Typography>
            <ArrowForwardRoundedIcon />
          </Stack>
        </Stack>
      </CardActionArea>
      <IconButton
        ref={minimizeButtonRef}
        onClick={() => updateMinimized(true)}
        aria-label="Minimize scFM T-cell UMAP data view"
        aria-expanded="true"
        aria-controls="scfm-t-cell-embedding-portal"
        size="small"
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 2,
          width: 40,
          height: 40,
          color: '#365D57',
          bgcolor: 'rgba(255,255,255,0.94)',
          border: '1px solid rgba(86,127,116,0.42)',
          boxShadow: '0 4px 12px rgba(54,93,87,0.14)',
          '&:hover': { bgcolor: '#FFFFFF' },
        }}
      >
        <CloseFullscreenRoundedIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Card>
  );
}
