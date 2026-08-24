import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Link,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';

import {
  hydrateAiSearchCandidates,
  preferredSearchLocation,
  searchGraphIndex,
} from './graphViewerSearch';

const MAX_QUERY_LENGTH = 300;

const sentence = (value, limit = 240) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trim()}…` : text;
};

export const searchLocationLabel = (location, locations = []) => {
  const parts = [
    location?.layer ? `Layer ${location.layer}` : '',
    location?.view_title || location?.view_id,
    location?.organ,
  ].filter(Boolean);
  const sameViewLocations = locations.filter((candidate) => (
    candidate?.view_id && candidate.view_id === location?.view_id
  ));
  if (sameViewLocations.length > 1) {
    const occurrenceLabel = location?.viewer_occurrence_role
      || location?.occurrence_label
      || location?.node_id
      || location?.location_id;
    if (occurrenceLabel) {
      parts.push(String(occurrenceLabel).replace(/_/g, ' '));
    }
  }
  return parts.join(' · ');
};

export const searchLocationSelectorLabel = (locations = []) => {
  const uniqueViews = new Set(locations.map((location) => location?.view_id).filter(Boolean));
  return uniqueViews.size === locations.length
    ? `Appears in ${locations.length} views`
    : `Appears in ${locations.length} locations`;
};

const provenanceLabel = (record) => {
  if (record.generated) return 'Generated fallback — not evidence';
  if (record.provenance_status === 'source_backed') return 'Source-backed';
  return 'Curated mechanism record';
};

const SearchResultCard = ({ record, currentViewId, onOpen, active, optionId }) => {
  const initialLocation = preferredSearchLocation(record, currentViewId);
  const [locationId, setLocationId] = useState(initialLocation?.location_id || '');
  useEffect(() => {
    setLocationId(preferredSearchLocation(record, currentViewId)?.location_id || '');
  }, [currentViewId, record]);
  const location = (record.locations || []).find((item) => item.location_id === locationId)
    || initialLocation;
  const primarySource = record.sources?.[0]?.data_source || record.data_source || '';

  return (
    <Box
      id={optionId}
      role="option"
      aria-selected={active}
      sx={{
        border: `1px solid ${active ? '#315F5A' : '#DED8CF'}`,
        borderRadius: '12px',
        padding: '14px 16px',
        background: active ? '#F3F8F5' : '#FFFFFF',
        boxShadow: active ? '0 0 0 2px rgba(49, 95, 90, 0.12)' : 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '7px', marginBottom: '5px' }}>
            <Typography sx={{ fontSize: '16px', lineHeight: 1.25, fontWeight: 700, color: '#203D3A' }}>
              {record.name}
            </Typography>
            <Chip size="small" label={record.entity_type || 'Entity'} sx={{ height: '22px', fontSize: '11px' }} />
            <Chip
              size="small"
              color={record.generated ? 'warning' : 'success'}
              variant="outlined"
              label={provenanceLabel(record)}
              sx={{ height: '22px', fontSize: '10px' }}
            />
          </Box>
          <Typography sx={{ fontSize: '12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#65736F', overflowWrap: 'anywhere' }}>
            {[record.symbol, record.canonical_id].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).join(' · ')}
          </Typography>
          {record.description && (
            <Typography sx={{ marginTop: '7px', fontSize: '13px', lineHeight: 1.45, color: '#44524F' }}>
              {sentence(record.description)}
            </Typography>
          )}
          <Typography sx={{ marginTop: '7px', fontSize: '11px', color: '#75817E' }}>
            Match: {record.search_match?.reasons?.join('; ') || 'indexed field'}
            {primarySource ? ` · Source: ${primarySource}` : ''}
          </Typography>
        </Box>
        <Box sx={{ width: '280px', flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(record.locations || []).length > 1 ? (
            <TextField
              select
              size="small"
              label={searchLocationSelectorLabel(record.locations)}
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: '320px' } } } }}
            >
              {(record.locations || []).map((item) => (
                <MenuItem key={item.location_id} value={item.location_id}>
                  {searchLocationLabel(item, record.locations)}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Typography sx={{ fontSize: '11px', color: '#65736F', lineHeight: 1.35 }}>
              {searchLocationLabel(location, record.locations)}
            </Typography>
          )}
          <Button
            variant="contained"
            disabled={!location}
            onClick={() => location && onOpen(record, location)}
            sx={{ background: '#315F5A', textTransform: 'none', fontWeight: 700, '&:hover': { background: '#254B47' } }}
          >
            Open &amp; focus
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default function GraphViewerSearchDialog({
  open,
  index,
  currentViewId = '',
  indexUrl = '',
  onClose,
  onOpenResult,
  searchProvider = null,
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [layer, setLayer] = useState('All');
  const [provenance, setProvenance] = useState('All');
  const [activeIndex, setActiveIndex] = useState(0);
  const [providerResults, setProviderResults] = useState(null);
  const [providerError, setProviderError] = useState('');

  const categories = useMemo(() => (
    ['All', ...new Set((index?.records || []).map((record) => record.entity_type).filter(Boolean))]
  ), [index]);
  const lexicalResults = useMemo(() => searchGraphIndex(index, query, {
    category, layer, provenance, currentViewId, limit: 40,
  }), [category, currentViewId, index, layer, provenance, query]);
  const results = providerResults || lexicalResults;

  useEffect(() => {
    setActiveIndex(0);
    setProviderResults(null);
    setProviderError('');
  }, [query, category, layer, provenance, open]);

  useEffect(() => {
    if (!searchProvider || !query.trim()) return undefined;
    let active = true;
    Promise.resolve(searchProvider({
      schema_version: 't1d-gps-ai-search-request-v1',
      query,
      filters: { category, layer, provenance },
      index_checksum: index?.index_checksum,
      candidates: lexicalResults.map((record) => ({
        search_id: record.search_id,
        name: record.name,
        entity_type: record.entity_type,
        aliases: record.aliases || [],
        description: sentence(record.description, 320),
      })),
    })).then((value) => {
      if (!active) return;
      const hydrated = hydrateAiSearchCandidates(index, value, { limit: 40 });
      if (hydrated.accepted && hydrated.results.length) {
        setProviderResults(hydrated.results);
        return;
      }
      setProviderResults(null);
      if (!hydrated.accepted) {
        setProviderError('AI ranking did not match this index; showing deterministic lexical matches.');
      }
    }).catch(() => {
      if (active) setProviderError('AI ranking was unavailable; showing deterministic lexical matches.');
    });
    return () => { active = false; };
  }, [category, index, layer, lexicalResults, provenance, query, searchProvider]);

  const openActiveResult = () => {
    const record = results[activeIndex];
    const location = preferredSearchLocation(record, currentViewId);
    if (record && location) onOpenResult?.(record, location);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: '92vw', maxWidth: '1120px', height: '84vh', maxHeight: '860px', borderRadius: '16px' } }}
    >
      <DialogTitle sx={{ paddingBottom: '8px' }}>
        <Typography component="div" sx={{ fontSize: '21px', fontWeight: 750, color: '#203D3A' }}>
          Search T1D immune GPS
        </Typography>
        <Typography sx={{ marginTop: '3px', fontSize: '12px', color: '#71807C' }}>
          Find genes, proteins, cells, processes, pathways, anatomy, and stable database identifiers.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <TextField
          autoFocus
          fullWidth
          value={query}
          placeholder="Search INS, CXCR3, beta-cell killing, WP661…"
          onChange={(event) => setQuery(event.target.value.slice(0, MAX_QUERY_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && results.length) {
              event.preventDefault();
              setActiveIndex((current) => Math.min(results.length - 1, current + 1));
            } else if (event.key === 'ArrowUp' && results.length) {
              event.preventDefault();
              setActiveIndex((current) => Math.max(0, current - 1));
            } else if (event.key === 'Enter' && results.length) {
              event.preventDefault();
              openActiveResult();
            }
          }}
          inputProps={{
            role: 'combobox',
            'aria-expanded': Boolean(query.trim()),
            'aria-controls': 't1d-gps-search-results',
            'aria-activedescendant': results.length ? `t1d-search-result-${activeIndex}` : undefined,
            maxLength: MAX_QUERY_LENGTH,
          }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#315F5A' }} /></InputAdornment>,
          }}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr', gap: '10px', marginTop: '12px' }}>
          <TextField select size="small" label="Entity type" value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Layer" value={layer} onChange={(event) => setLayer(event.target.value)}>
            {['All', '1', '2', '3'].map((item) => <MenuItem key={item} value={item}>{item === 'All' ? item : `Layer ${item}`}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Provenance" value={provenance} onChange={(event) => setProvenance(event.target.value)}>
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="source_backed">Source-backed</MenuItem>
            <MenuItem value="curated">Curated</MenuItem>
            <MenuItem value="generated_fallback">Generated fallback</MenuItem>
          </TextField>
        </Box>
        <Typography aria-live="polite" sx={{ margin: '12px 2px 8px', fontSize: '12px', color: '#65736F' }}>
          {query.trim() ? `${results.length} ranked result${results.length === 1 ? '' : 's'}` : 'Enter a name, symbol, synonym, or identifier.'}
          {providerError ? ` ${providerError}` : ''}
        </Typography>
        <Box id="t1d-gps-search-results" role="listbox" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '2px 4px 8px 2px' }}>
          {query.trim() && results.map((record, resultIndex) => (
            <SearchResultCard
              key={record.search_id}
              optionId={`t1d-search-result-${resultIndex}`}
              record={record}
              currentViewId={currentViewId}
              active={activeIndex === resultIndex}
              onOpen={onOpenResult}
            />
          ))}
          {query.trim() && !results.length && (
            <Box sx={{ padding: '40px 20px', textAlign: 'center', color: '#65736F' }}>
              <Typography sx={{ fontWeight: 700 }}>No indexed match</Typography>
              <Typography sx={{ marginTop: '6px', fontSize: '13px' }}>Try a stable ID, official symbol, shorter phrase, or another entity type.</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: '10px 20px 14px' }}>
        <Typography sx={{ flex: 1, fontSize: '11px', color: '#75817E' }}>
          Deterministic lexical search · index {index?.schema_version || 'unknown'}
          {indexUrl && (
            <> · <Link href={indexUrl} target="_blank" rel="noopener noreferrer">Machine-readable JSON</Link></>
          )}
        </Typography>
        <Button onClick={onClose} sx={{ color: '#315F5A', textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
