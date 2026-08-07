import {
  inverseLayoutPosition,
  navigationLabel,
  resolveInfoPanelDefinition,
  validateInfoPanel,
  validateRawGraphRecord,
} from './graphViewerDeveloperMode';

describe('graph viewer developer mode contract', () => {
  test('protects node identity while allowing biological properties to change', () => {
    const original = {
      '~id': 'process:1',
      '~labels': ['Process'],
      '~properties': { id: 'process:1', canonical_id: 'GO:1', description: 'before' },
    };
    expect(validateRawGraphRecord(original, {
      ...original,
      '~properties': { ...original['~properties'], description: 'after' },
    })).toEqual([]);
    expect(validateRawGraphRecord(original, { ...original, '~id': 'changed' }))
      .toContain('~id is protected and cannot be changed.');
  });

  test('protects edge endpoints and validates relationship type', () => {
    const original = {
      '~id': 'edge:1', '~start': 'a', '~end': 'b', '~type': 'ADJACENT_TO', '~properties': { id: 'edge:1' },
    };
    expect(validateRawGraphRecord(original, { ...original, '~start': 'other' }))
      .toContain('~start is protected and cannot be changed.');
    expect(validateRawGraphRecord(original, { ...original, '~type': 'NOT_A_SCHEMA_TYPE' }))
      .toContain('~type must be a relationship type declared by the graph viewer schema.');
  });

  test('validates schema structure and resolves a type-only override', () => {
    expect(validateInfoPanel([['Title', 'name'], ['Title', 'other']]))
      .toContain('Info panel must contain exactly one Title section.');
    const override = [['Title', 'name'], ['Description', 'description']];
    expect(resolveInfoPanelDefinition('node', 'Process', { node: { Process: override } }))
      .toEqual({ panel: override, source: 'type override', profile: null, relatedTypes: [] });
  });

  test('inverts the existing fixture coordinate transform', () => {
    expect(inverseLayoutPosition({ x: 50, y: 70 }, { Level: 'Core' }))
      .toEqual({ x: 100, y: 70, Level: 'Core' });
  });

  test('uses a meaningful first navigation label', () => {
    expect(navigationLabel({ type: 'Process' })).toBe('Open pathway');
    expect(navigationLabel({ navigation_action: 'detail view' })).toBe('Open detail');
    expect(navigationLabel({
      type: 'Process',
      navigation_action: 'Open linked graph',
      graph_link: '/T1D_GPS/v6/details/cd8-stemlike-reservoir-continuous-seeding?focus=L3C03',
    })).toBe('Open detail');
    expect(navigationLabel({
      type: 'Process',
      graph_link: '/T1D_GPS/v6/pathways/islet-major-events',
    })).toBe('Open pathway');
    expect(navigationLabel({ type: 'Anatomy' })).toBe('Open linked graph');
  });
});
