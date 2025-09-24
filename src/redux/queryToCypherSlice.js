import {
  createAsyncThunk,
  createSlice,
} from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';

import { flaskBackendAxiosInstanceGKB2 } from '../axios/axios';

export const queryQueryToCypher = createAsyncThunk("/queryToCypher",
    async (payload) => {
        return await flaskBackendAxiosInstanceGKB2
            .post("/queryToCypher", payload)
            .then((response) => response.data)
            .then((data) => {
                console.log(data);
                return data;
            })
            .catch((response) => {
                console.log(response);
            });
    });

export const queryToCypherSlice = createSlice({
    name: "queryToCypher",
    initialState: {
        queryToCypher: {},
        queryQueryToCypherStatus: QueryStatus.uninitialized, // This is auto updated
        queryQueryToCypherErrorMessage: ''
    },
    extraReducers: (builder) => {
        builder
            .addCase(queryQueryToCypher.pending, (state) => {
                state.queryQueryToCypherStatus = QueryStatus.pending;
            })
            .addCase(queryQueryToCypher.fulfilled, (state, action) => {
                state.queryToCypher = action.payload;
                state.queryQueryToCypherStatus = QueryStatus.fulfilled;
            })
            .addCase(queryQueryToCypher.rejected, (state, action) => {
                state.queryQueryToCypherErrorMessage = action.error.message;
                state.queryQueryToCypherStatus = QueryStatus.rejected;
            });
    }
})

export default queryToCypherSlice.reducer;
