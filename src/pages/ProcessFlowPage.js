import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { processFlowService } from '../services/processFlowService';

const ProcessFlowPage = () => {
  const { machineId } = useParams();
  
  const [inventoryItems, setInventoryItems] = useState([]);
  const [subAssemblies, setSubAssemblies] = useState([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showQcModal, setShowQcModal] = useState(null);
  const [qcForm, setQcForm] = useState({ name: '', description: '' });
  const [form, setForm] = useState({
    name: '',
    order: '',
    estimatedTime: '',
    qcRequired: false,
    inputs: [], 
    steps: ['']
  });

  const [search, setSearch] = useState({
    production_stock: '',
    fabrication_store: '',
    fastener_bay: '',
    sub_assembly: ''
  });

  useEffect(() => {
    if (!machineId) return;
    const unsubs = [
      onSnapshot(query(collection(db, "inventory")), (snap) => setInventoryItems(snap.docs.map(d => ({ ...d.data(), id: d.id })))),
      onSnapshot(query(collection(db, "subAssemblies"), where("machineId", "==", machineId)), (snap) => setSubAssemblies(snap.docs.map(d => ({ ...d.data(), id: d.id }))))
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, [machineId]);

  const toggleSelection = (id) => {
    setForm(prev => {
      const list = prev.inputs;
      if (list.includes(id)) return { ...prev, inputs: list.filter(item => item !== id) };
      return { ...prev, inputs: [...list, id] };
    });
  };

  const handleStepChange = (index, val) => {
    setForm(prev => {
      const ns = [...prev.steps];
      ns[index] = val;
      return { ...prev, steps: ns };
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.order) return alert("Please fill process name and sequence number.");
    
    try {
      const baseData = {
        machineId,
        name: form.name,
        order: Number(form.order),
        estimatedTime: form.estimatedTime,
        qcRequired: form.qcRequired,
        steps: form.steps.filter(s => s.trim() !== '').map((s,i) => ({ stepNo: i+1, instruction: s }))
      };

      if (editingId) {
        await processFlowService.updateSubAssembly(editingId, { ...baseData, inputParts: { components: form.inputs, preparedParts: [] } });
      } else {
        await processFlowService.createSubAssembly({ ...baseData, inputParts: { components: form.inputs, preparedParts: [] } });
      }

      setShowModal(false);
      setEditingId(null);
      setForm({ name: '', order: '', estimatedTime: '', qcRequired: false, inputs: [], steps: [''] });
    } catch (err) {
      console.error(err);
      alert("Error saving assembly");
    }
  };

  const handleEdit = (node) => {
    setEditingId(node.id);
    setForm({
      name: node.name,
      order: node.order,
      estimatedTime: node.estimatedTime || '',
      qcRequired: node.qcRequired || false,
      inputs: node.inputParts?.components || [],
      steps: node.steps?.map(s => s.instruction) || ['']
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this assembly node?')) {
      await processFlowService.deleteSubAssembly(id);
    }
  };

  const handleView = (node) => {
    // In a real app this might open a beautiful read-only modal.
    alert(`View Details:\n\nProcess Name: ${node.name}\nSequence: ${node.order}\nTime: ${node.estimatedTime} mins\nQC Required: ${node.qcRequired ? 'Yes' : 'No'}\nSteps: ${node.steps?.length || 0}\nComponents: ${node.inputParts?.components?.length || 0}`);
  };

  const handleAddQc = async (e) => {
    e.preventDefault();
    if (!qcForm.name) return;
    const node = subAssemblies.find(n => n.id === showQcModal);
    if (!node) return;
    
    const newQcSteps = [...(node.qcSteps || []), { id: Date.now().toString(), name: qcForm.name, description: qcForm.description }];
    await processFlowService.updateSubAssembly(node.id, { qcSteps: newQcSteps });
    setQcForm({ name: '', description: '' });
  };

  const handleDeleteQc = async (nodeId, qcId) => {
    const node = subAssemblies.find(n => n.id === nodeId);
    if (!node) return;
    const newQcSteps = (node.qcSteps || []).filter(q => q.id !== qcId);
    await processFlowService.updateSubAssembly(nodeId, { qcSteps: newQcSteps });
  };

  const S = {
    page: { padding: '40px', height: '100vh', boxSizing: 'border-box', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexShrink: 0 },
    title: { fontSize: '28px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.02em' },
    subtitle: { fontSize: '15px', color: '#64748b', margin: 0, fontWeight: 500 },
    btnPrimary: { padding: '16px 28px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', borderRadius: '16px', fontWeight: 800, fontSize: '14px', letterSpacing: '0.05em', border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' },
    btnSecondary: { padding: '16px 28px', backgroundColor: '#ffffff', color: '#4f46e5', border: '2px solid #e0e7ff', borderRadius: '16px', fontWeight: 800, fontSize: '14px', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s' },
    workspace: { flex: 1, backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '40px', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' },
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    modal: { width: '100%', maxWidth: '1200px', height: '90vh', backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    modalBody: { display: 'flex', flex: 1, overflow: 'hidden' },
    leftPane: { width: '40%', padding: '32px', overflowY: 'auto', borderRight: '1px solid #e2e8f0', boxSizing: 'border-box' },
    rightPane: { width: '60%', padding: '32px', display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#f8fafc', boxSizing: 'border-box' },
    label: { display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' },
    input: { width: '100%', padding: '14px 16px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#0f172a', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
    gridBox: { backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '220px' },
    gridHeader: { padding: '12px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    gridTitle: { fontSize: '13px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' },
    searchBar: { padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', width: '100px', backgroundColor: '#ffffff' },
    gridList: { flex: 1, overflowY: 'auto', padding: '8px' },
    listItem: (sel) => ({ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '8px', backgroundColor: sel ? '#eef2ff' : 'transparent', color: sel ? '#4338ca' : '#475569', fontWeight: sel ? 700 : 500, fontSize: '13px', transition: 'background 0.15s' })
  };

  const renderStorageBox = (key, title) => {
    const rawItems = inventoryItems.filter(i => i.inventory_category === key);
    const filterQuery = search[key].toLowerCase();
    const items = rawItems.filter(i => (i.name || '').toLowerCase().includes(filterQuery) || (i.inventory_code || '').toLowerCase().includes(filterQuery));

    return (
      <div style={S.gridBox}>
        <div style={S.gridHeader}>
          <span style={S.gridTitle}>{title}</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', opacity: 0.5 }}>🔍</span>
            <input 
              placeholder="Search..." 
              style={S.searchBar} 
              value={search[key]} 
              onChange={e => setSearch({...search, [key]: e.target.value})} 
            />
          </div>
        </div>
        <div style={S.gridList} className="modern-scroll">
          {items.length === 0 && <div style={{ padding: '12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>No items found</div>}
          {items.map((item, idx) => {
            const sel = form.inputs.includes(item.id);
            return (
              <div key={item.id} style={S.listItem(sel)} onClick={() => toggleSelection(item.id)}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: sel ? '#6366f1' : '#cbd5e1', width: '16px' }}>{idx + 1}.</span>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                {sel && <span style={{ fontSize: '10px', fontWeight: 900, color: '#4338ca' }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={S.page}>
      
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Process Flow Builder</h1>
          <p style={S.subtitle}>Configure production stages and select required storage components.</p>
        </div>
        <button style={S.btnPrimary} onClick={() => {
          setEditingId(null);
          setForm({ name: '', order: '', estimatedTime: '', qcRequired: false, inputs: [], steps: [''] });
          setShowModal(true);
        }}>
          <span style={{ fontSize: '22px', lineHeight: 1 }}>+</span> 
          CREATE ASSEMBLY
        </button>
      </div>

      <div style={S.workspace} className="modern-scroll">
        {subAssemblies.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.8 }}>
            <span style={{ fontSize: '72px', opacity: 0.4, marginBottom: '16px' }}>🏭</span>
            <h4 style={{ fontSize: '20px', fontWeight: 800, color: '#475569', margin: '0 0 8px 0' }}>Assembly Workspace</h4>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Click "Create Assembly" to open the configuration panel.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}>Saved Assembly Processes</h2>
            {[...subAssemblies].sort((a,b) => a.order - b.order).map(node => (
              <div key={node.id} style={{ display: 'flex', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', overflow: 'hidden' }}>
                <div style={{ padding: '24px', backgroundColor: '#eef2ff', borderRight: '1px solid #e2e8f0', width: '250px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                  {node.qcRequired && (
                    <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.05em', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '12px' }}>✓</span> QC REQ
                      </div>
                      <button onClick={() => setShowQcModal(node.id)} style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, backgroundColor: '#ffffff', border: '1px solid #166534', color: '#166534', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(22, 101, 52, 0.1)' }}>
                        ⚙ SETUP QC
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Sequence {node.order}</div>
                  <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', paddingRight: node.qcRequired ? '60px' : '0' }}>{node.name}</h3>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>⏱ {node.estimatedTime || 0} mins</div>
                </div>
                <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
                  
                  {/* Action Icons */}
                  <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleView(node)} title="View Details" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '14px' }}>👁</span>
                    </button>
                    <button onClick={() => handleEdit(node)} title="Edit Node" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '14px' }}>✎</span>
                    </button>
                    <button onClick={() => handleDelete(node.id)} title="Delete Node" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #fee2e2', backgroundColor: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '14px' }}>🗑</span>
                    </button>
                  </div>

                  <div style={{ paddingRight: '120px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Required Components</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {node.inputParts?.components?.length > 0 ? node.inputParts.components.map(compId => {
                        const item = inventoryItems.find(i => i.id === compId);
                        return (
                          <div key={compId} style={{ padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                            {item ? item.name : 'Unknown Component'}
                          </div>
                        )
                      }) : <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>None selected</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Process Steps</div>
                    <ol style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '14px', fontWeight: 500, lineHeight: 1.6 }}>
                      {node.steps?.map((s, i) => (
                        <li key={i} style={{ marginBottom: '6px' }}>{s.instruction}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            
            <div style={S.modalBody}>
              
              {/* LEFT PANE: New Assembly */}
              <div style={S.leftPane} className="modern-scroll">
                <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginBottom: '32px', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px' }}>{editingId ? 'Edit Assembly' : 'New Assembly'}</h2>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ flex: 2 }}>
                    <label style={S.label}>Process Name</label>
                    <input style={S.input} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Base Frame Setup" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Sq no:</label>
                    <input type="number" style={S.input} value={form.order} onChange={e => setForm({...form, order: e.target.value})} placeholder="1" />
                  </div>
                </div>

                <div style={{ marginBottom: '32px', display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div style={{ width: '50%' }}>
                    <label style={S.label}>Time (mins)</label>
                    <input type="number" style={S.input} value={form.estimatedTime} onChange={e => setForm({...form, estimatedTime: e.target.value})} placeholder="e.g. 30" />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={S.label}>Quality Check</label>
                    <div 
                      onClick={() => setForm({...form, qcRequired: !form.qcRequired})}
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', backgroundColor: form.qcRequired ? '#f0fdf4' : '#ffffff', 
                        border: `1px solid ${form.qcRequired ? '#86efac' : '#cbd5e1'}`, borderRadius: '12px', 
                        cursor: 'pointer', transition: 'all 0.2s', height: '46px', boxSizing: 'border-box'
                      }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: form.qcRequired ? '#166534' : '#64748b', userSelect: 'none' }}>
                          {form.qcRequired ? 'QC Required' : 'Skip QC'}
                        </span>
                        <div style={{ width: '36px', height: '20px', backgroundColor: form.qcRequired ? '#22c55e' : '#e2e8f0', borderRadius: '10px', position: 'relative', transition: 'all 0.2s' }}>
                          <div style={{ width: '16px', height: '16px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: form.qcRequired ? '18px' : '2px', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
                        </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <label style={{ ...S.label, margin: 0 }}>Assembly Steps</label>
                    <button onClick={() => setForm(p => ({...p, steps: [...p.steps, '']}))} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 800, backgroundColor: '#e2e8f0', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>+ Add</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {form.steps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#64748b', width: '20px', marginTop: '14px' }}>{i + 1}.</div>
                        <input style={{ ...S.input, flex: 1 }} value={step} onChange={e => handleStepChange(i, e.target.value)} placeholder="Describe operation..." />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT PANE: Storage / Inventory */}
              <div style={S.rightPane} className="modern-scroll">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', flexShrink: 0 }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Storage / Inventory</h2>
                  <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: '#e2e8f0', color: '#64748b', fontWeight: 900, cursor: 'pointer' }}>✕</button>
                </div>
                
                {/* 2x2 Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
                  {renderStorageBox('production_stock', 'Production Stock')}
                  {renderStorageBox('fabrication_store', 'Fabrication Store')}
                  {renderStorageBox('fastener_bay', 'Fasteners Bay')}
                  {renderStorageBox('sub_assembly', 'Sub Assembly')}
                </div>

                {/* Selected Components List */}
                <div style={{ minHeight: '120px', backgroundColor: '#ffffff', borderRadius: '16px', border: '2px dashed #cbd5e1', padding: '20px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>List of selected components</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {form.inputs.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>No components selected yet. Click items in the storages above to add them.</div>
                    ) : (
                      form.inputs.map(id => {
                        const item = inventoryItems.find(i => i.id === id);
                        if (!item) return null;
                        return (
                          <div key={id} style={{ padding: '6px 12px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#4338ca', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {item.name}
                            <button type="button" onClick={() => toggleSelection(id)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, fontSize: '14px', fontWeight: 900, marginLeft: '4px' }}>×</button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '32px', flexShrink: 0, paddingBottom: '16px' }}>
                  <button onClick={() => setShowModal(false)} style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 800, color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: '16px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>Cancel</button>
                  <button onClick={handleSave} style={{ ...S.btnPrimary }}>Submit, Save & Preview</button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* QC Configuration Modal */}
      {showQcModal && (
        <div style={{...S.overlay, zIndex: 10000}}>
          <div style={{...S.modal, maxWidth: '600px', height: 'auto', maxHeight: '80vh'}}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#166534', margin: '0 0 4px 0' }}>Configure Quality Checks</h2>
                <p style={{ fontSize: '13px', color: '#15803d', margin: 0 }}>Define the mandatory QC validations for this process.</p>
              </div>
              <button onClick={() => { setShowQcModal(null); setQcForm({name:'', description:''}); }} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: '#dcfce7', color: '#166534', fontWeight: 900, cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              {/* Existing QCs */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Defined QC Parameters</h3>
                {(() => {
                  const activeNode = subAssemblies.find(n => n.id === showQcModal);
                  if (!activeNode || !activeNode.qcSteps || activeNode.qcSteps.length === 0) {
                    return <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>No QC parameters defined yet.</div>;
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activeNode.qcSteps.map((qc, i) => (
                        <div key={qc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff' }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{i+1}. {qc.name}</div>
                            {qc.description && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{qc.description}</div>}
                          </div>
                          <button onClick={() => handleDeleteQc(showQcModal, qc.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', fontSize: '16px' }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Add New QC Form */}
              <form onSubmit={handleAddQc} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>Add New Parameter</h3>
                <div style={{ marginBottom: '16px' }}>
                  <label style={S.label}>Parameter Name</label>
                  <input required style={S.input} value={qcForm.name} onChange={e => setQcForm({...qcForm, name: e.target.value})} placeholder="e.g. Check Alignment Tolerance" />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={S.label}>Description (Optional)</label>
                  <textarea rows="2" style={{...S.input, resize: 'vertical'}} value={qcForm.description} onChange={e => setQcForm({...qcForm, description: e.target.value})} placeholder="What exactly needs to be validated..." />
                </div>
                <button type="submit" style={{ ...S.btnPrimary, width: '100%', justifyContent: 'center', backgroundColor: '#166534', background: '#166534', boxShadow: 'none' }}>+ Add QC Parameter</button>
              </form>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default ProcessFlowPage;
