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
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { nanoid } from '@reduxjs/toolkit';

import Logger from '../components/Logger';
import {
  editEdge,
  editNode,
  redo,
  removeEdge,
  removeNode,
  undo,
  updateNodePosition,
  updateViewport,
} from '../redux/querySlice';
import { queryQueryToCypher } from '../redux/queryToCypher';

export const nodeAutoWidth = (node) => {
    const cxt = document.createElement('canvas').getContext("2d");
    const fStyle = node.pstyle('font-style').strValue;
    const size = node.pstyle('font-size').pfValue + 'px';
    const family = node.pstyle('font-family').strValue;
    const weight = node.pstyle('font-weight').strValue;

    cxt.font = fStyle + ' ' + weight + ' ' + size + ' ' + family;
    return cxt.measureText(node.data('label')).width;
};

const nodeAutoHeight = (node) => {
    const cxt = document.createElement('canvas').getContext("2d");
    const fStyle = node.pstyle('font-style').strValue;
    const size = node.pstyle('font-size').pfValue + 'px';
    const family = node.pstyle('font-family').strValue;
    const weight = node.pstyle('font-weight').strValue;

    cxt.font = fStyle + ' ' + weight + ' ' + size + ' ' + family;
    const metrics = cxt.measureText(node.data('label'));
    return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
};

function NodeLabelPopup({ open, cyEle, onClose, onConfirm }) {
    const [inputProperty, setInputProperty] = useState({
        label: cyEle?.label || "",
        _label: cyEle?._label || "",
    });

    // Update input when cyEle changes
    React.useEffect(() => {
        if (cyEle) {
            setInputProperty({
                label: cyEle.label || "",
                _label: cyEle._label || "",
            });
        }
    }, [cyEle, open]);

    const handleConfirm = () => {
        if (!cyEle) return;
        if (!cyEle.label) return;

        // Return a new node object without mutating the original
        const newNode = {
            ...{
                ...cyEle,
                label: inputProperty.label
            }, ...(inputProperty._label.trim() !== "" ? { _label: inputProperty._label } : {})
        };
        onConfirm(newNode);
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Change Node Label</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Edit the label of the node. Press "Confirm" to apply.
                </DialogContentText>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Node Label"
                    type="text"
                    fullWidth
                    value={inputProperty.label}
                    onChange={(e) => setInputProperty((prev) => ({ ...prev, label: e.target.value }))}
                />
                <TextField
                    autoFocus
                    margin="dense"
                    label="Node Label 2"
                    type="text"
                    fullWidth
                    value={inputProperty._label}
                    onChange={(e) => setInputProperty((prev) => ({ ...prev, _label: e.target.value }))}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="secondary">
                    Quit
                </Button>
                <Button
                    onClick={() => {
                        handleConfirm();
                        onClose();
                    }}
                    color="primary"
                >
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    );
}

const addNodeThunk = (node, position) => (dispatch) => {
    const id = nanoid();
    dispatch(editNode({ node: { ...node, id }, position }));
    return id;
};

const addEdgeThunk = (edge) => (dispatch) => {
    const id = nanoid();
    dispatch(editEdge({ id, ...edge }));
    return id;
};

const getCenter = (cy, viewport) => {
    const cyContainerSize = cy.container().getBoundingClientRect();
    return {
        x: (cyContainerSize.width / 2 - viewport.pan.x) / viewport.zoom,
        y: (cyContainerSize.height / 2 - viewport.pan.y) / viewport.zoom
    };
};

const getDefRange = (cy, viewport, scale = 1) => {
    const cyContainerSize = cy.container().getBoundingClientRect();
    return {
        x: cyContainerSize.width / viewport.zoom * scale,
        y: cyContainerSize.height / viewport.zoom * scale
    };
};

function findEmptyPosition(cy, viewport, constraints, minDist = 80) {
    // const rect = {
    //     x1: center.x - range.x / 2,
    //     y1: center.y - range.y / 2,
    //     x2: center.x + range.x / 2,
    //     y2: center.y + range.y / 2,
    // }
    const rect = constraints.map(({ center, range }) => ({
        x1: center.x - range.x / 2,
        y1: center.y - range.y / 2,
        x2: center.x + range.x / 2,
        y2: center.y + range.y / 2,
    })).reduce((acc, curr) => {
        acc.x1 = Math.max(acc.x1, curr.x1);
        acc.y1 = Math.max(acc.y1, curr.y1);
        acc.x2 = Math.min(acc.x2, curr.x2);
        acc.y2 = Math.min(acc.y2, curr.y2);
        return acc;
    }, { x1: -Infinity, y1: -Infinity, x2: Infinity, y2: Infinity });

    const nodes = cy.nodes();
    const isOccupied = (p) =>
        nodes.some(n => {
            const np = n.position();
            const dx = np.x - p.x;
            const dy = np.y - p.y;
            return Math.sqrt(dx * dx + dy * dy) < minDist;
        });

    let pos = null;

    // Try 200 random positions
    for (let i = 0; i < 200; i++) {
        if (i === 100) minDist /= 2;
        const candidate = {
            x: rect.x1 + Math.random() * (rect.x2 - rect.x1),
            y: rect.y1 + Math.random() * (rect.y2 - rect.y1),
        };
        if (!isOccupied(candidate)) {
            pos = candidate;
            break;
        }
    }

    // Fallback
    if (!pos) {
        return [getCenter(cy, viewport), "Full"];
    }

    return [pos, undefined];
}

const defaultNode = {
    type: 'node',
    label: 'Sample Node',
    color: 'lightblue'
};

const defualtEdge = {
    type: 'edge',
    label: 'Sample Edge',
}


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
    // const [cyContainerSize, setCyContainerSize] = useState({ width: 0, height: 0 });
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

    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [menuVisible, setMenuVisible] = useState(false);
    const [contextTapElement, setContextTapElement] = useState(null);
    const [cxtDragFrom, setCxtDragFrom] = useState(null);
    const cxtDragFromRef = useRef(null);
    useEffect(() => {
        cxtDragFromRef.current = cxtDragFrom;
    }, [cxtDragFrom]);
    const [cxtDragTo, setCxtDragTo] = useState(null);
    const cxtDragToRef = useRef(null);
    useEffect(() => {
        cxtDragToRef.current = cxtDragTo;
    }, [cxtDragTo]);
    const [cxtDragEdge, setCxtDragEdge] = useState(null);
    const cxtDragEdgeRef = useRef(null);
    useEffect(() => {
        cxtDragEdgeRef.current = cxtDragEdge;
    }, [cxtDragEdge]);

    const [panelMode, setPanelMode] = useState("editNode");
    useEffect(() => {
        // one node: addedge1
        // two node: addedge2
        // else: editNode
        if (selected.length === 1 && selected[0].type === 'node') {
            setPanelMode("addedge1");
        } else if (selected.length === 2 && selected[0].type === 'node' && selected[1].type === 'node') {
            setPanelMode("addedge2");
        } else {
            setPanelMode("editNode");
        }
    }, [selected]);

    const [logger, setLogger] = useState([]);
    const log = (message) => {
        setLogger((prev) => [...prev, message]);
    };
    // const clearLog = () => {
    //     setLogger([]);
    // };

    useEffect(() => {
        const handleClickOutside = () => {
            if (menuVisible) setMenuVisible(false);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [menuVisible]);

    const handleRightClick = (event) => {

        const element = event.target;
        const renderedPos = event.renderedPosition; // {x, y} in canvas coords
        const cyContainer = cyRef.current.container();
        const rect = cyContainer.getBoundingClientRect();

        // Compute absolute page position
        const x = rect.left + renderedPos.x;
        const y = rect.top + renderedPos.y;
        setContextTapElement(element.data());
        setMenuPos({ x, y });
        setMenuVisible(true);
    };

    const handleEditLabel = () => {
        setMenuVisible(false);
        // Open modal for editing node label
        setPopupOpen(true);
    };

    const [popupOpen, setPopupOpen] = useState(false);

    const handleConfirm = (newEle) => {
        if (newEle.type === "node") {
            log(`Node name changed from "${contextTapElement.label}" to "${newEle.label}"`);
            dispatch(editNode({
                node: newEle
            }));
        } else if (newEle.type === "edge") {
            log(`Edge label changed from "${contextTapElement.label}" to "${newEle.label}"`);
            dispatch(editEdge(newEle));
        }
    };

    // Ctrl-Z Ctrl-Y listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                log("Undo last action");
                dispatch(undo());
                unselectAll();
            } else if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                log("Redo last action");
                dispatch(redo());
                unselectAll();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [dispatch]);

    const findDefault = () => {
        const [result, status] = findEmptyPosition(cyRef.current, viewportRef.current,
            [{
                center: getCenter(cyRef.current, viewportRef.current),
                range: getDefRange(cyRef.current, viewportRef.current, 0.75)
            }]
        );
        if (status) log("Container almost full!");
        return result;
    };
    const findWithCenter = (pos) => {
        const [result, status] = findEmptyPosition(cyRef.current, viewportRef.current,
            [{
                center: pos,
                range: { x: 300, y: 300 }
            },
            {
                center: getCenter(cyRef.current, viewportRef.current),
                range: getDefRange(cyRef.current, viewportRef.current, 0.9)
            }]
        );
        if (status) log("Container almost full!");
        return result;
    };

    // Sync elements with redux
    useEffect(() => {
        const containerSize = document.getElementById("cy-container").getBoundingClientRect();
        console.log(containerSize);
        // setCyContainerSize({ width: containerSize.width, height: containerSize.height });
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
                        "text-background-color": "#fff",
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
                },
                {
                    selector: '.highlight',
                    style: {
                        'border-color': 'red',
                        'border-width': '2px'
                    }
                },
                {
                    selector: '.special', // not visible
                    style: {
                        'width': 1,
                        'height': 1,
                        'opacity': 0
                    }
                }
            ],
            layout: {
                name: 'preset',
                fit: false
            },
            zoom: 4, //no use, set this in redux initial state
            minZoom: 1,
            maxZoom: 12,
            pan: { x: containerSize.width / 2, y: containerSize.height / 2 },
            selectionType: "additive",
            autoungrabify: false,
            autounselectify: false
        });
        console.log(cyRef.current.zoom());
        // cyRef.current.on('select unselect', 'node, edge', () => {
        //     const sel = cyRef.current.$(':selected').map(el => ({ ...el.data(), position: el.position() })); // clone here
        //     console.log(sel);
        //     setSelected(sel);
        // });
        cyRef.current.on('select', 'node, edge', (evt) => {
            const el = evt.target;
            const sel = { ...el.data(), position: el.position() };
            console.log(sel);
            setSelected((selected) => [...selected, sel]);
            if (cyRef.current.$(':selected').length === 1) {
                setJsonInput(JSON.stringify(
                    el.data(),
                    null,
                    2 // pretty print
                ));
            }
        });
        cyRef.current.on('unselect', 'node, edge', (evt) => {
            const el = evt.target;
            const sel = { ...el.data(), position: el.position() };
            console.log(sel);
            setSelected((selected) => selected.filter(s => s.id !== sel.id));
        });
        cyRef.current.on('dragfree', 'node', (evt) => {
            const node = evt.target;
            dispatch(updateNodePosition({
                id: node.id(),
                position: node.position()
            }));
        });
        cyRef.current.on("cxttap", "node, edge", handleRightClick);

        // start of the drag edge function
        cyRef.current.on('cxtdrag', 'node', (e) => {
            if (e.target?.id() === "special-node") return;
            if (cxtDragFromRef.current === null) {
                setCxtDragFrom(e.target.id());
                // create a new edge to the special node
                if (cyRef.current.$id("special-node").length > 0 && cyRef.current.$id("temp-edge").length === 0) {
                    // move it to mouse position
                    cyRef.current.$id("special-node").position({ x: e.position.x, y: e.position.y });
                    cyRef.current.add({
                        data: {
                            id: 'temp-edge',
                            source: e.target.id(),
                            target: "special-node",
                            label: 'Drag Edge'
                        },
                    });
                    setCxtDragEdge('temp-edge');
                }
                e.target.addClass('highlight');
                console.log('drag', e.target.id());
            }
        });

        cyRef.current.on('cxtdragover', 'node', (e) => {
            if (e.target?.id() === "special-node") return;
            if (cxtDragFromRef.current !== null) {
                setCxtDragTo(e.target.id());
                if (cxtDragEdgeRef.current && cyRef.current.$id(cxtDragEdgeRef.current).length > 0) {
                    cyRef.current.$id(cxtDragEdgeRef.current).move({ 'target': e.target.id() });
                }
                e.target.addClass('highlight');
                console.log('drag over', e.target.id());
            }
        });

        cyRef.current.on('cxtdragout', 'node', (e) => {
            if (e.target?.id() === "special-node") return;
            e.target.removeClass('highlight');
            if (cxtDragToRef.current === e.target.id()) {
                setCxtDragTo(null);
                if (cxtDragEdgeRef.current && cyRef.current.$id(cxtDragEdgeRef.current).length > 0) {
                    cyRef.current.$id(cxtDragEdgeRef.current).move({ 'target': "special-node" });
                }
            }
            console.log('drag out', e.target.id());
        });

        cyRef.current.on('cxttapend', (e) => { // target is drag source
            if (!e.target?.id || e.target.id() === "special-node") return;
            let target = e.target;
            if (cxtDragToRef.current && target.id && target.id() !== cxtDragToRef.current && target.isNode && target.isNode()) {
                console.log('add edge');
                dispatch(addEdgeThunk({
                    label: 'Drag Edge',
                    source: target.id(),
                    target: cxtDragToRef.current
                }));
            }
            if (cxtDragEdgeRef.current && cyRef.current.$id(cxtDragEdgeRef.current).length > 0) {
                cyRef.current.$id(cxtDragEdgeRef.current).remove();
            }

            cyRef.current.elements().removeClass('highlight');
            setCxtDragFrom(null);
            setCxtDragTo(null);
            console.log('drag end', e.target.id());
        });
        // end of it

        // Viewport change → update zoom/pan in Redux
        const updateView = () => {
            dispatch(updateViewport({
                zoom: cyRef.current.zoom(),
                pan: cyRef.current.pan()
            }));
        };
        let timeout;
        cyRef.current.on('zoom pan', () => {
            clearTimeout(timeout);
            timeout = setTimeout(updateView, 200);
        });
        return () => {
            cyRef.current.off('select');
            cyRef.current.off('unselect');
            cyRef.current.off('dragfree');
            cyRef.current.off('zoom pan', updateView);
            cyRef.current.off('cxttap', 'node, edge', handleRightClick);
            cyRef.current.off('cxtdrag');
            cyRef.current.off('cxtdragover');
            cyRef.current.off('cxtdragout');
            cyRef.current.off('cxtdragend');
            clearTimeout(timeout);
        };
    }, [dispatch]);

    useEffect(() => {
        // do a deep clone
        const nodes_copied = JSON.parse(JSON.stringify(nodes));
        const special_node = {
            data: { id: 'special-node', label: '', type: 'node', color: 'transparent' },
            position: { x: 0, y: 0 },
            classes: 'special'
        };
        //
        const edges_copied = JSON.parse(JSON.stringify(edges));
        const viewport_copied = JSON.parse(JSON.stringify(viewportRef.current));
        cyRef.current?.json({
            elements: { nodes: [special_node, ...nodes_copied], edges: edges_copied },
            zoom: viewport_copied.zoom,
            pan: viewport_copied.pan
        });
    }, [nodes, edges, viewportRef]);

    // if cxt drag from is not null, make special node visible at mouse position
    useEffect(() => {
        if (cxtDragFrom !== null) {
            const specialNode = cyRef.current.$id("special-node");
            if (specialNode) {
                // position it at mouse position
                cyRef.current.on('mousemove', (e) => {
                    specialNode.position({ x: e.position.x, y: e.position.y });
                });
            }
        } else {
            cyRef.current.off('mousemove');
        }
    }, [cxtDragFrom, cxtDragTo]);

    const handleAddEdit = () => {
        if (!jsonInput.trim()) return;
        try {
            const obj = JSON.parse(jsonInput);
            if (selected.length === 0 && obj.type === 'node') {
                // dispatch(editNode({
                //     node: obj,
                //     position: {
                //         x: (cyContainerSize.width / 2 - viewportRef.current.pan.x) / viewportRef.current.zoom,
                //         y: (cyContainerSize.height / 2 - viewportRef.current.pan.y) / viewportRef.current.zoom
                //     }
                // }));
                dispatch(addNodeThunk(obj, findDefault()));
            } else if (selected.length === 1 && selected[0].type === 'node' && obj.type === 'node') {
                // Edit existing
                const sel = { ...selected[0] }; // clone before editing
                dispatch(editNode({ node: { ...obj, id: sel.id } }));
            } else if (selected.length === 1 && selected[0].type === 'edge' && obj.type === 'edge') {
                // Edit existing
                const sel = { ...selected[0] }; // clone before editing
                dispatch(editEdge({ ...obj, id: sel.id }));
            } else if (selected.length === 2 && selected[0].type === 'node' && selected[1].type === 'node' && obj.type === 'edge') {
                const sel1 = { ...selected[0] };
                const sel2 = { ...selected[1] };
                dispatch(addNodeThunk({
                    source: sel1.id,
                    target: sel2.id,
                    ...obj
                }));
            }
            else {
                // error
            }
            unselectAll();
        } catch (err) {
            console.error('Invalid JSON', err);
        }
    };

    const handleAddEdge1 = (edgeLabel, nodeLabel) => {
        if (selected.length !== 1 || selected[0].type !== 'node') return;
        const nodeUid = dispatch(addNodeThunk({ ...defaultNode, label: nodeLabel }, findWithCenter(selected[0].position)));
        dispatch(addEdgeThunk({ label: edgeLabel, source: selected[0].id, target: nodeUid }));
        log(`Added edge "${edgeLabel}" from "${selected[0].label}" to new node "${nodeLabel}"`);
        unselectAll();
    }

    const handleAddEdge2 = (edgeLabel) => {
        if (selected.length !== 2 || selected[0].type !== 'node' || selected[1].type !== 'node') return;
        dispatch(addEdgeThunk({ label: edgeLabel, source: selected[0].id, target: selected[1].id }));
        log(`Added edge "${edgeLabel}" from "${selected[0].label}" to "${selected[1].label}"`);
        unselectAll();
    }

    const handleDelete = () => {
        selected.forEach(sel => {
            if (sel.type === 'node') {
                log(`Removed node: ${sel.label}`);
                dispatch(removeNode(sel.id));
            } else if (sel.type === 'edge') {
                log(`Removed edge: ${sel.label}`);
                dispatch(removeEdge(sel.id));
            }
        });
        unselectAll();
    };

    const handleDeleteAll = () => {
        // delete everything regardless of select
        log(`Removed all nodes and edges...`);
        nodes.forEach(node => {
            log(`Removed node: ${node.data.label}`);
            dispatch(removeNode(node.data.id));
        });
        edges.forEach(edge => {
            log(`Removed edge: ${edge.data.label}`);
            dispatch(removeEdge(edge.data.id));
        });
    };

    const handleSubmit = () => {
        const queryNodes = nodes.reduce((acc, node) => {
            acc[node.data.id] = { label: node.data.label, _label: node.data._label || "" };
            return acc;
        }, {});

        const queryEdges = edges.reduce((acc, edge) => {
            acc[edge.data.id] = { label: edge.data.label, from: edge.data.source, to: edge.data.target };
            return acc;
        }, {});

        dispatch(queryQueryToCypher({ nodes: queryNodes, edges: queryEdges, graphical_query: true })).then(res => {
            console.log("Cypher Query:\n" + res.payload.cypher_query);
            log("Generated Cypher Query:\n" + res.payload.cypher_query);
        });
    }

    return (
        <Box p={2}>
            <Box>
                <Stack spacing={1} direction="column">
                    <Stack spacing={1} direction="row">
                        <Stack spacing={1} direction="column" flexGrow={1}>
                            <Box sx={{ background: 'white', padding: '10px', borderRadius: '10px', border: '1px solid #7F7D7D' }}>
                                <Typography variant="body2" color="textSecondary">
                                    Instructions : Select a node type and configure the property restrictions on the right panel.
                                </Typography>
                            </Box>
                            <Box sx={{ borderRadius: '10px', border: '1px solid #7F7D7D', overflow: 'hidden' }}>
                                <Box sx={{ padding: '10px', background: '#EAEEF0', flexDirection: 'row', display: 'flex', justifyContent: 'flex-end' }}>
                                    <Stack spacing={1} direction="row">
                                        <Button variant="filled" color="error" onClick={handleDelete}>Delete</Button>
                                        <Button variant="filled" onClick={() => { log("Undo last action"); dispatch(undo()); unselectAll(); }}>Undo</Button>
                                        <Button variant="filled" onClick={() => { log("Redo last action"); dispatch(redo()); unselectAll(); }}>Redo</Button>
                                    </Stack>
                                </Box>
                                {menuVisible && (
                                    <div
                                        style={{
                                            position: "fixed",
                                            top: menuPos.y,
                                            left: menuPos.x,
                                            background: "#fff",
                                            border: "1px solid #ccc",
                                            borderRadius: "4px",
                                            zIndex: 1000,
                                            padding: "5px",
                                            boxShadow: "0px 2px 5px rgba(0,0,0,0.3)"
                                        }}
                                        onContextMenu={(e) => e.preventDefault()}
                                    >
                                        <div
                                            style={{ padding: "5px 10px", cursor: "pointer" }}
                                            onClick={handleEditLabel}
                                        >
                                            Edit Label
                                        </div>
                                        <div
                                            style={{ padding: "5px 10px", cursor: "pointer" }}
                                            onClick={() => {
                                                log(`Removed node: ${contextTapElement.id}`);
                                                dispatch(removeNode(contextTapElement.id));
                                                setMenuVisible(false);
                                            }}
                                        >
                                            {`Remove ${contextTapElement.type === 'node' ? 'Node' : 'Edge'}`}
                                        </div>
                                    </div>
                                )}
                                <Box id="cy-container" sx={{ height: '400px', padding: '10px', background: 'white' }}>
                                </Box>


                                {/* Node Label Modal */}
                                <NodeLabelPopup
                                    open={popupOpen}
                                    cyEle={contextTapElement}
                                    onClose={() => setPopupOpen(false)}
                                    onConfirm={handleConfirm}
                                />
                            </Box>
                        </Stack>
                        <Box sx={{ background: 'white', width: '300px', padding: '10px', borderRadius: '10px', border: '1px solid #7F7D7D' }}>
                            {panelMode === "editNode" &&
                                <>
                                    <Typography variant="body2" color="textSecondary">
                                        Bio Element List
                                    </Typography>
                                    <Stack spacing={1}>
                                        <Button variant="contained" onClick={() => {
                                            log("Added node: Gene");
                                            dispatch(addNodeThunk({ ...defaultNode, label: "Gene" }, findDefault()));
                                        }}>Add Gene</Button>
                                        <Button variant="contained" onClick={() => {
                                            log("Added node: Variant");
                                            dispatch(addNodeThunk({ ...defaultNode, label: "Variant" }, findDefault()));
                                        }}>Add Variant</Button>
                                    </Stack>
                                </>
                            }
                            {panelMode === "addedge1" &&
                                <>
                                    <Typography variant="body2" color="textSecondary">
                                        Quick Add Edge
                                    </Typography>
                                    <Stack spacing={1}>
                                        <Button variant="contained" onClick={() => {
                                            handleAddEdge1("Relationship 1", "Gene");
                                        }}>{"-- Relationship 1 -> Gene"}</Button>
                                        <Button variant="contained" onClick={() => {
                                            handleAddEdge1("Relationship 2", "Variant");
                                        }}>{"-- Relationship 2 -> Variant"}</Button>
                                    </Stack>
                                </>
                            }
                            {panelMode === "addedge2" &&
                                <>
                                    <Typography variant="body2" color="textSecondary">
                                        Relationship Options
                                    </Typography>
                                    <Stack spacing={1}>
                                        <Button variant="contained" onClick={() => {
                                            handleAddEdge2("Relationship 1");
                                        }}>{"-- Relationship 1 ->"}</Button>
                                        <Button variant="contained" onClick={() => {
                                            handleAddEdge2("Relationship 2");
                                        }}>{"-- Relationship 2 ->"}</Button>
                                    </Stack>
                                </>
                            }
                        </Box>
                    </Stack>
                    <Stack spacing={1} direction="row">
                        <Box sx={{ background: 'white', flexGrow: 1, height: '150px', padding: '10px', borderRadius: '10px', border: '1px solid #7F7D7D' }}>
                            <Logger logs={logger} />
                        </Box>
                        <Box sx={{ padding: '10px', width: '300px' }}>
                            <Stack spacing={1} direction="row">
                                <Button variant="outlined" onClick={handleDeleteAll}>Clear All</Button>
                                <Button variant="outlined" onClick={handleSubmit}>Submit</Button>
                            </Stack>
                        </Box>
                    </Stack>
                </Stack>
            </Box>
            {/* <Box
                sx={{
                    border: '1px solid #ccc',
                    height: '400px',
                    mb: 2
                }}
                id="cy-container"
            >
            </Box> */}
            <Accordion sx={{ mt: 2 }}>
                <AccordionSummary>
                    <Typography variant="body2" color="textSecondary">
                        Debug Options
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Stack spacing={2} direction="row">
                        <Stack spacing={1} flexGrow={1}>
                            <TextField
                                label="JSON Input"
                                multiline
                                minRows={6}
                                maxRows={6}
                                fullWidth
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                            />
                            <Stack spacing={2} direction="row">
                                <Button variant="outlined" onClick={() => setJsonInput(
                                    JSON.stringify(
                                        defaultNode,
                                        null,
                                        2 // pretty print
                                    )
                                )}>Default Node</Button>
                                <Button variant="outlined" onClick={() => setJsonInput(
                                    JSON.stringify(
                                        defualtEdge,
                                        null,
                                        2 // pretty print
                                    )
                                )}>Default Edge</Button>
                            </Stack>
                        </Stack>
                        <Stack spacing={1}>
                            <Button variant="contained" onClick={handleAddEdit}>Add/Edit</Button>
                            <Button variant="contained" onClick={() => {
                                handleDeleteAll();
                                const id1 = dispatch(addNodeThunk({ ...defaultNode, label: "gene" }, findDefault()));
                                const id2 = dispatch(addNodeThunk({ ...defaultNode, label: "cell_line_or_tissue", _label: "transverse colon" }, findDefault()));
                                dispatch(addEdgeThunk({ label: "express_in", source: id1, target: id2 }));
                                log("Added sample graph with 2 nodes and 1 edge");
                            }}>Add Sample Graph</Button>
                        </Stack>
                    </Stack>
                </AccordionDetails>
            </Accordion>
        </Box>
    );
}
