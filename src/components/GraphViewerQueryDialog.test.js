import {
  formatGraphViewerError,
  GraphViewerRequestError,
  parseGraphViewerInputs,
  requestGraphViewer,
} from './GraphViewerQueryDialog';

describe('parseGraphViewerInputs', () => {
  test('preserves a standalone PostgreSQL request object', () => {
    const request = {
      source: 'pgsql',
      api: 'chr/features/by-node',
      searched_id: 'ENSG00000001626',
      relative_position: 'downstream',
      feature_types: ['Gene'],
      limit: 1,
    };

    expect(parseGraphViewerInputs([JSON.stringify(request)])).toEqual([request]);
  });

  test('preserves mixed Neo4j and PostgreSQL entries from a request list', () => {
    const cypher = 'MATCH (g:Gene {id: "ENSG00000001626"}) RETURN collect(g) AS nodes, [] AS edges';
    const pgsql = {
      source: 'pgsql',
      api: 'chr/features/by-node',
      searched_id: 'ENSG00000001626',
      relative_position: 'downstream',
      feature_types: ['Gene'],
      limit: 1,
    };

    const parsed = parseGraphViewerInputs([JSON.stringify([cypher, pgsql])]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toContain('MATCH (g:Gene {id: "ENSG00000001626"})');
    expect(parsed[0]).toContain('RETURN collect(g) AS nodes, [] AS edges');
    expect(parsed[1]).toEqual(pgsql);
  });
});

describe('requestGraphViewer', () => {
  const request = { cypher: ['RETURN [] AS nodes, [] AS edges'] };

  test('returns a successful graph response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'request-success' },
      json: async () => ({
        combined_query_result: { nodes: [], edges: [] },
        xy_json: {},
        metadata: { request_id: 'request-success' },
      }),
    });

    const result = await requestGraphViewer(request, { fetchImpl, timeoutMs: 1000 });

    expect(result.graphData).toEqual({ nodes: [], edges: [] });
    expect(result.metadata.request_id).toBe('request-success');
    expect(fetchImpl.mock.calls[0][1].signal).toBeDefined();
  });

  test('preserves structured backend timeout details', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 504,
      headers: { get: () => 'request-timeout' },
      json: async () => ({
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'The graph request exceeded the backend time limit.',
          request_id: 'request-timeout',
          retryable: true,
          phase: 'query_1_neo4j',
        },
      }),
    });

    await expect(requestGraphViewer(request, { fetchImpl, timeoutMs: 1000 }))
      .rejects.toMatchObject({
        code: 'REQUEST_TIMEOUT',
        status: 504,
        requestId: 'request-timeout',
        retryable: true,
        phase: 'query_1_neo4j',
      });
  });

  test('supports legacy string errors while deployments transition', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => '' },
      json: async () => ({ error: 'Legacy backend failure.' }),
    });

    await expect(requestGraphViewer(request, { fetchImpl, timeoutMs: 1000 }))
      .rejects.toMatchObject({
        message: 'Legacy backend failure.',
        code: 'HTTP_500',
        retryable: false,
      });
  });

  test('aborts at the configured client timeout with a retryable error', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));

    try {
      const result = requestGraphViewer(request, { fetchImpl, timeoutMs: 50 });
      const rejection = expect(result).rejects.toMatchObject({
        code: 'CLIENT_TIMEOUT',
        retryable: true,
        phase: 'client_wait',
      });
      jest.advanceTimersByTime(50);
      await rejection;
    } finally {
      jest.useRealTimers();
    }
  });

  test('formats a request ID for support without exposing internals', () => {
    const error = new GraphViewerRequestError('Temporarily unavailable.', {
      requestId: 'request-123',
    });

    expect(formatGraphViewerError(error))
      .toBe('Temporarily unavailable. Request ID: request-123');
  });
});
