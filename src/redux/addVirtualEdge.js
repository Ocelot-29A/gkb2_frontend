import {
    createAsyncThunk,
    createSlice,
} from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';

import { flaskBackendAxiosInstanceGKB2 } from '../axios/axios';

export const queryAddVirtualEdge = createAsyncThunk("/addVirtualEdge",
    async (payload) => {
        return await flaskBackendAxiosInstanceGKB2
            .post("/addVirtualEdge", payload)
            .then((response) => response.data)
            .then((data) => {
                console.log(data);
                return data;
            })
            .catch((response) => {
                console.log(response);
            });
    });

export const addVirtualEdgeSlice = createSlice({
    name: "addVirtualEdge",
    initialState: {
        addVirtualEdge: {},
        queryAddVirtualEdgeStatus: QueryStatus.uninitialized, // This is auto updated
        queryAddVirtualEdgeErrorMessage: ''
    },
    extraReducers: (builder) => {
        builder
            .addCase(queryAddVirtualEdge.pending, (state) => {
                state.queryAddVirtualEdgeStatus = QueryStatus.pending;
            })
            .addCase(queryAddVirtualEdge.fulfilled, (state, action) => {
                state.addVirtualEdge = action.payload;
                state.queryAddVirtualEdgeStatus = QueryStatus.fulfilled;
            })
            .addCase(queryAddVirtualEdge.rejected, (state, action) => {
                state.queryAddVirtualEdgeErrorMessage = action.error.message;
                state.queryAddVirtualEdgeStatus = QueryStatus.rejected;
            });
    }
})

export default addVirtualEdgeSlice.reducer;
