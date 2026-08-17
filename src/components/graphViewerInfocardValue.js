const EMPTY_INFOCARD_VALUE = 'No Data';

const stringifyStructuredValue = (value) => {
  const seen = new WeakSet();
  try {
    const serialized = JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === 'bigint') return nestedValue.toString();
      if (nestedValue && typeof nestedValue === 'object') {
        if (seen.has(nestedValue)) return '[Circular]';
        seen.add(nestedValue);
      }
      return nestedValue;
    }, 2);
    return serialized || String(value);
  } catch {
    return String(value);
  }
};

/** Convert any graph property into text that React can safely render. */
export const formatInfocardValue = (value, { emptyValue = EMPTY_INFOCARD_VALUE } = {}) => {
  if (value === undefined || value === null || value === '') return emptyValue;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) {
    if (value.some((item) => item && typeof item === 'object')) {
      return stringifyStructuredValue(value);
    }
    const items = value
      .map((item) => formatInfocardValue(item, { emptyValue: '' }))
      .filter((item) => item !== '');
    return items.length ? items.join('; ') : emptyValue;
  }
  if (typeof value === 'object') return stringifyStructuredValue(value);
  return String(value);
};

export const getInfocardHref = (value, format = 'link') => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const source = value.trim();
  if (format === 'doi') {
    const doi = source.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^DOI:/i, '');
    return /^10\.\d{4,9}\/.+/.test(doi) ? `https://doi.org/${encodeURI(doi)}` : '';
  }
  if (format === 'pubmed') {
    const pubmedId = source.replace(/^PMID:/i, '').trim();
    return /^\d+$/.test(pubmedId) ? `https://pubmed.ncbi.nlm.nih.gov/${pubmedId}/` : '';
  }
  try {
    const url = new URL(source);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};
