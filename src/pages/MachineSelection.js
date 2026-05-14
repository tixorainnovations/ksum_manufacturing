import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { machineService } from '../services/machineService';
import { useMachine } from '../context/MachineContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const MachineSelection = () => {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');
  const [editingMachine, setEditingMachine] = useState(null);
  const [editMachineName, setEditMachineName] = useState('');

  const { selectMachine } = useMachine();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🔥 Listening to machines collection...");
    const unsubscribe = onSnapshot(
      collection(db, "machines"),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMachines(data);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Firestore error:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleCreateMachine = async (e) => {
    e.preventDefault();
    if (!newMachineName.trim()) return;

    try {
      await machineService.create(newMachineName.trim());
      setNewMachineName('');
      setShowAddModal(false);
    } catch (error) {
      console.error("❌ Create error:", error);
      alert("Failed to create machine: " + error.message);
    }
  };

  const handleUpdateMachine = async (e) => {
    e.preventDefault();
    if (!editMachineName.trim() || !editingMachine) return;

    try {
      await machineService.update(editingMachine.id, editMachineName.trim());
      setShowEditModal(false);
      setEditingMachine(null);
    } catch (error) {
      console.error("❌ Update error:", error);
      alert("Failed to update machine");
    }
  };

  const handleDeleteMachine = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this machine?")) {
      try {
        await machineService.delete(id);
      } catch (error) {
        console.error("❌ Delete error:", error);
        alert("Failed to delete machine");
      }
    }
  };

  const openEditModal = (e, machine) => {
    e.stopPropagation();
    setEditingMachine(machine);
    setEditMachineName(machine.name);
    setShowEditModal(true);
  };

  const onSelect = (machine) => {
    selectMachine(machine.id, machine);
    navigate(`/dashboard/${machine.id}`);
  };

  return (
    <div className="selection-container">
      {/* Header Section */}
      <header className="flex justify-between items-center" style={{ marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text)' }}>
            Select <span style={{ color: 'var(--primary)' }}>Machine</span>
          </h1>
          <p className="text-light" style={{ fontSize: '1.1rem' }}>
            Select a workstation to manage production and setup
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
          + New Machine
        </button>
      </header>

      {/* Main Content */}
      {loading ? (
        <div style={{ padding: '100px 0' }}>
          <div className="spinner"></div>
          <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-light)' }}>Loading machines...</p>
        </div>
      ) : machines.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '5rem 2rem', borderStyle: 'dashed' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🏗️</div>
          <h2 style={{ marginBottom: '0.5rem' }}>No machines yet</h2>
          <p className="text-light" style={{ marginBottom: '2rem' }}>Get started by creating your first manufacturing workstation.</p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            Create your first machine
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 grid-cols-3">
          {machines.map((machine) => (
            <div key={machine.id} className="card machine-card" onClick={() => onSelect(machine)}>
              {/* Card Actions (Hover only) */}
              <div className="card-actions">
                <button className="action-btn" onClick={(e) => openEditModal(e, machine)} title="Edit">
                  ✏️
                </button>
                <button className="action-btn" onClick={(e) => handleDeleteMachine(e, machine.id)} title="Delete">
                  🗑️
                </button>
              </div>

              {/* Card Visual */}
              <div style={{
                height: 160,
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '3.5rem',
                border: '1px solid #f1f5f9'
              }}>
                ⚙️
              </div>

              {/* Card Content */}
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                  {machine.name}
                </h3>
                <div className="text-sm text-light">Click to enter dashboard</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Machine Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>Create New Machine</h2>
            <form onSubmit={handleCreateMachine}>
              <div className="form-group">
                <label className="form-label">Machine Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. CNC Router X1" 
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 mt-6">
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={!newMachineName.trim()}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Machine Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditingMachine(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Machine</h2>
            <form onSubmit={handleUpdateMachine}>
              <div className="form-group">
                <label className="form-label">Machine Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editMachineName}
                  onChange={(e) => setEditMachineName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 mt-6">
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowEditModal(false); setEditingMachine(null); }}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={!editMachineName.trim()}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MachineSelection;