import {
  createAsyncThunk,
  createSlice,
} from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';

import { flaskBackendAxiosInstanceGKB2 } from '../axios/axios';

export const queryCypherToGraph = createAsyncThunk("/cypherToGraph",
    async (payload) => {
        return await flaskBackendAxiosInstanceGKB2
            .post("/cypherToGraph", { cypher: payload })
            .then((response) => response.data)
            .then((data) => {
                console.log(data);
                return data;
            })
            .catch((response) => {
                console.log(response);
            });
    });

export const cypherToGraphSlice = createSlice({
    name: "cypherToGraph",
    initialState: {
        cypherToGraph: {},
        queryCypherToGraphStatus: QueryStatus.uninitialized, // This is auto updated
        queryCypherToGraphErrorMessage: ''
    },
    extraReducers: (builder) => {
        builder
            .addCase(queryCypherToGraph.pending, (state) => {
                state.queryCypherToGraphStatus = QueryStatus.pending;
            })
            .addCase(queryCypherToGraph.fulfilled, (state, action) => {
                state.cypherToGraph = action.payload;
                state.queryCypherToGraphStatus = QueryStatus.fulfilled;
            })
            .addCase(queryCypherToGraph.rejected, (state, action) => {
                state.queryCypherToGraphErrorMessage = action.error.message;
                state.queryCypherToGraphStatus = QueryStatus.rejected;
            });
    }
})

export default cypherToGraphSlice.reducer;
