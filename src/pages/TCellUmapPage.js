import React, {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-strict-dist-min';
import { Link as RouterLink } from 'react-router-dom';

import { fixtureRootUrlFor } from './SampleGraphPage';
import {
  T1D_GPS_V8_SCFM_T_CELL_DETAIL,
  T1D_GPS_V9_SCFM_T_CELL_DETAIL,
} from './t1dGpsV8Routes';
import {
  buildMaturationTrace,
  buildKgFocusRoute,
  buildSolidArrowPath,
  buildSubtypeTraces,
  buildTrendShapes,
  hasWebGlSupport,
  joinAssetUrl,
  MATURATION_ARROW_STYLE,
  parseVerifiedPointBundle,
  resolveManifestFileUrl,
  validateUmapManifest,
} from './tCellUmapModel';
import './TCellUmapPage.css';

const Plot = createPlotlyComponent(Plotly);

const LEGEND_MATURATION_ARROW_PATH = buildSolidArrowPath(
  { ax: 8, ay: 10, x: 216, y: 31 },
  { shaftHalfWidth: 4.5, headLength: 24, headHalfWidth: 15 },
);

export const UMAP_LEGEND_VISUAL_STYLE = Object.freeze({
  fontFamily: '"Open Sans", Verdana, Arial, sans-serif',
  fontSize: 15,
  fontWeight: 400,
  textColor: '#243E3A',
  backgroundColor: 'rgba(255,253,248,0.97)',
  borderColor: '#A7BBB5',
  borderRadius: 12,
});

export const roundPlotlyLegendPanel = (root, radius = 12) => {
  const background = root?.querySelector?.('.legend .bg');
  if (!background) return false;
  background.setAttribute('rx', String(radius));
  background.setAttribute('ry', String(radius));
  return true;
};

export function MaturationDirectionLegend({ colorMode = 'subtype' }) {
  const plotRightMargin = colorMode === 'maturation' ? 110 : 56;

  return (
    <Paper
      component="aside"
      data-testid="maturation-direction-legend"
      aria-label="Schematic maturation direction legend"
      elevation={0}
      sx={{
        position: 'absolute',
        right: { xs: 12, md: `calc(${plotRightMargin}px + 16px)` },
        bottom: { xs: 86, md: 'calc(78px + 16px)' },
        zIndex: 3,
        width: 280,
        maxWidth: 'calc(100% - 24px)',
        boxSizing: 'border-box',
        p: '12px 14px 10px',
        border: `1px solid ${UMAP_LEGEND_VISUAL_STYLE.borderColor}`,
        borderRadius: `${UMAP_LEGEND_VISUAL_STYLE.borderRadius}px`,
        bgcolor: UMAP_LEGEND_VISUAL_STYLE.backgroundColor,
        boxShadow: '0 7px 18px rgba(48, 75, 73, 0.14)',
        pointerEvents: 'none',
      }}
    >
      <Typography
        data-testid="maturation-direction-label"
        sx={{
          color: UMAP_LEGEND_VISUAL_STYLE.textColor,
          fontFamily: UMAP_LEGEND_VISUAL_STYLE.fontFamily,
          fontSize: UMAP_LEGEND_VISUAL_STYLE.fontSize,
          fontWeight: UMAP_LEGEND_VISUAL_STYLE.fontWeight,
          lineHeight: 1.35,
        }}
      >
        schematic maturation direction
      </Typography>
      <Box
        component="svg"
        viewBox="0 0 224 50"
        role="img"
        aria-label="Example arrow pointing down and right"
        sx={{ width: '100%', height: 42, display: 'block', mt: 0.25, overflow: 'visible' }}
      >
        <path
          data-testid="maturation-direction-arrow-shape"
          d={LEGEND_MATURATION_ARROW_PATH}
          fill={MATURATION_ARROW_STYLE.color}
          opacity={MATURATION_ARROW_STYLE.opacity}
          stroke="none"
        />
      </Box>
    </Paper>
  );
}

const correspondenceLabel = (value) => String(value || '').replace(/_/g, ' ');

const ConceptLink = ({ concept, kgContext, prefix = '' }) => {
  const target = buildKgFocusRoute(kgContext, concept?.id);
  if (!target) return null;
  const accessibleLabel = `${prefix ? `${prefix}: ` : ''}${concept.label}`;
  return (
    <Button
      component={RouterLink}
      to={target}
      size="small"
      endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '14px !important' }} />}
      aria-label={`Show ${accessibleLabel} in the T-cell pathway`}
      sx={{
        justifyContent: 'flex-start',
        minWidth: 0,
        p: 0,
        color: '#35675F',
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.35,
        textAlign: 'left',
        textTransform: 'none',
        '&:hover': { bgcolor: 'transparent', color: '#244D47', textDecoration: 'underline' },
      }}
    >
      {prefix && <Box component="span" sx={{ color: '#6B7C78', fontWeight: 600 }}>{prefix}:&nbsp;</Box>}
      {concept.label}
    </Button>
  );
};

export function RelatedPathwayConcepts({ kgContext }) {
  if (!kgContext) return null;
  const arrowCoverage = Object.entries(kgContext.arrow_coverage || {});

  return (
    <Paper
      component="section"
      aria-labelledby="related-pathway-concepts-title"
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        border: '1px solid rgba(63, 113, 105, 0.34)',
        borderRadius: 3,
        bgcolor: 'rgba(255,253,248,0.92)',
        boxShadow: '0 8px 24px rgba(54, 83, 78, 0.08)',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <AccountTreeRoundedIcon sx={{ color: '#3F7169' }} />
        <Box>
          <Typography
            id="related-pathway-concepts-title"
            component="h2"
            sx={{ color: '#304B49', fontSize: 20, fontWeight: 760 }}
          >
            Related pathway concepts
          </Typography>
          <Typography sx={{ color: '#647572', mt: 0.25, fontSize: 13.5 }}>
            Label-to-concept correspondence only — not ontology equivalence or differentiation evidence.
          </Typography>
        </Box>
      </Stack>

      {kgContext.relationship && (
        <Box
          data-testid="kg-data-view-relationship"
          sx={{
            mt: 1.75,
            p: 1.5,
            borderRadius: 2.25,
            border: '1px dashed rgba(63,113,105,0.45)',
            bgcolor: '#F4F7F3',
          }}
        >
          <Typography sx={{ color: '#315E62', fontSize: 13.5, fontWeight: 780 }}>
            {kgContext.relationship.display_label}
          </Typography>
          <Typography sx={{ color: '#526864', fontSize: 12.5, lineHeight: 1.45, mt: 0.35 }}>
            {kgContext.relationship.link_reason}
          </Typography>
          <Typography sx={{ color: '#687874', fontSize: 11.75, fontWeight: 650, lineHeight: 1.4, mt: 0.45 }}>
            {kgContext.relationship.evidence_boundary}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.25,
          mt: 2,
        }}
      >
        {kgContext.mappings.map((mapping) => (
          <Box
            key={mapping.subtype}
            component="article"
            sx={{
              minWidth: 0,
              p: 1.5,
              border: '1px solid #D8E2DE',
              borderRadius: 2.25,
              bgcolor: '#FFFFFF',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Typography sx={{ color: '#263F3C', fontSize: 14.5, fontWeight: 760 }}>
                {mapping.subtype}
              </Typography>
              <Chip
                label={correspondenceLabel(mapping.confidence)}
                size="small"
                sx={{ height: 21, bgcolor: '#E6EFEC', color: '#3A605A', fontSize: 11 }}
              />
            </Stack>
            <Typography sx={{ color: '#71817D', fontSize: 11.5, mt: 0.25, mb: 0.75, textTransform: 'capitalize' }}>
              {correspondenceLabel(mapping.match_type)}
            </Typography>
            <Stack spacing={0.35} alignItems="flex-start">
              <ConceptLink concept={mapping.primary_concept} kgContext={kgContext} />
              {mapping.refinements.map((concept) => (
                <ConceptLink key={concept.id} concept={concept} kgContext={kgContext} prefix="KG refinement" />
              ))}
              {mapping.related_states.map((concept) => (
                <ConceptLink key={concept.id} concept={concept} kgContext={kgContext} prefix="Related T1D state" />
              ))}
            </Stack>
            <Typography sx={{ color: '#687874', fontSize: 12.25, lineHeight: 1.45, mt: 0.8 }}>
              {mapping.note}
            </Typography>
          </Box>
        ))}
      </Box>

      {arrowCoverage.length > 0 && (
        <Box sx={{ mt: 2, pt: 1.75, borderTop: '1px solid #DCE5E2' }}>
          <Typography sx={{ color: '#405957', fontSize: 13.5, fontWeight: 760, mb: 1 }}>
            Schematic-arrow coverage in the KG
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
            {arrowCoverage.map(([id, coverage]) => (
              <Box
                key={id}
                sx={{ flex: 1, minWidth: 0, p: 1.25, borderRadius: 2, bgcolor: '#F4F6F2' }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={correspondenceLabel(coverage.status)}
                    size="small"
                    sx={{ height: 22, bgcolor: '#DCE9E5', color: '#345B55', fontSize: 11 }}
                  />
                  <Typography sx={{ color: '#304B49', fontSize: 13.5, fontWeight: 700 }}>
                    {coverage.label}
                  </Typography>
                </Stack>
                {coverage.detail && (
                  <Typography sx={{ color: '#647572', fontSize: 12.25, mt: 0.65, lineHeight: 1.45 }}>
                    {coverage.detail}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

const PLOT_CONFIG = Object.freeze({
  displaylogo: false,
  doubleClick: 'reset+autosize',
  responsive: true,
  scrollZoom: true,
  showLink: false,
  modeBarButtonsToRemove: [
    'sendDataToCloud',
    'editInChartStudio',
    'lasso2d',
    'select2d',
  ],
});

class PlotErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function StaticPreview({ previewUrl, title }) {
  if (!previewUrl) {
    return (
      <Box
        sx={{
          minHeight: 420,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#60736F',
          bgcolor: '#FCFBF8',
        }}
      >
        Static preview unavailable.
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={previewUrl}
      alt={`Static preview of ${title || 'the scFM T-cell RNA-side UMAP'}.`}
      sx={{
        width: '100%',
        minHeight: 420,
        maxHeight: '70vh',
        display: 'block',
        objectFit: 'contain',
        bgcolor: '#FFFFFF',
      }}
    />
  );
}

const loadingState = {
  status: 'loading-manifest',
  manifest: null,
  model: null,
  previewUrl: '',
  error: '',
  validationMs: null,
  interactiveMs: null,
};

export default function TCellUmapPage() {
  const [resource, setResource] = useState(loadingState);
  const [colorMode, setColorMode] = useState('subtype');
  const interactiveStartedAt = useRef(null);
  const plotRootRef = useRef(null);
  const isV9 = window.location.pathname.startsWith('/T1D_GPS/v9/');
  const detailRoute = isV9
    ? T1D_GPS_V9_SCFM_T_CELL_DETAIL
    : T1D_GPS_V8_SCFM_T_CELL_DETAIL;
  const fixtureRoot = fixtureRootUrlFor(`${isV9 ? 't1d-gps-v9' : 't1d-gps-v8'}/overview`);
  const manifestUrl = joinAssetUrl(
    fixtureRoot,
    detailRoute.manifestPath,
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      let manifest = null;
      let previewUrl = '';
      try {
        setResource(loadingState);
        const manifestResponse = await fetch(manifestUrl, {
          cache: 'no-cache',
          signal: controller.signal,
        });
        if (!manifestResponse.ok) {
          throw new Error(`Failed to load UMAP manifest: ${manifestResponse.status}`);
        }
        manifest = validateUmapManifest(await manifestResponse.json());
        previewUrl = resolveManifestFileUrl(manifestUrl, manifest.files.preview.path);
        if (!active) return;

        setResource({
          ...loadingState,
          status: 'loading-points',
          manifest,
          previewUrl,
        });

        if (!hasWebGlSupport()) {
          throw new Error('WebGL is unavailable in this browser. Showing the static preview.');
        }

        const pointsUrl = resolveManifestFileUrl(manifestUrl, manifest.files.points.path);
        const pointsResponse = await fetch(pointsUrl, {
          cache: 'force-cache',
          signal: controller.signal,
        });
        if (!pointsResponse.ok) {
          throw new Error(`Failed to load UMAP point bundle: ${pointsResponse.status}`);
        }
        const pointBuffer = await pointsResponse.arrayBuffer();
        interactiveStartedAt.current = performance.now();
        const preparationStartedAt = performance.now();
        const model = await parseVerifiedPointBundle(pointBuffer, manifest);
        const validationMs = performance.now() - preparationStartedAt;
        if (!active) return;

        setResource({
          status: 'ready',
          manifest,
          model,
          previewUrl,
          error: '',
          validationMs,
          interactiveMs: null,
        });
      } catch (error) {
        if (!active || error.name === 'AbortError') return;
        setResource({
          status: 'fallback',
          manifest,
          model: null,
          previewUrl,
          error: error.message || 'The interactive UMAP could not be loaded.',
          validationMs: null,
          interactiveMs: null,
        });
      }
    };

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [manifestUrl]);

  const failPlot = useCallback((error) => {
    setResource((current) => ({
      ...current,
      status: 'fallback',
      model: null,
      error: error?.message
        ? `WebGL rendering failed: ${error.message}`
        : 'The WebGL context was lost. Showing the static preview.',
    }));
  }, []);

  const traceResult = useMemo(() => {
    if (!resource.model || !resource.manifest) return { traces: [], error: null };
    try {
      return {
        traces: colorMode === 'maturation'
          ? buildMaturationTrace(resource.model, resource.manifest)
          : buildSubtypeTraces(resource.model, resource.manifest),
        error: null,
      };
    } catch (error) {
      return { traces: [], error };
    }
  }, [colorMode, resource.manifest, resource.model]);

  useEffect(() => {
    if (traceResult.error) failPlot(traceResult.error);
  }, [failPlot, traceResult.error]);

  const markInteractive = useCallback(() => {
    if (interactiveStartedAt.current == null) return;
    const interactiveMs = performance.now() - interactiveStartedAt.current;
    interactiveStartedAt.current = null;
    setResource((current) => (
      current.status === 'ready' ? { ...current, interactiveMs } : current
    ));
  }, []);

  const handleAfterPlot = useCallback(() => {
    roundPlotlyLegendPanel(plotRootRef.current);
    markInteractive();
  }, [markInteractive]);

  const plotLayout = useMemo(() => {
    const manifest = resource.manifest || {};
    const layoutContract = manifest.layout || {};
    return {
      autosize: true,
      dragmode: 'pan',
      hovermode: 'closest',
      hoverdistance: 12,
      showlegend: colorMode === 'subtype',
      paper_bgcolor: '#FCFBF8',
      plot_bgcolor: '#FCFBF8',
      margin: { l: 84, r: colorMode === 'subtype' ? 56 : 110, t: 48, b: 78 },
      legend: {
        x: 0.985,
        xanchor: 'right',
        y: 0.975,
        yanchor: 'top',
        orientation: 'v',
        bgcolor: UMAP_LEGEND_VISUAL_STYLE.backgroundColor,
        bordercolor: UMAP_LEGEND_VISUAL_STYLE.borderColor,
        borderwidth: 1,
        font: {
          color: UMAP_LEGEND_VISUAL_STYLE.textColor,
          family: UMAP_LEGEND_VISUAL_STYLE.fontFamily,
          size: UMAP_LEGEND_VISUAL_STYLE.fontSize,
          weight: UMAP_LEGEND_VISUAL_STYLE.fontWeight,
        },
        itemsizing: 'constant',
        itemwidth: 42,
        tracegroupgap: 8,
        itemclick: 'toggle',
        itemdoubleclick: 'toggleothers',
      },
      xaxis: {
        title: {
          text: layoutContract.x_label || 'UMAP 1',
          font: { color: '#243E3A', size: 18 },
          standoff: 14,
        },
        showgrid: false,
        zeroline: false,
        showline: true,
        linewidth: 1.5,
        linecolor: '#526864',
        ticks: '',
        showticklabels: false,
      },
      yaxis: {
        title: {
          text: layoutContract.y_label || 'UMAP 2',
          font: { color: '#243E3A', size: 18 },
          standoff: 14,
        },
        showgrid: false,
        zeroline: false,
        showline: true,
        linewidth: 1.5,
        linecolor: '#526864',
        ticks: '',
        showticklabels: false,
        scaleanchor: 'x',
        scaleratio: 1,
      },
      shapes: buildTrendShapes(manifest),
      uirevision: 'scfm-rna-umap-v1',
    };
  }, [colorMode, resource.manifest]);

  const manifest = resource.manifest;
  const title = manifest?.title || 'scFM T-cell differentiation · RNA-side UMAP';
  const cellCount = manifest?.cell_count?.toLocaleString('en-US');
  const donorCount = manifest?.donor_count?.toLocaleString('en-US');

  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        width: '100%',
        boxSizing: 'border-box',
        px: { xs: 1.5, md: 3 },
        pb: 3,
        background: 'linear-gradient(180deg, #F7F0E5 0%, #F4EDE2 100%)',
      }}
    >
      <Paper
        component="header"
        elevation={0}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          mx: { xs: -1.5, md: -3 },
          px: { xs: 1.5, md: 3 },
          py: 1.25,
          borderRadius: 0,
          borderTop: '1px solid rgba(86,127,116,0.18)',
          borderBottom: '1px solid rgba(86,127,116,0.28)',
          bgcolor: 'rgba(250,246,238,0.96)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Button
          component={RouterLink}
          to={detailRoute.backRoute}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ color: '#365D57', textTransform: 'none', fontWeight: 700 }}
        >
          Back to T-cell differentiation
        </Button>
      </Paper>

      <Stack spacing={2} sx={{ maxWidth: 1720, mx: 'auto', pt: 2.5 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography component="h1" sx={{ color: '#304B49', fontSize: { xs: 25, md: 32 }, fontWeight: 760 }}>
              {title}
            </Typography>
            <Typography sx={{ color: '#60736F', mt: 0.5 }}>
              RNA-side UMAP · hover a cell to inspect the public metadata allowlist.
            </Typography>
          </Box>
          {manifest && (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {cellCount && <Chip label={`${cellCount} cells`} />}
              {donorCount && <Chip label={`${donorCount} donors`} />}
              <Chip label="Layer 3 · data/evidence" sx={{ bgcolor: '#DCEBE5', color: '#304B49' }} />
            </Stack>
          )}
        </Stack>

        {resource.status === 'ready' && (
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
            <Typography sx={{ color: '#405957', fontWeight: 700 }}>Color by</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={colorMode}
              onChange={(event, nextMode) => nextMode && setColorMode(nextMode)}
              aria-label="UMAP color mode"
            >
              <ToggleButton value="subtype" sx={{ textTransform: 'none' }}>T-cell subtype</ToggleButton>
              <ToggleButton value="maturation" sx={{ textTransform: 'none' }}>Maturation coordinate</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        )}

        <Paper
          elevation={0}
          sx={{
            minHeight: 520,
            border: '2px solid #FFF9F0',
            borderRadius: 4,
            overflow: 'hidden',
            bgcolor: '#FCFBF8',
            boxShadow: '8px 6px 33px rgba(107, 92, 70, 0.14)',
          }}
        >
          {resource.status === 'loading-manifest' || resource.status === 'loading-points' ? (
            <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: 580, color: '#526864' }}>
              <CircularProgress sx={{ color: '#567F74' }} />
              <Typography>
                {resource.status === 'loading-points' ? 'Loading and validating 32,952 cells…' : 'Loading UMAP manifest…'}
              </Typography>
            </Stack>
          ) : resource.status === 'fallback' ? (
            <Stack spacing={0}>
              <Alert severity="warning">{resource.error}</Alert>
              <StaticPreview previewUrl={resource.previewUrl} title={title} />
            </Stack>
          ) : (
            <PlotErrorBoundary onError={failPlot}>
              <Box ref={plotRootRef} sx={{ position: 'relative' }}>
                <Plot
                  className="scfm-t-cell-umap-plot"
                  data={traceResult.traces}
                  layout={plotLayout}
                  config={PLOT_CONFIG}
                  useResizeHandler
                  style={{ width: '100%', height: 'min(74vh, 900px)', minHeight: '620px' }}
                  onError={failPlot}
                  onAfterPlot={handleAfterPlot}
                  onWebGlContextLost={() => failPlot()}
                />
                <MaturationDirectionLegend colorMode={colorMode} />
              </Box>
            </PlotErrorBoundary>
          )}
        </Paper>

        {manifest?.kg_context && (
          <RelatedPathwayConcepts
            kgContext={{ ...manifest.kg_context, back_route: detailRoute.backRoute }}
          />
        )}

        <Alert severity="info" sx={{ color: '#304B49' }}>
          The two arrows inside the UMAP show schematic maturation direction. They are
          not RNA velocity, pseudotime, or evidence of a causal lineage path. Hover data
          exclude barcodes, donor identifiers, and clinical attributes.
        </Alert>
        {resource.validationMs != null && (
          <Typography variant="caption" sx={{ color: '#6A7774', textAlign: 'right' }}>
            Verified and prepared locally in {Math.round(resource.validationMs)} ms after download.
            {resource.interactiveMs != null
              ? ` Download-to-interactive: ${Math.round(resource.interactiveMs)} ms.`
              : ''}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
