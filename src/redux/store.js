import { configureStore } from '@reduxjs/toolkit';

import addVirtualEdgeReducer from './addVirtualEdge';
import aiAnswerReducer from './aiAnswerSlice';
import articlesReducer from './articlesSlice';
import catalogReducer from './catalogSlice';
import cypherToGraphReducer from './cypherToGraphSlice';
import inputToVocabReducer from './inputToVocabSlice';
import onPremReducer from './onPremSlice';
import processedQuestionReducer from './processedQuestionSlice';
import queryResultPage from './queryResultPage';
import queryResultReducer from './queryResultSlice';
import queryReducer from './querySlice';
import queryVisResultReducer from './queryVisResultSlice';
import rephraseSliceReducer from './rephraseSlice';
import searchReducer from './searchSlice';
import typeToImageReducer from './typeToImageSlice';
import variablesReducer from './variablesSlice';
import viewSchemaReducer from './viewSchemaSlice';

const store = configureStore({
    reducer: {
        viewSchema: viewSchemaReducer,
        catalog: catalogReducer,
        queryResult: queryResultReducer,
        aiAnswer: aiAnswerReducer,
        query: queryReducer,
        articles: articlesReducer,
        processedQuestion: processedQuestionReducer,
        typeToImage: typeToImageReducer,
        inputToVocab: inputToVocabReducer,
        search: searchReducer,
        variables: variablesReducer,
        queryVisResult: queryVisResultReducer,
        queryResultPage: queryResultPage,
        rephrase: rephraseSliceReducer,
        cypherToGraph: cypherToGraphReducer,
        addVirtualEdge: addVirtualEdgeReducer,
        onPrem: onPremReducer,
    },
});

export { store };
