import { fixtureBaseUrlFor } from './SampleGraphPage';

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
