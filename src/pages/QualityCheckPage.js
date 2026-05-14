import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { qualityService } from '../services/qualityService';

const QualityCheckPage = () => {
  const { machineId } = useParams();
  const [globalChecks, setGlobalChecks] = useState([]);
  const [processChecks, setProcessChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    if (!machineId) return;

    const unsubGlobal = onSnapshot(query(collection(db, "quality_checks"), where("machineId", "==", machineId)), (snap) => {
      setGlobalChecks(snap.docs.map(doc => ({ id: doc.id, type: 'global', ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    const unsubProcess = onSnapshot(query(collection(db, "subAssemblies"), where("machineId", "==", machineId)), (snap) => {
      const pChecks = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.qcSteps && data.qcSteps.length > 0) {
          data.qcSteps.forEach(qc => {
            pChecks.push({ 
              id: qc.id, 
              nodeId: doc.id, 
              type: 'process', 
              sourceName: data.name, 
              name: qc.name, 
              description: qc.description 
            });
          });
        }
      });
      setProcessChecks(pChecks);
    });

    return () => { unsubGlobal(); unsubProcess(); };
  }, [machineId]);

  const allChecks = [...globalChecks, ...processChecks];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      await qualityService.create(machineId, formData);
      setFormData({ name: '', description: '' });
      setShowAddModal(false);
      // No need for manual re-fetch as onSnapshot handles it
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (check) => {
    if (window.confirm(`Are you sure you want to delete this quality check?`)) {
      try {
        if (check.type === 'global') {
          await qualityService.delete(check.id);
        } else if (check.type === 'process') {
          const nodeRef = doc(db, "subAssemblies", check.nodeId);
          const snap = await getDoc(nodeRef);
          if (snap.exists()) {
            const nodeData = snap.data();
            const updatedQcSteps = (nodeData.qcSteps || []).filter(q => q.id !== check.id);
            await updateDoc(nodeRef, { qcSteps: updatedQcSteps });
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title" style={{ fontSize: '1.5rem' }}>Quality Checks</h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Check</button>
      </div>

      <div className="card" style={{ borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading quality checks...</div>
        ) : allChecks.length > 0 ? (
          <div className="table-container" style={{ margin: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Source Category</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Check Parameter</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allChecks.map((check) => (
                  <tr key={check.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                    <td style={{ padding: '16px' }}>
                      {check.type === 'global' ? (
                        <span style={{ backgroundColor: '#eef2ff', color: '#4338ca', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>GLOBAL CATALOG</span>
                      ) : (
                        <span style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>PROCESS: {check.sourceName}</span>
                      )}
                    </td>
                    <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>{check.name}</td>
                    <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>{check.description || '-'}</td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button onClick={() => handleDelete(check)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: '4px' }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '60px 40px', textAlign: 'center' }}>
            <span style={{ fontSize: '48px', opacity: 0.3, display: 'block', marginBottom: '16px' }}>📋</span>
            <h3 style={{ margin: '0 0 8px 0', color: '#334155', fontWeight: 800 }}>No Quality Checks Found</h3>
            <p style={{ margin: 0, color: '#94a3b8' }}>Create global checks here or define them inside specific assembly processes.</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 450 }}>
            <h2 className="card-title" style={{ marginBottom: '1.5rem' }}>Add Quality Check</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Check Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="e.g. Surface Finish Inspection"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  placeholder="Describe what needs to be checked..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>
              <div className="flex justify-between gap-2 mt-4">
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Check</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityCheckPage;
