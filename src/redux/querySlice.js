import {
    createSlice,
    nanoid,
} from '@reduxjs/toolkit';

const initialState = {
    nodes: [],
    edges: [],
    history: [],
    future: [],
    viewport: { zoom: 1, pan: { x: 0, y: 0 } }
};

// helper: deep clone state
const cloneState = (state) => ({
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
});

const copy = (dict) => (JSON.parse(JSON.stringify(dict)));

const querySlice = createSlice({
    name: 'query',
    initialState,
    reducers: {
        // ---- History helpers ----
        saveHistory(state) {
            state.history.push(cloneState(state));
            state.future = []; // clear redo stack after new action
        },

        undo(state) {
            if (state.history.length > 0) {
                const prev = state.history.pop();
                state.future.push(cloneState(state));
                state.nodes = prev.nodes;
                state.edges = prev.edges;
            }
        },

        redo(state) {
            if (state.future.length > 0) {
                const next = state.future.pop();
                state.history.push(cloneState(state));
                state.nodes = next.nodes;
                state.edges = next.edges;
            }
        },

        // ---- Graph operations ----
        addNode(state, action) {
            querySlice.caseReducers.saveHistory(state);
            const node = { data: { id: nanoid(), type: 'node', ...copy(action.payload.node) }, position: copy(action.payload.position) };
            state.nodes.push(node);
            console.log("Added node", node);
        },

        addEdge(state, action) {
            querySlice.caseReducers.saveHistory(state);
            const { source, target, ...rest } = copy(action.payload);
            if (
                state.nodes.some(n => n.data?.id === source) &&
                state.nodes.some(n => n.data?.id === target)
            ) {
                state.edges.push({ data: { id: nanoid(), type: 'edge', source, target, ...rest } });
            }
        },

        editNode(state, action) {
            querySlice.caseReducers.saveHistory(state);
            const { id, ...updates } = copy(action.payload);
            const node = state.nodes.find(n => n.data?.id === id);
            if (node) Object.assign(node.data, updates);

        },

        editEdge(state, action) {
            querySlice.caseReducers.saveHistory(state);
            const { id, ...updates } = copy(action.payload);
            const edge = state.edges.find(e => e.data?.id === id);
            if (edge) Object.assign(edge.data, updates);
        },

        removeNode(state, action) {
            querySlice.caseReducers.saveHistory(state);
            const id = action.payload;
            state.nodes = state.nodes.filter(n => n.data?.id !== id);
            state.edges = state.edges.filter(e => e.data?.source !== id && e.data?.target !== id);
        },

        removeEdge(state, action) {
            querySlice.caseReducers.saveHistory(state);
            const id = action.payload;
            state.edges = state.edges.filter(e => e.data?.id !== id);
        },

        updateNodePosition(state, action) {
            const { id, position } = copy(action.payload);
            const node = state.nodes.find(n => n.data?.id === id);
            if (node) {
                node.position = { ...position };
            }
        },

        updateViewport(state, action) {
            const { zoom, pan } = copy(action.payload);
            state.viewport = { zoom, pan };
        },
    },
});

export const {
    addNode, addEdge, editNode, editEdge,
    removeNode, removeEdge,
    undo, redo,
    updateNodePosition, updateViewport
} = querySlice.actions;

export default querySlice.reducer;
