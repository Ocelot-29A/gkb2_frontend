const download = (filename, value) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Developer API failed: ${response.status}`);
  return body;
};

const validObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${label} must be an object.`];
  }
  return [];
};

const createExportAdapter = (release) => ({
  mode: 'export',
  loadRecord: async ({ record }) => ({ record }),
  validateRecord: ({ edited }) => validObject(edited, 'Record'),
  saveRecord: async ({ original, edited, context }) => {
    const patch = { kind: 'record', release, context, original, edited };
    download(`t1d-gps-${context.viewId}-record.patch.json`, patch);
    return { record: edited };
  },
  loadInfoPanel: async ({ panel }) => ({ panel }),
  validateInfoPanel: ({ panel }) => (Array.isArray(panel) || (panel && typeof panel === 'object') ? [] : ['Info panel must be an array or V2 object.']),
  saveInfoPanel: async ({ kind, type, panel }) => {
    download(`graph-viewer-schema.${type}.patch.json`, { kind, type, info_panel: panel });
    return { panel };
  },
  resetInfoPanel: async ({ kind, type }) => download(`graph-viewer-schema.${type}.reset.patch.json`, { kind, type, reset: true }),
  saveLayout: async ({ viewId, positions }) => download(`t1d-gps-${viewId}-layout.patch.json`, { release, view_id: viewId, positions }),
  compileView: async ({ viewId }) => ({ view_id: viewId, status: 'export-only' }),
  exportPatch: async ({ kind, payload }) => download(`t1d-gps-${kind}.patch.json`, payload),
});

export const createT1dGpsAuthoringAdapter = ({
  local,
  release = 'v5',
  apiBase = process.env.REACT_APP_GRAPH_VIEWER_DEV_API_URL || 'http://127.0.0.1:8787/api/graph-viewer/dev',
}) => {
  if (!local) return createExportAdapter(release);
  return {
    mode: 'local',
    loadRecord: ({ viewId, id }) => requestJson(`${apiBase}/records/${encodeURIComponent(viewId)}/${encodeURIComponent(id)}`),
    validateRecord: ({ edited }) => validObject(edited, 'Record'),
    saveRecord: ({ original, edited, context }) => requestJson(`${apiBase}/records/${encodeURIComponent(context.viewId)}/${encodeURIComponent(original['~id'])}`, { method: 'PATCH', body: JSON.stringify({ original, edited, release }) }),
    loadInfoPanel: ({ kind, type }) => requestJson(`${apiBase}/info-panels/${encodeURIComponent(kind)}/${encodeURIComponent(type)}`),
    validateInfoPanel: ({ panel }) => (Array.isArray(panel) || (panel && typeof panel === 'object') ? [] : ['Info panel must be an array or V2 object.']),
    saveInfoPanel: ({ kind, type, panel }) => requestJson(`${apiBase}/info-panels/${encodeURIComponent(kind)}/${encodeURIComponent(type)}`, { method: 'PUT', body: JSON.stringify({ panel }) }),
    resetInfoPanel: ({ kind, type }) => requestJson(`${apiBase}/info-panels/${encodeURIComponent(kind)}/${encodeURIComponent(type)}`, { method: 'DELETE' }),
    saveLayout: ({ viewId, positions }) => requestJson(`${apiBase}/layouts/${encodeURIComponent(viewId)}`, { method: 'PUT', body: JSON.stringify({ release, positions }) }),
    compileView: ({ viewId }) => requestJson(`${apiBase}/compile/${encodeURIComponent(viewId)}`, { method: 'POST', body: JSON.stringify({ release }) }),
    exportPatch: async ({ kind, payload }) => download(`t1d-gps-${kind}.patch.json`, payload),
  };
};
