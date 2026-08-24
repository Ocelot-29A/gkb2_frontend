export const T1D_GPS_V8_VIEW_PATHS = [
  'overview',
  'pathways/central-tolerance',
  'pathways/beta-cell-stress-and-neoantigen-generation',
  'pathways/antigen-drainage-and-priming',
  'pathways/b-cell-help-and-autoantibody-production',
  'pathways/effector-homing-and-insulitis',
  'pathways/beta-cell-destruction',
  'pathways/amplification',
  'pathways/islet-major-events',
  'pathways/islet-entry-spatial-insulitis',
  'pathways/glucose-homeostasis-and-beta-cell-reserve',
  'pathways/immune-cell-differentiation-foundation',
  'pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
  'details/thymus-self-antigen',
  'details/thymus-selection',
  'details/islet-innate-stress',
  'details/islet-neoantigen',
  'details/lymphatic-antigen-drainage',
  'details/islet-cytotoxicity',
  'details/islet-inflammatory-injury',
  'details/pln-antigen-presentation',
  'details/pln-costimulation',
  'details/pln-effector-regulation',
  'details/pln-bcell-germinal-centre',
  'details/blood-biomarkers-outcome',
  'details/cd8-stemlike-reservoir-continuous-seeding',
  'details/microvascular-immune-entry',
  'details/beta-cell-stimulus-secretion-and-reserve',
];

// This Layer-3 data view is intentionally separate from the KG fixture registry:
// it never mounts Cytoscape and therefore cannot enter KG search/query/export.
export const T1D_GPS_V8_SCFM_T_CELL_DETAIL = Object.freeze({
  path: 'details/scfm-t-cell-differentiation',
  route: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
  backRoute: '/T1D_GPS/v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
  manifestPath: 'embeddings/scfm-t-cell-differentiation/manifest.json',
});

export const T1D_GPS_V9_SCFM_T_CELL_DETAIL = Object.freeze({
  ...T1D_GPS_V8_SCFM_T_CELL_DETAIL,
  route: '/T1D_GPS/v9/details/scfm-t-cell-differentiation',
  backRoute: '/T1D_GPS/v9/pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
});
