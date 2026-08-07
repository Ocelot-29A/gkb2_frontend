import './index.css';

import React from 'react';

import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { Box, Container, Typography } from '@mui/material';

import DebugPage from './components/Debug';
import IntermediatePage from './components/IntermediatePage';
import LandingPage from './components/LandingPage';
import MatchPage from './components/MatchPage';
import PkbFooter from './Footer/footer';
import NavBar from './NavBar';
import ApiPage from './pages/ApiPage';
import DocPage from './pages/DocPage';
import QueryPage from './pages/GraphQuery';
import GraphQueryResultPage from './pages/GraphQueryResultPage';
import Ontology from './pages/Ontology';
import Pipeline from './pages/Pipeline';
import QTLDataSource from './pages/QTL_data_source';
import SampleGraphPage from './pages/SampleGraphPage';
import { T1D_GPS_V5_VIEW_PATHS } from './pages/t1dGpsV5Routes';
import { T1D_GPS_V6_VIEW_PATHS } from './pages/t1dGpsV6Routes';
import StatPage from './pages/StatPage';
import Tutorial from './pages/Tutorial';
import UsecasesPage from './pages/UsecasePage';
import { store } from './redux/store';
import ResultPage from './SearchResult';

function SiteHeader() {
  const { pathname } = useLocation();
  const isT1DGps = pathname.startsWith('/layeredgraph') || pathname.startsWith('/T1D_GPS');

  if (isT1DGps || ['/samplegraph', '/samplegraph/', '/cellgraph', '/cellgraph/', '/mechanismgraph', '/mechanismgraph/'].includes(pathname)) {
    return (
      <Box
        component="header"
        sx={{
          minHeight: '99px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          background: isT1DGps ? 'linear-gradient(180deg, #F7F0E5 0%, #F4EDE2 100%)' : 'transparent',
        }}
      >
        <Typography
          component="h1"
          sx={{
            color: isT1DGps ? '#365D57' : '#1C3D5E',
            fontFamily: 'Inter, sans-serif',
            fontSize: { xs: '24px', sm: '32px' },
            fontWeight: 700,
            lineHeight: 1.2,
            m: 0,
          }}
        >
          T1D immune GPS
        </Typography>
      </Box>
    );
  }

  return <NavBar />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <Container disableGutters maxWidth={false} sx={{
      padding: 0, margin: 0, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      background: "linear-gradient(270deg, #F5F9FE 0%, #E7F1FE 100%)"
    }}>
      <BrowserRouter>
        <SiteHeader />
        <Routes>
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/qtldatasource" element={<QTLDataSource />} />
          <Route path="/intermediate" element={<IntermediatePage />} />
          <Route path="/ontology" element={<Ontology />} />
          <Route path="/statistics" element={<StatPage />} />
          <Route path="/api" element={<ApiPage />} />
          <Route path="/tutorial" element={<Tutorial />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/usecases" element={<UsecasesPage />} />
          <Route path="/docs/*" element={<DocPage />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/samplegraph" element={<SampleGraphPage />} />
          <Route path="/cellgraph" element={<SampleGraphPage fixtureName="cellgraph" />} />
          <Route path="/mechanismgraph" element={<SampleGraphPage fixtureName="mechanismgraph" />} />
          <Route path="/layeredgraph" element={<SampleGraphPage fixtureName="layeredgraph/overview" />} />
          <Route path="/layeredgraph/thymus" element={<SampleGraphPage fixtureName="layeredgraph/thymus" />} />
          <Route path="/layeredgraph/islet" element={<SampleGraphPage fixtureName="layeredgraph/islet" />} />
          <Route path="/T1D_GPS" element={<SampleGraphPage fixtureName="layeredgraph/overview" />} />
          <Route path="/T1D_GPS/thymus" element={<SampleGraphPage fixtureName="layeredgraph/thymus" />} />
          <Route path="/T1D_GPS/islet" element={<SampleGraphPage fixtureName="layeredgraph/islet" />} />
          <Route path="/T1D_GPS/v4" element={<SampleGraphPage fixtureName="t1d-gps-v4/overview" />} />
          <Route path="/T1D_GPS/v4/overview" element={<SampleGraphPage fixtureName="t1d-gps-v4/overview" />} />
          <Route path="/T1D_GPS/v4/pathways/central-tolerance" element={<SampleGraphPage fixtureName="t1d-gps-v4/pathways/central-tolerance" />} />
          <Route path="/T1D_GPS/v4/pathways/beta-cell-stress-and-neoantigen-generation" element={<SampleGraphPage fixtureName="t1d-gps-v4/pathways/beta-cell-stress-and-neoantigen-generation" />} />
          <Route path="/T1D_GPS/v4/pathways/antigen-drainage-and-priming" element={<SampleGraphPage fixtureName="t1d-gps-v4/pathways/antigen-drainage-and-priming" />} />
          <Route path="/T1D_GPS/v4/pathways/b-cell-help-and-autoantibody-production" element={<SampleGraphPage fixtureName="t1d-gps-v4/pathways/b-cell-help-and-autoantibody-production" />} />
          <Route path="/T1D_GPS/v4/pathways/effector-homing-and-insulitis" element={<SampleGraphPage fixtureName="t1d-gps-v4/pathways/effector-homing-and-insulitis" />} />
          <Route path="/T1D_GPS/v4/pathways/beta-cell-destruction" element={<SampleGraphPage fixtureName="t1d-gps-v4/pathways/beta-cell-destruction" />} />
          <Route path="/T1D_GPS/v4/pathways/amplification" element={<SampleGraphPage fixtureName="t1d-gps-v4/pathways/amplification" />} />
          <Route path="/T1D_GPS/v4/details/thymus-self-antigen" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/thymus-self-antigen" />} />
          <Route path="/T1D_GPS/v4/details/thymus-selection" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/thymus-selection" />} />
          <Route path="/T1D_GPS/v4/details/islet-innate-stress" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/islet-innate-stress" />} />
          <Route path="/T1D_GPS/v4/details/islet-neoantigen" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/islet-neoantigen" />} />
          <Route path="/T1D_GPS/v4/details/islet-cytotoxicity" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/islet-cytotoxicity" />} />
          <Route path="/T1D_GPS/v4/details/islet-inflammatory-injury" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/islet-inflammatory-injury" />} />
          <Route path="/T1D_GPS/v4/details/pln-antigen-presentation" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/pln-antigen-presentation" />} />
          <Route path="/T1D_GPS/v4/details/pln-costimulation" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/pln-costimulation" />} />
          <Route path="/T1D_GPS/v4/details/pln-effector-regulation" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/pln-effector-regulation" />} />
          <Route path="/T1D_GPS/v4/details/pln-bcell-germinal-centre" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/pln-bcell-germinal-centre" />} />
          <Route path="/T1D_GPS/v4/details/blood-biomarkers-outcome" element={<SampleGraphPage fixtureName="t1d-gps-v4/details/blood-biomarkers-outcome" />} />
          <Route path="/T1D_GPS/v5" element={<SampleGraphPage fixtureName="t1d-gps-v5/overview" />} />
          {T1D_GPS_V5_VIEW_PATHS.map((viewPath) => (
            <Route
              key={viewPath}
              path={`/T1D_GPS/v5/${viewPath}`}
              element={<SampleGraphPage fixtureName={`t1d-gps-v5/${viewPath}`} />}
            />
          ))}
          <Route path="/T1D_GPS/v6" element={<SampleGraphPage fixtureName="t1d-gps-v6/overview" />} />
          {T1D_GPS_V6_VIEW_PATHS.map((viewPath) => (
            <Route
              key={`v6-${viewPath}`}
              path={`/T1D_GPS/v6/${viewPath}`}
              element={<SampleGraphPage fixtureName={`t1d-gps-v6/${viewPath}`} />}
            />
          ))}
          <Route path="/graphquery" element={<QueryPage />} />
          <Route path="/graphresult" element={<GraphQueryResultPage />} />
        </Routes>
        <PkbFooter />
      </BrowserRouter>
    </Container>
  </Provider>
);
