import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { machineService } from '../services/machineService';
import { useMachine } from '../context/MachineContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { mediaService } from '../services/mediaService';

const MachineSelection = () => {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineDescription, setNewMachineDescription] = useState('');
  const [newMachineFile, setNewMachineFile] = useState(null);
  const [editingMachine, setEditingMachine] = useState(null);
  const [editMachineName, setEditMachineName] = useState('');
  const [editMachineDescription, setEditMachineDescription] = useState('');
  const [editMachineImageUrl, setEditMachineImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
      setIsUploading(true);
      let imageUrl = '';

      // We need a temporary ID for storage path if we want to upload before doc creation
      // Or we can let machineService.create generate the ID first.
      // Since machineService.create uses the name to generate the ID, we can predict it.
      const predictedId = newMachineName.trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      if (newMachineFile) {
        const mediaObj = await mediaService.uploadFile(
          newMachineFile, 
          'machines', 
          predictedId, 
          'profile',
          (progress) => setUploadProgress(progress)
        );
        imageUrl = mediaObj.url;
      }

      await machineService.create(newMachineName.trim(), newMachineDescription.trim(), imageUrl);
      
      setNewMachineName('');
      setNewMachineDescription('');
      setNewMachineFile(null);
      setShowAddModal(false);
    } catch (error) {
      console.error("❌ Create error:", error);
      alert("Failed to create machine: " + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpdateMachine = async (e) => {
    e.preventDefault();
    if (!editMachineName.trim() || !editingMachine) return;

    try {
      setIsUploading(true);
      let imageUrl = editMachineImageUrl;

      if (selectedFile) {
        const mediaObj = await mediaService.uploadFile(
          selectedFile, 
          'machines', 
          editingMachine.id, 
          'profile',
          (progress) => setUploadProgress(progress)
        );
        imageUrl = mediaObj.url;
      }

      await machineService.update(editingMachine.id, {
        name: editMachineName.trim(),
        description: editMachineDescription.trim(),
        imageUrl: imageUrl
      });

      setShowEditModal(false);
      setEditingMachine(null);
      setSelectedFile(null);
      setEditMachineImageUrl('');
      setEditMachineDescription('');
    } catch (error) {
      console.error("❌ Update error:", error);
      alert("Failed to update machine");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
    setEditMachineDescription(machine.description || '');
    setEditMachineImageUrl(machine.imageUrl || '');
    setShowEditModal(true);
  };

  const onSelect = (machine) => {
    selectMachine(machine.id, machine);
    navigate(`/dashboard/${machine.id}`);
  };

  return (
    <div className="selection-container">
      {/* Header Section */}
      <header className="flex justify-between items-center" style={{ marginBottom: '4rem' }}>
        <div>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>
            Select <span style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Machine</span>
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
                height: 180,
                background: machine.imageUrl ? `url(${machine.imageUrl})` : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '4rem',
                border: '1px solid rgba(226, 232, 240, 0.5)',
                overflow: 'hidden'
              }}>
                {!machine.imageUrl && "⚙️"}
              </div>

              {/* Card Content */}
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                  {machine.name}
                </h3>
                {machine.description && (
                  <p className="text-sm text-light" style={{ 
                    marginBottom: '0.5rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {machine.description}
                  </p>
                )}
                <div className="text-sm text-light" style={{ fontWeight: 500, color: 'var(--primary)' }}>Click to enter dashboard</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Machine Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { if(!isUploading) setShowAddModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>Create New Machine</h2>
            <form onSubmit={handleCreateMachine}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Machine Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. CNC Router X1" 
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  autoFocus
                  disabled={isUploading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  placeholder="Describe the machine's capabilities..."
                  value={newMachineDescription}
                  onChange={(e) => setNewMachineDescription(e.target.value)}
                  style={{ resize: 'vertical' }}
                  disabled={isUploading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Machine Image</label>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1rem',
                  padding: '1rem',
                  border: '1px dashed var(--border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-light)'
                }}>
                  {newMachineFile && (
                    <img 
                      src={URL.createObjectURL(newMachineFile)} 
                      alt="Preview" 
                      style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setNewMachineFile(e.target.files[0])}
                    style={{ fontSize: '0.875rem' }}
                    disabled={isUploading}
                  />
                </div>
              </div>

              {isUploading && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="progress-bar-container" style={{ height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="progress-bar" style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }}></div>
                  </div>
                  <p style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '0.5rem' }}>Uploading... {Math.round(uploadProgress)}%</p>
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ flex: 1 }} 
                  onClick={() => setShowAddModal(false)}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={!newMachineName.trim() || isUploading}
                >
                  {isUploading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Machine Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => { if(!isUploading) { setShowEditModal(false); setEditingMachine(null); } }}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Machine</h2>
            <form onSubmit={handleUpdateMachine}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Machine Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editMachineName}
                  onChange={(e) => setEditMachineName(e.target.value)}
                  autoFocus
                  disabled={isUploading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  placeholder="Describe the machine's capabilities..."
                  value={editMachineDescription}
                  onChange={(e) => setEditMachineDescription(e.target.value)}
                  style={{ resize: 'vertical' }}
                  disabled={isUploading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Machine Image</label>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1rem',
                  padding: '1rem',
                  border: '1px dashed var(--border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-light)'
                }}>
                  {(selectedFile || editMachineImageUrl) && (
                    <img 
                      src={selectedFile ? URL.createObjectURL(selectedFile) : editMachineImageUrl} 
                      alt="Preview" 
                      style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    style={{ fontSize: '0.875rem' }}
                    disabled={isUploading}
                  />
                </div>
              </div>

              {isUploading && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="progress-bar-container" style={{ height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="progress-bar" style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }}></div>
                  </div>
                  <p style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '0.5rem' }}>Uploading... {Math.round(uploadProgress)}%</p>
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ flex: 1 }} 
                  onClick={() => { setShowEditModal(false); setEditingMachine(null); }}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={!editMachineName.trim() || isUploading}
                >
                  {isUploading ? 'Saving...' : 'Save Changes'}
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