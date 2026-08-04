import { fixtureBaseUrlFor } from './SampleGraphPage';
import { T1D_GPS_V5_VIEW_PATHS } from './t1dGpsV5Routes';

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

  test('registers exactly the 20 unique planned fixture views', () => {
    expect(T1D_GPS_V5_VIEW_PATHS).toHaveLength(20);
    expect(new Set(T1D_GPS_V5_VIEW_PATHS).size).toBe(20);
    expect(T1D_GPS_V5_VIEW_PATHS.filter((path) => path.startsWith('pathways/'))).toHaveLength(7);
    expect(T1D_GPS_V5_VIEW_PATHS.filter((path) => path.startsWith('details/'))).toHaveLength(12);
  });
});
