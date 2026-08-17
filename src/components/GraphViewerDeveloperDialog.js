import React, {
  forwardRef, useEffect, useImperativeHandle, useMemo, useState,
} from 'react';

import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Tab, Tabs, Typography,
} from '@mui/material';

import {
  resolveInfoPanelDefinition,
  validateInfoPanel,
  validateRawGraphRecord,
} from './graphViewerDeveloperMode';
import GraphInfocard from './GraphInfocard';

const pretty = (value) => JSON.stringify(value, null, 2);

const parseBuffer = (buffer, validator) => {
  try {
    const value = JSON.parse(buffer);
    return { value, errors: validator(value) };
  } catch (error) {
    return { value: null, errors: [`Invalid JSON: ${error.message}`] };
  }
};

const GraphViewerDeveloperDialog = forwardRef(function GraphViewerDeveloperDialog({
  open,
  selection,
  adapter,
  viewId,
  permissions,
  infoPanelOverrides,
  onInfoPanelOverride,
  onRecordSaved,
  onClose,
  onNavigate,
  onPreview,
  onDirtyChange,
}, ref) {
  const [tab, setTab] = useState(0);
  const [recordBuffer, setRecordBuffer] = useState('');
  const [panelBuffer, setPanelBuffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const kind = selection?.kind || 'node';
  const type = selection?.type || '';
  const original = selection?.record || null;
  const resolvedPanel = useMemo(
    () => resolveInfoPanelDefinition(kind, type, infoPanelOverrides),
    [kind, type, infoPanelOverrides],
  );

  useEffect(() => {
    if (!open || !original) return;
    setTab(0);
    setRecordBuffer(pretty(original));
    setPanelBuffer(pretty(resolvedPanel.panel));
    setMessage(null);
  }, [open, original, resolvedPanel.panel]);

  const recordDirty = Boolean(original) && recordBuffer !== pretty(original);
  const panelDirty = Boolean(original) && panelBuffer !== pretty(resolvedPanel.panel);
  const dirty = recordDirty || panelDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const liveValidation = useMemo(() => (
    tab === 0
      ? parseBuffer(recordBuffer, (edited) => validateRawGraphRecord(original, edited))
      : parseBuffer(panelBuffer, validateInfoPanel)
  ), [tab, recordBuffer, panelBuffer, original]);
  const previewProperties = original?.['~properties'] || {};
  const previewPanel = tab === 1 && liveValidation.value ? liveValidation.value : resolvedPanel.panel;
  const changedTopLevelFields = useMemo(() => {
    if (tab !== 0 || !liveValidation.value || !original) return [];
    return Array.from(new Set([...Object.keys(original), ...Object.keys(liveValidation.value)]))
      .filter((key) => pretty(original[key]) !== pretty(liveValidation.value[key]));
  }, [tab, liveValidation.value, original]);

  const validateRecordBuffer = () => {
    return parseBuffer(recordBuffer, (edited) => validateRawGraphRecord(original, edited));
  };
  const validatePanelBuffer = () => {
    return parseBuffer(panelBuffer, validateInfoPanel);
  };

  const formatCurrent = () => {
    const result = tab === 0 ? validateRecordBuffer() : validatePanelBuffer();
    if (!result.value) return;
    if (tab === 0) setRecordBuffer(pretty(result.value));
    else setPanelBuffer(pretty(result.value));
  };

  const saveCurrent = async () => {
    const result = tab === 0 ? validateRecordBuffer() : validatePanelBuffer();
    if (!result.value || result.errors.length) return false;
    setSaving(true);
    setMessage(null);
    try {
      if (tab === 0) {
        const response = await adapter.saveRecord({
          original,
          edited: result.value,
          context: { viewId, kind, type },
        });
        onRecordSaved?.(response?.record || result.value);
      } else {
        const response = await adapter.saveInfoPanel({ kind, type, panel: result.value });
        onInfoPanelOverride?.(kind, type, response?.panel || result.value);
      }
      setMessage({ severity: 'success', text: adapter.mode === 'export' ? 'Validated patch downloaded.' : 'Saved successfully.' });
      return true;
    } catch (error) {
      setMessage({ severity: 'error', text: error.message || 'Save failed.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    const recordResult = parseBuffer(recordBuffer, (edited) => validateRawGraphRecord(original, edited));
    const panelResult = parseBuffer(panelBuffer, validateInfoPanel);
    if (recordDirty && (!recordResult.value || recordResult.errors.length)) {
      setTab(0);
      return false;
    }
    if (panelDirty && (!panelResult.value || panelResult.errors.length)) {
      setTab(1);
      return false;
    }
    setSaving(true);
    setMessage(null);
    try {
      if (recordDirty) {
        const response = await adapter.saveRecord({
          original,
          edited: recordResult.value,
          context: { viewId, kind, type },
        });
        onRecordSaved?.(response?.record || recordResult.value);
      }
      if (panelDirty) {
        const response = await adapter.saveInfoPanel({ kind, type, panel: panelResult.value });
        onInfoPanelOverride?.(kind, type, response?.panel || panelResult.value);
      }
      setMessage({ severity: 'success', text: adapter.mode === 'export' ? 'Validated patches downloaded.' : 'Saved successfully.' });
      return true;
    } catch (error) {
      setMessage({ severity: 'error', text: error.message || 'Save failed.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({ save: saveAll }));

  const resetPanel = async () => {
    setSaving(true);
    try {
      await adapter.resetInfoPanel({ kind, type });
      onInfoPanelOverride?.(kind, type, null);
      setPanelBuffer(pretty(resolveInfoPanelDefinition(kind, type, {}).panel));
      setMessage({ severity: 'success', text: 'Type override removed; inherited panel restored.' });
    } catch (error) {
      setMessage({ severity: 'error', text: error.message || 'Reset failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: '92vw', minWidth: 'min(1100px, 92vw)', height: '86vh', maxWidth: 'none', borderRadius: '16px' } }}>
      <DialogTitle sx={{ padding: '18px 24px 10px' }}>
        <Typography component="div" sx={{ fontWeight: 700, fontSize: '20px' }}>Graph Viewer Developer Mode</Typography>
        <Typography component="div" sx={{ color: '#667085', fontSize: '12px', marginTop: '4px' }}>
          {`${selection?.name || selection?.id || 'Record'} · ${kind} ${type} · view ${viewId || 'unknown'} · ${selection?.source || 'graph.json'} · ${dirty ? 'unsaved edits' : 'saved'}`}
        </Typography>
      </DialogTitle>
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ paddingX: '20px', borderBottom: '1px solid #E5E7EB' }}>
        <Tab label="Raw data" />
        <Tab label="Hover panel schema" />
      </Tabs>
      <DialogContent sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 310px', gap: '16px', padding: '16px 20px', overflow: 'hidden' }}>
        <Box sx={{ minWidth: 0, height: '100%', border: '1px solid #D0D5DD', borderRadius: '10px', overflow: 'auto' }}>
          <CodeMirror
            value={tab === 0 ? recordBuffer : panelBuffer}
            height="calc(86vh - 220px)"
            extensions={[json()]}
            onChange={tab === 0 ? setRecordBuffer : setPanelBuffer}
            editable={tab === 0 ? permissions?.editData !== false : permissions?.editInfoPanel !== false}
            basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, searchKeymap: true }}
          />
        </Box>
        <Box sx={{ overflowY: 'auto', padding: '14px', border: '1px solid #E5E7EB', borderRadius: '10px', background: '#FAFAFA' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Validation</Typography>
          {liveValidation.errors.length ? (
            liveValidation.errors.map((error) => <Alert key={error} severity="error" sx={{ marginBottom: '8px' }}>{error}</Alert>)
          ) : <Alert severity="info">Use Validate before saving. Identity and endpoint fields are protected.</Alert>}
          {tab === 0 && (
            <Box sx={{ marginTop: '14px' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '12px' }}>Before / after</Typography>
              <Typography sx={{ fontSize: '12px', color: '#667085' }}>
                {changedTopLevelFields.length ? `Changed: ${changedTopLevelFields.join(', ')}` : 'No source fields changed.'}
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '12px', marginTop: '12px' }}>Derived rendering fields (read-only)</Typography>
              <Box component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '10px', maxHeight: '120px', overflow: 'auto' }}>
                {pretty(selection?.derivedData || {})}
              </Box>
            </Box>
          )}
          {tab === 1 && (
            <Box sx={{ marginTop: '14px' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '12px' }}>Resolution</Typography>
              <Typography sx={{ fontSize: '12px', color: '#667085' }}>{resolvedPanel.source}</Typography>
              {resolvedPanel.profile && <Typography sx={{ fontSize: '12px', color: '#667085' }}>{`Shared profile: ${resolvedPanel.profile}. Saving creates a ${type}-only override.`}</Typography>}
              {resolvedPanel.relatedTypes?.length > 1 && <Typography sx={{ fontSize: '11px', color: '#667085', marginTop: '4px' }}>{`Also used by: ${resolvedPanel.relatedTypes.filter((value) => value !== type).join(', ')}`}</Typography>}
              <Typography sx={{ fontWeight: 700, fontSize: '12px', marginTop: '12px' }}>Live hover-card preview</Typography>
              <Box sx={{ background: '#FFF', border: '1px solid #D0D5DD', borderRadius: '8px', marginTop: '6px', overflow: 'hidden' }}>
                <GraphInfocard
                  hoveredData={{ ...previewProperties, type, ...(kind === 'edge' ? { source: 'preview-source', target: 'preview-target' } : {}) }}
                  infoPanelOverrides={{ [kind]: { [type]: previewPanel } }}
                />
              </Box>
            </Box>
          )}
          {message && <Alert severity={message.severity} sx={{ marginTop: '14px' }}>{message.text}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: '10px 20px 18px', gap: '8px' }}>
        {selection?.preview && <Button onClick={onPreview}>Preview pathway</Button>}
        {selection?.graphLink && <Button onClick={onNavigate}>Open linked graph</Button>}
        {tab === 1 && <Button disabled={saving} color="warning" onClick={resetPanel}>Reset to inherited</Button>}
        <Box sx={{ flex: 1 }} />
        <Button onClick={formatCurrent}>Format</Button>
        <Button onClick={tab === 0 ? validateRecordBuffer : validatePanelBuffer}>Validate</Button>
        <Button onClick={onClose}>Close</Button>
        <Button disabled={saving || liveValidation.errors.length > 0 || !liveValidation.value} variant="contained" onClick={saveCurrent}>{adapter?.mode === 'export' ? 'Export patch' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
});

export default GraphViewerDeveloperDialog;
