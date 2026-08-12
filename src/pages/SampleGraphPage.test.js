import {
  exactPreviewCaptureRequested,
  fixtureBaseUrlFor,
  fixtureRootUrlFor,
  graphFocusNodeIdRequested,
  t1dGpsDeveloperContextFor,
  t1dGpsReviewModeFor,
  withT1dGpsDeveloperMetadata,
} from './SampleGraphPage';
import { T1D_GPS_V5_VIEW_PATHS } from './t1dGpsV5Routes';
import { T1D_GPS_V6_VIEW_PATHS } from './t1dGpsV6Routes';

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
