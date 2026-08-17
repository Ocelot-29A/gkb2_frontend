import { formatInfocardValue, getInfocardHref } from './graphViewerInfocardValue';

describe('graph viewer infocard value formatting', () => {
  const acceptedKgAnnotation = {
    name: 'dendritic cell',
    description: 'Antigen-presenting immune cell',
    synonyms: ['DC', 'dendritic leukocyte'],
    organism: 'Homo sapiens',
    source_record_id: 'CL:0000451',
    data_source: 'Cell Ontology',
    data_source_url: 'https://purl.obolibrary.org/obo/CL_0000451',
    data_version: '2026-08-03',
    source_properties: { exact_match: true },
  };

  test('serializes the exact nested KG annotation instead of returning a React object child', () => {
    const rendered = formatInfocardValue(acceptedKgAnnotation);

    expect(typeof rendered).toBe('string');
    expect(rendered).toContain('"name": "dendritic cell"');
    expect(rendered).toContain('"organism": "Homo sapiens"');
    expect(rendered).toContain('"source_properties"');
    expect(rendered).not.toContain('[object Object]');
  });

  test('formats primitive and structured arrays without unsafe object coercion', () => {
    expect(formatInfocardValue(['BATF3', 'HLA-A'])).toBe('BATF3; HLA-A');
    const rendered = formatInfocardValue([acceptedKgAnnotation, { name: 'beta cell' }]);
    expect(rendered).toContain('dendritic cell');
    expect(rendered).toContain('beta cell');
    expect(rendered).not.toContain('[object Object]');
  });

  test('handles empty, boolean, bigint, circular, and invalid link values safely', () => {
    const circular = { name: 'cycle' };
    circular.self = circular;

    expect(formatInfocardValue(null)).toBe('No Data');
    expect(formatInfocardValue(false)).toBe('No');
    expect(formatInfocardValue(12n)).toBe('12');
    expect(formatInfocardValue(circular)).toContain('[Circular]');
    expect(getInfocardHref(acceptedKgAnnotation)).toBe('');
    expect(getInfocardHref(' https://example.org/source ')).toBe('https://example.org/source');
    expect(getInfocardHref('javascript:alert(1)')).toBe('');
    expect(getInfocardHref('DOI:10.2337/db11-0090', 'doi')).toBe('https://doi.org/10.2337/db11-0090');
    expect(getInfocardHref('12345678', 'pubmed')).toBe('https://pubmed.ncbi.nlm.nih.gov/12345678/');
  });
});
