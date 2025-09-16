import {
    createAsyncThunk,
    createSlice,
} from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';

import { flaskBackendAxiosInstanceGKB2 } from '../axios/axios';

export const queryOnPrem = createAsyncThunk("/onprem",
    async (payload) => {
        return await flaskBackendAxiosInstanceGKB2
            .post("/onprem", payload)
            .then((response) => response.data)
            .then((data) => {
                console.log(data);
                return data;
            })
            .catch((response) => {
                console.log(response);
            });
    });

export const onPremSlice = createSlice({
    name: "onprem",
    initialState: {
        onPrem: {},
        queryOnPremStatus: QueryStatus.uninitialized, // This is auto updated
        queryOnPremErrorMessage: ''
    },
    extraReducers: (builder) => {
        builder
            .addCase(queryOnPrem.pending, (state) => {
                state.queryOnPremStatus = QueryStatus.pending;
            })
            .addCase(queryOnPrem.fulfilled, (state, action) => {
                state.onPrem = action.payload;
                state.queryOnPremStatus = QueryStatus.fulfilled;
            })
            .addCase(queryOnPrem.rejected, (state, action) => {
                state.queryOnPremErrorMessage = action.error.message;
                state.queryOnPremStatus = QueryStatus.rejected;
            });
    }
})

export default onPremSlice.reducer;
