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
    const items = value
      .map((item) => formatInfocardValue(item, { emptyValue: '' }))
      .filter((item) => item !== '');
    return items.length ? items.join('; ') : emptyValue;
  }
  if (typeof value === 'object') return stringifyStructuredValue(value);
  return String(value);
};

export const getInfocardHref = (value) => (
  typeof value === 'string' && value.trim() ? value.trim() : ''
);
