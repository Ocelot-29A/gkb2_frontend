import { parseGraphViewerInputs } from './GraphViewerQueryDialog';

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
