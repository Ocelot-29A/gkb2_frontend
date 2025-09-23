import graphSchema from '../schema/graph_viewer_schema.json';

export const nodeAutoWidth = (node) => {
  const ctx = document.createElement('canvas').getContext("2d");
  const fStyle = node.pstyle('font-style').strValue;
  const size = node.pstyle('font-size').pfValue + 'px';
  const family = node.pstyle('font-family').strValue;
  const weight = node.pstyle('font-weight').strValue;

  ctx.font = fStyle + ' ' + weight + ' ' + size + ' ' + family;
  return ctx.measureText(node.data('label')).width;
};

export const textAutoWidth = (text, sx) => {
  const ctx = document.createElement('canvas').getContext("2d");
  const fStyle = sx.fontStyle || 'normal';
  const size = (sx.fontSize || '6px');
  const family = sx.fontFamily || 'Roboto';
  const weight = sx.fontWeight || 'normal';
  ctx.font = fStyle + ' ' + weight + ' ' + size + ' ' + family;

  return ctx.measureText(text).width;
}

export function darkenHex(hex, percent = 20) {
  // Normalize short #RGB → #RRGGBB
  if (hex.length === 4) {
    hex = "#" + [...hex.slice(1)].map(c => c + c).join("");
  }

  // Extract RGB components
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  // Apply darkening factor
  const factor = (100 - percent) / 100;
  r = Math.max(0, Math.min(255, Math.round(r * factor)));
  g = Math.max(0, Math.min(255, Math.round(g * factor)));
  b = Math.max(0, Math.min(255, Math.round(b * factor)));

  // Convert back to hex
  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

const nodeAutoHeight = (node) => {
  const ctx = document.createElement('canvas').getContext("2d");
  const fStyle = node.pstyle('font-style').strValue;
  const size = node.pstyle('font-size').pfValue + 'px';
  const family = node.pstyle('font-family').strValue;
  const weight = node.pstyle('font-weight').strValue;

  ctx.font = fStyle + ' ' + weight + ' ' + size + ' ' + family;
  const metrics = ctx.measureText(node.data('label'));
  return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
};

const defaultNodeStyle = {
  shape: "round-rectangle",
  "background-color": "white",
  "border-width": "1px",
  "border-color": "black",
  label: "data(label)",
  "font-size": "6px",
  "text-valign": "center",
  color: "#fff",
  width: nodeAutoWidth,
  height: nodeAutoHeight,
  "text-margin-y": "0.5px",
  padding: "4px",
  "text-outline-width": 0,
  "text-outline-color": "#fff",
  "text-outline-opacity": 0,
}

const defaultEdgeStyle = {
  width: 1,
  "line-color": "#d3d3d3",
  "target-arrow-color": "#545454",
  "target-arrow-shape": "vee",
  "arrow-scale": 0.4,
  "curve-style": "bezier",
  "label": "data(label)",
  "font-size": "4px",
  "text-background-opacity": 1,
  "text-background-color": "#F9FAFB",
  "color": "#000",
}

export const getContrastingColor = (bgColor) => {
  if (!/^#[0-9A-F]{6}$/i.test(bgColor)) {
    return 'black';
  }
  const hex = bgColor.replace(/^#/, '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? 'black' : 'white';
}

const mapSchemaProps = (schemaSection, prop) =>
  Object.fromEntries(
    Object.entries(schemaSection).map(([key, value]) => [key, value[prop]])
  );

export const nodeColors = mapSchemaProps(graphSchema.nodes, "node_color");
const nodeTextColors = mapSchemaProps(graphSchema.nodes, "text_color");
export const edgeLabels = mapSchemaProps(graphSchema.edges, "edge_label");
const edgeLabelColors = mapSchemaProps(graphSchema.edges, "text_color");

export const edgeIsInverted = Object.fromEntries(
  Object.entries(graphSchema.edges).map(([key, value]) => [key, value.inverted === "TRUE"])
);

export const legendSchema = graphSchema.legend;

const nodeColorsList = Object.keys(nodeColors).reduce(
  (acc, type) => (
    [
      ...acc,
      {
        type,
        color: nodeColors[type],
      }
    ]
  ), []);

const edgeColorsList = Object.keys(edgeLabels).reduce(
  (acc, type) => (
    [
      ...acc,
      {
        type,
        color: edgeLabelColors[type] || "#000",
      }
    ]
  ), []);

export const nodeStyle = nodeColorsList.map(({ color, type }) => ({
  // Core nodes style
  selector: `node[type = "${type}"][Level = "Core"]`,
  style: {
    ...defaultNodeStyle,
    "background-color": color,
    "border-color": color,
    color: nodeTextColors[type] || "#000",
  }
})).concat(
  nodeColorsList.map(({ color, type }) => ({
    // Neighbor nodes style
    selector: `node[type = "${type}"][Level = "Neighbor"]`,
    style: {
      ...defaultNodeStyle,
      "border-color": color,
      color: "#333",
    }
  }))
).concat([{
  selector: "edge",
  style: defaultEdgeStyle,
}])
  .concat(
    edgeColorsList.map(({ color, type }) => ({
      // Edge style
      selector: `edge[type = "${type}"]`,
      style: {
        ...defaultEdgeStyle,
        "color": color,
      },
    }))
  )
  .concat([
    // Node active state
    {
      selector: "node:active",
      style: {
        "overlay-padding": "0px",
        "overlay-opacity": 0,
      },
    },
  ]);
