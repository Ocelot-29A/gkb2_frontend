const GREEK_NORMALIZATION = Object.freeze({
  'α': ' alpha ',
  'β': ' beta ',
  'γ': ' gamma ',
  'δ': ' delta ',
  'κ': ' kappa ',
});

export const normalizeBiomedicalText = (value) => {
  const expanded = Array.from(String(value ?? ''))
    .map((character) => GREEK_NORMALIZATION[character] || character)
    .join('');
  return expanded
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

export const tokenizeBiomedicalText = (value) => (
  normalizeBiomedicalText(value).split(' ').filter(Boolean)
);

const stringList = (value) => (
  Array.isArray(value)
    ? value.flatMap((item) => stringList(item))
    : value === null || value === undefined || value === ''
      ? []
      : [String(value)]
);

const identifierValues = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return stringList(value);
  return Object.values(value).flatMap((item) => stringList(item));
};

const recordSearchFields = (record) => {
  const names = [record.name, ...(record.names || [])].filter(Boolean);
  const aliases = stringList(record.aliases);
  const identifiers = [
    record.search_id,
    record.canonical_id,
    record.symbol,
    ...stringList(record.cross_references),
    ...identifierValues(record.identifiers),
  ].filter(Boolean);
  const contexts = (record.locations || []).flatMap((location) => [
    location.view_title,
    location.organ,
    location.compartment,
    location.view_id,
  ]).filter(Boolean);
  return {
    names,
    aliases,
    identifiers,
    descriptions: [record.description, record.mechanism_role].filter(Boolean),
    contexts,
  };
};

const normalizedValues = (values) => values.map(normalizeBiomedicalText).filter(Boolean);

const exactMatch = (query, values) => values.includes(query);
const tokenSet = (values) => new Set(values.flatMap(tokenizeBiomedicalText));

const bestChildMatch = (record, normalizedQuery, queryTokens) => {
  let best = null;
  for (const child of record.child_search || []) {
    const names = normalizedValues([child.name]);
    const aliases = normalizedValues(stringList(child.aliases));
    const identifiers = normalizedValues(stringList(child.identifiers));
    const searchableTokens = tokenSet([...names, ...aliases, ...identifiers]);
    let score = 0;
    if (exactMatch(normalizedQuery, identifiers)) score = 840;
    else if (exactMatch(normalizedQuery, names)) score = 820;
    else if (exactMatch(normalizedQuery, aliases)) score = 780;
    else if (queryTokens.every((token) => searchableTokens.has(token))) score = 660;
    else if (
      normalizedQuery.includes(' ')
      && [...names, ...aliases].some((value) => value.includes(normalizedQuery))
    ) score = 520;
    if (!score || (best && best.score >= score)) continue;
    best = {
      score,
      child,
      explanation: child.match_explanation
        || `Matched through child ${String(child.entity_type || 'entity').toLowerCase()}: ${child.name}`,
    };
  }
  return best;
};

const scoreRecord = (record, query, currentViewId = '') => {
  const normalizedQuery = normalizeBiomedicalText(query);
  const queryTokens = tokenizeBiomedicalText(query);
  if (!normalizedQuery || !queryTokens.length) return null;

  const fields = recordSearchFields(record);
  const names = normalizedValues(fields.names);
  const aliases = normalizedValues(fields.aliases);
  const identifiers = normalizedValues(fields.identifiers);
  const descriptions = normalizedValues(fields.descriptions);
  const contexts = normalizedValues(fields.contexts);
  const reasons = [];
  const matchedFields = [];
  let score = 0;
  let exact = false;
  let matchedVia = 'record';
  let matchedChild = null;

  if (exactMatch(normalizedQuery, identifiers)) {
    score = Math.max(score, 1000);
    exact = true;
    reasons.push('Exact identifier match');
    matchedFields.push('identifier');
  }
  if (record.symbol && normalizeBiomedicalText(record.symbol) === normalizedQuery) {
    score = Math.max(score, 960);
    exact = true;
    reasons.push('Exact symbol match');
    matchedFields.push('symbol');
  }
  if (exactMatch(normalizedQuery, names)) {
    score = Math.max(score, 920);
    exact = true;
    reasons.push('Exact name match');
    matchedFields.push('name');
  }
  if (exactMatch(normalizedQuery, aliases)) {
    score = Math.max(score, 880);
    exact = true;
    reasons.push('Exact synonym match');
    matchedFields.push('synonym');
  }

  const searchableTokens = tokenSet([...names, ...aliases, ...identifiers]);
  const allTokensPresent = queryTokens.every((token) => searchableTokens.has(token));
  if (allTokensPresent) {
    score = Math.max(score, 700 + Math.min(80, queryTokens.length * 12));
    reasons.push('All query terms match');
    matchedFields.push('terms');
  }

  const compactNumericIdentifier = queryTokens.length === 1
    && /^[a-z]+\d+$/.test(queryTokens[0]);
  if (!compactNumericIdentifier) {
    const boundaryPrefix = [...searchableTokens].some((token) => (
      queryTokens.every((queryToken) => token.startsWith(queryToken))
    ));
    if (boundaryPrefix) {
      score = Math.max(score, 620);
      reasons.push('Term prefix match');
      matchedFields.push('prefix');
    }
  }

  const allowPhraseSubstring = normalizedQuery.includes(' ')
    || (normalizedQuery.length >= 5 && !compactNumericIdentifier);
  if (allowPhraseSubstring && names.some((value) => value.includes(normalizedQuery))) {
    score = Math.max(score, 580);
    reasons.push('Name contains query');
    matchedFields.push('name');
  }
  if (allowPhraseSubstring && aliases.some((value) => value.includes(normalizedQuery))) {
    score = Math.max(score, 540);
    reasons.push('Synonym contains query');
    matchedFields.push('synonym');
  }
  if (allowPhraseSubstring && descriptions.some((value) => value.includes(normalizedQuery))) {
    score = Math.max(score, 340);
    reasons.push('Description contains query');
    matchedFields.push('description');
  }
  if (allowPhraseSubstring && contexts.some((value) => value.includes(normalizedQuery))) {
    score = Math.max(score, 300);
    reasons.push('Graph context contains query');
    matchedFields.push('context');
  }

  const childMatch = bestChildMatch(record, normalizedQuery, queryTokens);
  if (childMatch && childMatch.score > score) {
    score = childMatch.score;
    matchedVia = 'child_entity';
    matchedChild = {
      search_id: childMatch.child.search_id,
      canonical_id: childMatch.child.canonical_id,
      name: childMatch.child.name,
      entity_type: childMatch.child.entity_type,
    };
    reasons.push(childMatch.explanation);
    matchedFields.push('child_entity');
  }

  if (!score) return null;
  const currentViewOccurrence = (record.locations || []).some((location) => (
    location.view_id === currentViewId
  ));
  if (currentViewOccurrence) score += 8;
  if (record.generated && !exact) score -= 20;

  return {
    ...record,
    search_match: {
      mode: 'lexical-v1',
      score,
      exact,
      matched_fields: [...new Set(matchedFields)],
      reasons: [...new Set(reasons)],
      matched_via: matchedVia,
      matched_child: matchedChild,
    },
  };
};

export const searchGraphIndex = (
  index,
  query,
  { category = 'All', layer = 'All', provenance = 'All', currentViewId = '', limit = 30 } = {},
) => {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  return (index?.records || [])
    .filter((record) => category === 'All' || record.entity_type === category)
    .filter((record) => layer === 'All' || (record.locations || []).some((location) => String(location.layer) === String(layer)))
    .filter((record) => provenance === 'All' || record.provenance_status === provenance)
    .map((record) => scoreRecord(record, query, currentViewId))
    .filter(Boolean)
    .sort((left, right) => (
      right.search_match.score - left.search_match.score
      || String(left.name || '').localeCompare(String(right.name || ''))
      || String(left.search_id || '').localeCompare(String(right.search_id || ''))
    ))
    .slice(0, safeLimit);
};

export const preferredSearchLocation = (record, currentViewId = '') => {
  const locations = record?.locations || [];
  return locations.find((location) => location.view_id === currentViewId)
    || locations.find((location) => location.location_id === record?.default_location_id)
    || locations.find((location) => location.is_primary)
    || locations[0]
    || null;
};

export const hydrateAiSearchCandidates = (index, response, { limit = 30 } = {}) => {
  if (!response || response.index_checksum !== index?.index_checksum) {
    return { accepted: false, reason: 'index_checksum_mismatch', results: [] };
  }
  const records = new Map((index?.records || []).map((record) => [record.search_id, record]));
  const results = [];
  for (const candidate of response.candidates || []) {
    const record = records.get(candidate.search_id);
    if (!record) continue;
    results.push({
      ...record,
      search_match: {
        mode: response.ranker || 'ai-rerank-v1',
        score: Number(candidate.score) || 0,
        exact: false,
        matched_fields: ['ai_rerank'],
        reasons: [candidate.explanation || candidate.reason_code || 'AI candidate reranking'],
        matched_via: 'ai_rerank',
        matched_child: null,
      },
    });
    if (results.length >= Math.max(1, Math.min(100, Number(limit) || 30))) break;
  }
  return { accepted: true, reason: '', results };
};
