import React, {
    useEffect,
    useRef,
    useState,
} from 'react';

import cytoscape from 'cytoscape';
import {
    useDispatch,
    useSelector,
} from 'react-redux';

import {
    Box,
    Button,
    Stack,
    TextField,
} from '@mui/material';

import {
    addEdge,
    addNode,
    editEdge,
    editNode,
    redo,
    removeEdge,
    removeNode,
    undo,
    updateNodePosition,
    updateViewport,
} from '../redux/querySlice';

export const nodeAutoWidth = (node) => {
    const ctx = document.createElement('canvas').getContext("2d");
    const fStyle = node.pstyle('font-style').strValue;
    const size = node.pstyle('font-size').pfValue + 'px';
    const family = node.pstyle('font-family').strValue;
    const weight = node.pstyle('font-weight').strValue;

    ctx.font = fStyle + ' ' + weight + ' ' + size + ' ' + family;
    return ctx.measureText(node.data('label')).width;
};

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

export default function QueryPage() {
    const dispatch = useDispatch();
    const { nodes, edges, viewport } = useSelector(state => state.query);
    const viewportRef = useRef(viewport);
    useEffect(() => {
        viewportRef.current = viewport;
    }, [viewport]);
    const elementsRef = useRef({ nodes, edges });
    useEffect(() => {
        elementsRef.current = { nodes, edges };
    }, [nodes, edges]);

    const cyRef = useRef(null);
    const [cyContainerSize, setCyContainerSize] = useState({ width: 0, height: 0 });
    const [selected, setSelected] = useState([]);
    const unselectAll = () => {
        if (cyRef.current) {
            cyRef.current.elements().unselect();
        }
    }
    const [jsonInput, setJsonInput] = useState(
        JSON.stringify(
            {
                type: 'node',
                label: 'Sample Node',
                color: 'lightblue'
            },
            null,
            2 // pretty print
        )
    );

    // Ctrl-Z Ctrl-Y listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                dispatch(undo());
            } else if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                dispatch(redo());
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [dispatch]);

    // Sync elements with redux
    useEffect(() => {
        const containerSize = document.getElementById("cy-container").getBoundingClientRect();
        console.log(containerSize);
        setCyContainerSize({ width: containerSize.width, height: containerSize.height });
        cyRef.current = cytoscape({
            container: document.getElementById("cy-container"),
            elements: [],
            style: [
                {
                    selector: 'node',
                    style: {
                        shape: "round-rectangle",
                        "background-color": "data(color)",
                        "border-width": "1px",
                        "border-color": "black",
                        label: "data(label)",
                        "font-size": "12px",
                        "text-valign": "center",
                        color: "black",
                        width: nodeAutoWidth,
                        height: nodeAutoHeight,
                        "text-margin-y": "0.5px",
                        padding: "4px",
                        "text-outline-width": 0,
                        "text-outline-color": "#fff",
                        "text-outline-opacity": 0,
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        width: 3,
                        "line-color": "#d3d3d3",
                        "target-arrow-color": "#545454",
                        "target-arrow-shape": "vee",
                        "curve-style": "bezier",
                        "label": "data(label)",
                        "font-size": "10px",
                        "text-background-opacity": 1,
                        "text-background-color": "#F9FAFB",
                        "color": "#000",
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': '2px',
                        'border-color': 'blue'
                    }
                },
                {
                    selector: 'edge:selected',
                    style: {
                        'line-color': '#f00',            // highlight when selected
                        'target-arrow-color': '#f00',
                        'width': 4
                    }
                }
            ],
            layout: {
                name: 'preset',
                fit: false
            },
            zoom: 1,
            minZoom: 1,
            maxZoom: 12,
            pan: { x: containerSize.width / 2, y: containerSize.height / 2 },
            selectionType: "additive",
            autoungrabify: false,
            autounselectify: false
        });
        console.log(cyRef.current.pan());
        cyRef.current.on('select unselect', 'node, edge', () => {
            const sel = cyRef.current.$(':selected').map(el => ({ ...el.data() })); // clone here
            setSelected(sel);
        });
        cyRef.current.on('dragfree', 'node', (evt) => {
            const node = evt.target;
            dispatch(updateNodePosition({
                id: node.id(),
                position: node.position()
            }));
        });

        // Viewport change → update zoom/pan in Redux
        const updateView = () => {
            dispatch(updateViewport({
                zoom: cyRef.current.zoom(),
                pan: cyRef.current.pan()
            }));
        };
        cyRef.current.on('zoom pan', updateView);
        return () => {
            cyRef.current.removeListener('select unselect');
            cyRef.current.removeListener('dragfree');
            cyRef.current.removeListener('zoom pan', updateView);
        };
    }, []);

    useEffect(() => {
        // do a deep clone
        const nodes_copied = JSON.parse(JSON.stringify(nodes));
        const edges_copied = JSON.parse(JSON.stringify(edges));
        const viewport_copied = JSON.parse(JSON.stringify(viewportRef.current));
        cyRef.current?.json({
            elements: { nodes: nodes_copied, edges: edges_copied },
            zoom: viewport_copied.zoom,
            pan: viewport_copied.pan
        });
    }, [nodes, edges, viewportRef]);

    const handleAddEdit = () => {
        if (!jsonInput.trim()) return;
        try {
            const obj = JSON.parse(jsonInput);
            if (selected.length === 0 && obj.type === 'node') {
                dispatch(addNode({
                    node: obj,
                    position: {
                        x: (cyContainerSize.width / 2 - viewportRef.current.pan.x) / viewportRef.current.zoom,
                        y: (cyContainerSize.height / 2 - viewportRef.current.pan.y) / viewportRef.current.zoom
                    }
                }));
            } else if (selected.length === 1 && selected[0].type === 'node' && obj.type === 'node') {
                // Edit existing
                const sel = { ...selected[0] }; // clone before editing
                dispatch(editNode({ id: sel.id, ...obj }));
            } else if (selected.length === 1 && selected[0].type === 'edge' && obj.type === 'edge') {
                // Edit existing
                const sel = { ...selected[0] }; // clone before editing
                dispatch(editEdge({ id: sel.id, ...obj }));
            } else if (selected.length === 2 && selected[0].type === 'node' && selected[1].type === 'node' && obj.type === 'edge') {
                const sel1 = { ...selected[0] };
                const sel2 = { ...selected[1] };
                dispatch(addEdge({
                    source: sel1.id,
                    target: sel2.id,
                    ...obj
                }));
            }
            else {
                // error
            }
        } catch (err) {
            console.error('Invalid JSON', err);
        }
        unselectAll();
    };

    const handleDelete = () => {
        selected.forEach(sel => {
            if (sel.type === 'node') {
                dispatch(removeNode(sel.id));
            } else if (sel.type === 'edge') {
                dispatch(removeEdge(sel.id));
            }
        });
        unselectAll();
    };

    return (
        <Box p={2}>
            <Box
                sx={{
                    border: '1px solid #ccc',
                    height: '400px',
                    mb: 2
                }}
                id="cy-container"
            >
            </Box>

            <Stack spacing={2} direction="row">
                <Stack spacing={1} flexGrow={1}>
                    <TextField
                        label="JSON Input"
                        multiline
                        minRows={4}
                        fullWidth
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                    />
                    <Stack spacing={2} direction="row">
                        <Button variant="outlined" onClick={() => setJsonInput(
                            JSON.stringify(
                                {
                                    type: 'node',
                                    label: 'Sample Node',
                                    color: 'lightblue'
                                },
                                null,
                                2 // pretty print
                            )
                        )}>Default Node</Button>
                        <Button variant="outlined" onClick={() => setJsonInput(
                            JSON.stringify(
                                {
                                    type: 'edge',
                                    label: 'Sample Edge',
                                    color: 'lightgreen',

                                },
                                null,
                                2 // pretty print
                            )
                        )}>Default Edge</Button>
                    </Stack>
                </Stack>
                <Stack spacing={1}>
                    <Button variant="contained" onClick={handleAddEdit}>Add/Edit</Button>
                    <Button variant="outlined" color="error" onClick={handleDelete}>Delete</Button>
                    <Button variant="outlined" onClick={() => dispatch(undo())}>Undo</Button>
                    <Button variant="outlined" onClick={() => dispatch(redo())}>Redo</Button>
                </Stack>
            </Stack>
        </Box>
    );
}
