import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MachineProvider } from './context/MachineContext';
import MachineSelection from './pages/MachineSelection';
import MachineDashboard from './pages/MachineDashboard';
import ComponentsPage from './pages/ComponentsPage';
import ProcessFlowPage from './pages/ProcessFlowPage';
import QualityCheckPage from './pages/QualityCheckPage';
import InventoryPage from './pages/InventoryPage';
import ProductionRolesPage from './pages/ProductionRolesPage';
import Layout from './components/Layout';

function App() {
  return (
    <MachineProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<MachineSelection />} />
          
          <Route path="/dashboard/:machineId" element={<Layout><MachineDashboard /></Layout>} />
          <Route path="/dashboard/:machineId/components" element={<Layout><ComponentsPage /></Layout>} />
          <Route path="/dashboard/:machineId/inventory" element={<Layout><InventoryPage /></Layout>} />
          <Route path="/dashboard/:machineId/process" element={<Layout><ProcessFlowPage /></Layout>} />
          <Route path="/dashboard/:machineId/quality" element={<Layout><QualityCheckPage /></Layout>} />
          <Route path="/dashboard/:machineId/roles" element={<Layout><ProductionRolesPage /></Layout>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </MachineProvider>
  );
}

export default App;
