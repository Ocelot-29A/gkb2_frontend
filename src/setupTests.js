jest.mock('@uiw/react-codemirror', () => function MockCodeMirror({ value, onChange }) {
  const mockReact = require('react');
  return mockReact.createElement('textarea', {
    'aria-label': 'JSON editor',
    value,
    onChange: (event) => onChange?.(event.target.value),
  });
});

jest.mock('@codemirror/lang-json', () => ({ json: () => [] }));
