import {
  embeddingPortalVisibleFor,
  exactPreviewCaptureRequested,
  fixtureBaseUrlFor,
  fixtureRootUrlFor,
  graphFocusNodeIdRequested,
  isT1dGpsFixture,
  kgLinkedViewPanelVisibleFor,
  t1dGpsDeveloperContextFor,
  t1dGpsReviewModeFor,
  viewModeSelectorVisibleFor,
  withT1dGpsDeveloperMetadata,
} from './SampleGraphPage';
import { T1D_GPS_V5_VIEW_PATHS } from './t1dGpsV5Routes';
import { T1D_GPS_V6_VIEW_PATHS } from './t1dGpsV6Routes';
import { T1D_GPS_V7_VIEW_PATHS } from './t1dGpsV7Routes';
import {
  T1D_GPS_V8_SCFM_T_CELL_DETAIL,
  T1D_GPS_V8_VIEW_PATHS,
} from './t1dGpsV8Routes';

describe('T1D GPS v4 fixture hosting', () => {
  test('keeps local development on the ignored local fixture', () => {
    expect(fixtureBaseUrlFor('t1d-gps-v4/overview', '127.0.0.1'))
      .toBe('/t1d-gps-v4/overview');
  });

  test('uses the verified S3 fixture on the deployed host', () => {
    expect(fixtureBaseUrlFor('t1d-gps-v4/pathways/central-tolerance', 'dev.genomickb.org'))
      .toBe('https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v4/pathways/central-tolerance');
  });

  test('does not change existing fixture paths', () => {
    expect(fixtureBaseUrlFor('layeredgraph/overview', 'dev.genomickb.org'))
      .toBe('/layeredgraph/overview');
  });
});

describe('T1D GPS v7 fixture hosting and hierarchy', () => {
  test('keeps local V7 fixtures local and uses the versioned S3 root when deployed', () => {
    expect(fixtureBaseUrlFor('t1d-gps-v7/pathways/islet-entry-spatial-insulitis', 'localhost'))
      .toBe('/t1d-gps-v7/pathways/islet-entry-spatial-insulitis');
    expect(fixtureBaseUrlFor(
      't1d-gps-v7/details/beta-cell-stimulus-secretion-and-reserve',
      'dev.genomickb.org',
    )).toBe('https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v7/details/beta-cell-stimulus-secretion-and-reserve');
  });

  test('registers the complete 26-view V7 hierarchy', () => {
    expect(T1D_GPS_V7_VIEW_PATHS).toHaveLength(26);
    expect(new Set(T1D_GPS_V7_VIEW_PATHS).size).toBe(26);
    expect(T1D_GPS_V7_VIEW_PATHS.filter((path) => path.startsWith('pathways/'))).toHaveLength(10);
    expect(T1D_GPS_V7_VIEW_PATHS.filter((path) => path.startsWith('details/'))).toHaveLength(15);
    expect(T1D_GPS_V7_VIEW_PATHS).toEqual(expect.arrayContaining([
      'pathways/islet-entry-spatial-insulitis',
      'pathways/glucose-homeostasis-and-beta-cell-reserve',
      'details/microvascular-immune-entry',
      'details/beta-cell-stimulus-secretion-and-reserve',
    ]));
  });

  test('authorizes Developer Mode for V7 views', () => {
    expect(t1dGpsDeveloperContextFor('t1d-gps-v7/overview')).toEqual({
      fixtureVersion: 't1d-gps-v7', release: 'v7', viewId: 'overview',
    });
  });

  test('accepts bounded contextual focus IDs but rejects paths and traversal', () => {
    expect(graphFocusNodeIdRequested('?focus=A02%40stimulus-secretion-detail')).toBe('A02@stimulus-secretion-detail');
    expect(graphFocusNodeIdRequested('?focus=cell%23one')).toBe('cell#one');
    expect(graphFocusNodeIdRequested('?focus=../secret')).toBe('');
    expect(graphFocusNodeIdRequested('?focus=path/to/node')).toBe('');
  });
});

describe('T1D GPS v8 fixture hosting and ontology-locked hierarchy', () => {
  test('keeps local V8 fixtures local and uses the isolated V8 S3 root when deployed', () => {
    expect(fixtureBaseUrlFor(
      't1d-gps-v8/pathways/immune-cell-differentiation-foundation',
      'localhost',
    )).toBe('/t1d-gps-v8/pathways/immune-cell-differentiation-foundation');
    expect(fixtureBaseUrlFor(
      't1d-gps-v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
      'dev.genomickb.org',
    )).toBe('https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation');
  });

  test('registers exactly 28 V8 views while retaining all 26 V7 paths', () => {
    expect(T1D_GPS_V8_VIEW_PATHS).toHaveLength(28);
    expect(new Set(T1D_GPS_V8_VIEW_PATHS).size).toBe(28);
    expect(T1D_GPS_V8_VIEW_PATHS.filter((path) => path.startsWith('pathways/'))).toHaveLength(12);
    expect(T1D_GPS_V8_VIEW_PATHS.filter((path) => path.startsWith('details/'))).toHaveLength(15);
    expect(T1D_GPS_V7_VIEW_PATHS.every((path) => T1D_GPS_V8_VIEW_PATHS.includes(path))).toBe(true);
    expect(T1D_GPS_V8_VIEW_PATHS).toEqual(expect.arrayContaining([
      'pathways/immune-cell-differentiation-foundation',
      'pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
    ]));
  });

  test('registers the UMAP as a separate non-KG Layer-3 detail route', () => {
    expect(T1D_GPS_V8_SCFM_T_CELL_DETAIL).toEqual({
      path: 'details/scfm-t-cell-differentiation',
      route: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
      backRoute: '/T1D_GPS/v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
      manifestPath: 'embeddings/scfm-t-cell-differentiation/manifest.json',
    });
    expect(T1D_GPS_V8_VIEW_PATHS).not.toContain(T1D_GPS_V8_SCFM_T_CELL_DETAIL.path);
  });

  test('keeps the legacy metadata helper visible for focused views but not preview capture', () => {
    const metadata = {
      embedding_view: {
        target_route: T1D_GPS_V8_SCFM_T_CELL_DETAIL.route,
      },
    };
    expect(embeddingPortalVisibleFor(metadata, '')).toBe(true);
    expect(embeddingPortalVisibleFor(metadata, '?focus=CL%3A0000545')).toBe(true);
    expect(embeddingPortalVisibleFor(metadata, '?focus=')).toBe(true);
    expect(embeddingPortalVisibleFor(metadata, '?graph_preview_capture=1')).toBe(false);
    expect(embeddingPortalVisibleFor({}, '')).toBe(false);
  });

  test('derives the floating panel from a registered KG resource node', () => {
    const graph = {
      nodes: [{
        '~id': 'T1D:DATARESOURCE:scfm_t_cell_rna_umap',
        '~labels': ['T1DConcept', 'DataResource'],
        '~properties': { resource_view_key: 'scfm-t-cell-rna-umap' },
      }],
      edges: [],
    };
    expect(kgLinkedViewPanelVisibleFor(graph, '')).toBe(true);
    expect(kgLinkedViewPanelVisibleFor(graph, '?focus=CL%3A0000900')).toBe(true);
    expect(kgLinkedViewPanelVisibleFor(graph, '?graph_preview_capture=1')).toBe(false);
    expect(kgLinkedViewPanelVisibleFor({ nodes: [], edges: [] }, '')).toBe(false);
  });

  test('keeps the T1D GPS layout mode fixed while ordinary graph viewers retain the selector', () => {
    expect(isT1dGpsFixture('t1d-gps-v8/overview')).toBe(true);
    expect(isT1dGpsFixture('t1d-gps-v8')).toBe(true);
    expect(isT1dGpsFixture('layeredgraph/overview')).toBe(true);
    expect(viewModeSelectorVisibleFor('t1d-gps-v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation')).toBe(false);
    expect(viewModeSelectorVisibleFor('layeredgraph/thymus')).toBe(false);
    expect(viewModeSelectorVisibleFor('samplegraph')).toBe(true);
    expect(viewModeSelectorVisibleFor('mechanismgraph')).toBe(true);
  });

  test('authorizes the existing Developer Mode adapter for V8 without changing V7', () => {
    expect(t1dGpsDeveloperContextFor(
      't1d-gps-v8/pathways/immune-cell-differentiation-foundation',
    )).toEqual({
      fixtureVersion: 't1d-gps-v8',
      release: 'v8',
      viewId: 'pathways/immune-cell-differentiation-foundation',
    });
    expect(t1dGpsDeveloperContextFor('t1d-gps-v7/overview')).toEqual({
      fixtureVersion: 't1d-gps-v7', release: 'v7', viewId: 'overview',
    });
  });
});

describe('T1D GPS v5 fixture hosting', () => {
  test('keeps local development on the ignored local fixture', () => {
    expect(fixtureBaseUrlFor('t1d-gps-v5/overview', 'localhost'))
      .toBe('/t1d-gps-v5/overview');
  });

  test('uses the v5 S3 fixture on the deployed host', () => {
    expect(fixtureBaseUrlFor('t1d-gps-v5/details/lymphatic-antigen-drainage', 'dev.genomickb.org'))
      .toBe('https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v5/details/lymphatic-antigen-drainage');
  });

  test('exposes one stable root for cached local and deployed preview assets', () => {
    expect(fixtureRootUrlFor('t1d-gps-v5/overview', 'localhost'))
      .toBe('/t1d-gps-v5');
    expect(fixtureRootUrlFor('t1d-gps-v5/pathways/central-tolerance', 'dev.genomickb.org'))
      .toBe('https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v5');
  });

  test('registers exactly the 20 unique planned fixture views', () => {
    expect(T1D_GPS_V5_VIEW_PATHS).toHaveLength(20);
    expect(new Set(T1D_GPS_V5_VIEW_PATHS).size).toBe(20);
    expect(T1D_GPS_V5_VIEW_PATHS.filter((path) => path.startsWith('pathways/'))).toHaveLength(7);
    expect(T1D_GPS_V5_VIEW_PATHS.filter((path) => path.startsWith('details/'))).toHaveLength(12);
  });
});

describe('T1D GPS v6 fixture hosting and exact capture', () => {
  test('keeps local V6 fixtures local and uses the versioned S3 root when deployed', () => {
    expect(fixtureBaseUrlFor('t1d-gps-v6/pathways/islet-major-events', 'localhost'))
      .toBe('/t1d-gps-v6/pathways/islet-major-events');
    expect(fixtureBaseUrlFor(
      't1d-gps-v6/details/cd8-stemlike-reservoir-continuous-seeding',
      'dev.genomickb.org',
    )).toBe('https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v6/details/cd8-stemlike-reservoir-continuous-seeding');
  });

  test('registers the complete real-data V6 hierarchy and its two cross-cut views', () => {
    expect(T1D_GPS_V6_VIEW_PATHS).toHaveLength(22);
    expect(new Set(T1D_GPS_V6_VIEW_PATHS).size).toBe(22);
    expect(T1D_GPS_V6_VIEW_PATHS.filter((path) => path.startsWith('pathways/'))).toHaveLength(8);
    expect(T1D_GPS_V6_VIEW_PATHS.filter((path) => path.startsWith('details/'))).toHaveLength(13);
    expect(T1D_GPS_V6_VIEW_PATHS).toEqual(expect.arrayContaining([
      'overview',
      'pathways/central-tolerance',
      'pathways/islet-major-events',
      'details/thymus-selection',
      'details/islet-cytotoxicity',
      'details/cd8-stemlike-reservoir-continuous-seeding',
    ]));
  });

  test('requires an explicit build-time query flag for exact preview capture', () => {
    expect(exactPreviewCaptureRequested('?graph_preview_capture=1')).toBe(true);
    expect(exactPreviewCaptureRequested('?capture=preview')).toBe(true);
    expect(exactPreviewCaptureRequested('?graph_preview_capture=0')).toBe(false);
    expect(exactPreviewCaptureRequested('')).toBe(false);
  });

  test('accepts only stable node IDs for linked-view entry focus', () => {
    expect(graphFocusNodeIdRequested('?focus=L3C03')).toBe('L3C03');
    expect(graphFocusNodeIdRequested('?focus=L3C12')).toBe('L3C12');
    expect(graphFocusNodeIdRequested('?focus=../../graph.json')).toBe('');
  });

  test('authorizes Developer Mode for every V5 and V6 fixture view only', () => {
    expect(t1dGpsDeveloperContextFor('t1d-gps-v5/overview')).toEqual({
      fixtureVersion: 't1d-gps-v5', release: 'v5', viewId: 'overview',
    });
    expect(t1dGpsDeveloperContextFor('t1d-gps-v6/pathways/islet-major-events')).toEqual({
      fixtureVersion: 't1d-gps-v6', release: 'v6', viewId: 'pathways/islet-major-events',
    });
    expect(t1dGpsDeveloperContextFor('t1d-gps-v4/overview')).toBeNull();
    expect(t1dGpsDeveloperContextFor('layeredgraph/overview')).toBeNull();
  });

  test('enables an immutable V6-only review surface only when explicitly requested', () => {
    expect(t1dGpsReviewModeFor('t1d-gps-v6/overview', true)).toEqual({
      enabled: true,
      allowDownload: false,
      allowNodeDragging: false,
    });
    expect(t1dGpsReviewModeFor('t1d-gps-v5/overview', true)).toBeNull();
    expect(t1dGpsReviewModeFor('t1d-gps-v6/overview', false)).toBeNull();
  });

  test('adds authoring context without replacing visible V6 titles or viewer metadata', () => {
    const metadata = {
      source_checksum: 'fixture-sha',
      viewer: {
        title: 'T1D immune GPS · v6 · major events in the pancreatic islet',
        subtitle: 'Curated V6 mechanism',
        pathway_preview_interaction: 'exact_preview_then_open_full_detail',
      },
    };
    expect(withT1dGpsDeveloperMetadata(metadata, {
      release: 'v6', viewId: 'pathways/islet-major-events',
    })).toMatchObject({
      viewer: {
        title: metadata.viewer.title,
        subtitle: metadata.viewer.subtitle,
        pathway_preview_interaction: metadata.viewer.pathway_preview_interaction,
        developer_mode: true,
      },
      authoring: {
        release: 'v6',
        view_id: 'pathways/islet-major-events',
        source_checksum: 'fixture-sha',
      },
    });
  });
});
