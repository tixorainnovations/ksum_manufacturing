import React from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useMachine } from '../context/MachineContext';

const Layout = ({ children }) => {
  const { machineId } = useParams();
  const { selectedMachine, clearSelectedMachine } = useMachine();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSelectedMachine();
    navigate('/');
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ width: 32, height: 32, background: 'var(--primary)', borderRadius: 8 }}></div>
          <span>Mini-MES</span>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to={`/dashboard/${machineId}`} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span>🏠</span> Dashboard
          </NavLink>
          <NavLink to={`/dashboard/${machineId}/components`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span>🔧</span> Components
          </NavLink>
          <NavLink to={`/dashboard/${machineId}/inventory`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span>📦</span> Inventory
          </NavLink>
          <NavLink to={`/dashboard/${machineId}/process`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span>🔄</span> Process Flow
          </NavLink>
          <NavLink to={`/dashboard/${machineId}/quality`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span>✅</span> Quality Checks
          </NavLink>
          <NavLink to={`/dashboard/${machineId}/roles`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span>👷</span> Production Roles
          </NavLink>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span>🚪</span> Exit Machine
          </button>
        </div>
      </aside>

      <div style={{ flex: 1 }}>
        <header className="header">
          <div className="header-title">
            {selectedMachine?.name || 'Machine Dashboard'}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-light">Admin Mode</div>
            <div style={{ width: 32, height: 32, background: '#e2e8f0', borderRadius: '50%' }}></div>
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
