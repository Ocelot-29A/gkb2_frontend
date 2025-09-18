import axios from 'axios';

import {
    createAsyncThunk,
    createSlice,
} from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';
import { flaskBackendAxiosInstanceGKB2 } from '../axios/axios';

export const queryRephrase = createAsyncThunk("/aiRephrase",
    async (payload) => {
        return await flaskBackendAxiosInstanceGKB2
            .post("/aiRephrase", payload)
            .then((response) => response.data)
            .catch((response) => {
                console.log(response);
            });
        // write a mocked response

        // return {
        //     "cypher_query":
        //         "MATCH (g:Gene)-[r:regulate]->(target:Gene) WHERE target.name = 'SOX2' RETURN g, r, target",
        //     "in_scope": true,
        //     "original_question": "what genes regulates sox2",
        //     "rephrase": "Which @@{Gene}{genes} regulate the @@{Gene}{SOX2} gene?"
        // };

    });

export const rephraseSlice = createSlice({
    name: "ai_rephrase",
    initialState: {
        rephrase: {},
        queryRephraseStatus: QueryStatus.uninitialized, // This is auto updated
        queryRephraseErrorMessage: ''
    },
    extraReducers: (builder) => {
        builder
            .addCase(queryRephrase.pending, (state) => {
                state.queryRephraseStatus = QueryStatus.pending;
            })
            .addCase(queryRephrase.fulfilled, (state, action) => {
                state.rephrase = action.payload;
                state.queryRephraseStatus = QueryStatus.fulfilled;
            })
            .addCase(queryRephrase.rejected, (state, action) => {
                state.queryRephraseErrorMessage = action.error.message;
                state.queryRephraseStatus = QueryStatus.rejected;
            });
    }
})

export default rephraseSlice.reducer;
