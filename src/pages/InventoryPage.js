import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { inventoryService } from '../services/inventoryService';

const InventoryPage = () => {
  const { machineId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'receiving';

  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState([]);
  const [tools, setTools] = useState([]);
  const [fasteners, setFasteners] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQCModal, setShowQCModal] = useState(null);
  const [showStorageModal, setShowStorageModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [showBuildModal, setShowBuildModal] = useState(null);

  // Form States
  const [incomingForm, setIncomingForm] = useState({
    componentId: '',
    type: 'procured',
    quantity: 1,
    source: '',
    details: ''
  });

  const [qcForm, setQCForm] = useState({
    inspector: '',
    remarks: '',
    checklist: []
  });

  const [storageForm, setStorageForm] = useState({
    rack: '',
    shelf: '',
    bin: ''
  });

  const [editForm, setEditForm] = useState({
    name: '',
    quantity: 1,
    source: '',
    details: ''
  });

  const [subAssemblyForm, setSubAssemblyForm] = useState({
    name: '',
    quantity: 1,
    components: [{ id: '', consumeQty: 1 }]
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [itemFilter, setItemFilter] = useState('All');
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentItems, setRecentItems] = useState([]);

  useEffect(() => {
    try {
      const recent = JSON.parse(localStorage.getItem('recentInventoryItems') || '[]');
      setRecentItems(recent);
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (!machineId) return;

    const q = query(
      collection(db, "inventory"),
      where("machineId", "==", machineId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInventoryItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const unsubComps = onSnapshot(query(collection(db, "components"), where("machineId", "==", machineId)), (snap) => {
      setComponents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTools = onSnapshot(collection(db, "tools"), (snap) => {
      setTools(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubFasteners = onSnapshot(collection(db, "fasteners"), (snap) => {
      setFasteners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubComps();
      unsubTools();
      unsubFasteners();
    };
  }, [machineId]);

  const masterList = useMemo(() => {
    return [
      ...components.map(c => ({ ...c, displayType: c.componentType === 'procured' ? 'Procured' : 'Manufactured' })),
      ...tools.map(t => ({ ...t, displayType: 'Tool' })),
      ...fasteners.map(f => ({ ...f, displayType: 'Fastener' }))
    ];
  }, [components, tools, fasteners]);

  const handleAddIncoming = async (e) => {
    e.preventDefault();
    if (!incomingForm.componentId) {
      alert("Please select a valid item from the list.");
      return;
    }
    const selected = masterList.find(c => c.id === incomingForm.componentId);
    if (!selected) return;

    try {
      await inventoryService.addIncomingBatch(machineId, {
        ...incomingForm,
        name: selected.name,
        type: selected.displayType.toLowerCase()
      });

      const newRecent = [selected.id, ...recentItems.filter(id => id !== selected.id)].slice(0, 5);
      setRecentItems(newRecent);
      localStorage.setItem('recentInventoryItems', JSON.stringify(newRecent));

      setShowAddModal(false);
      setIncomingForm({ componentId: '', type: 'procured', quantity: 1, source: '', details: '' });
      setSearchQuery('');
      setItemFilter('All');
    } catch (error) {
      console.error(error);
    }
  };

  const handleProcessQC = async (passed) => {
    try {
      await inventoryService.processQC(showQCModal.id, qcForm, passed);
      setShowQCModal(null);
      setQCForm({ inspector: '', remarks: '', checklist: [] });
    } catch (error) {
      console.error(error);
    }
  };

  const handleAssignStorage = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.assignStorage(showStorageModal.id, storageForm, showStorageModal.type);
      setShowStorageModal(null);
      setStorageForm({ rack: '', shelf: '', bin: '' });
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await inventoryService.updateInventoryItem(showEditModal.id, editForm);
      setShowEditModal(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (item) => {
    if (window.confirm(`Archive Inventory Record?\n\n${item.inventory_code || item.batchId}\n${item.name}\nQty: ${item.quantity}`)) {
      try {
        await inventoryService.deleteInventoryRecord(item.id);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleHardDelete = async (item) => {
    if (window.confirm(`PERMANENTLY DELETE Inventory Record?\nThis action cannot be undone.\n\n${item.inventory_code || item.batchId}\n${item.name}\nQty: ${item.quantity}`)) {
      try {
        await inventoryService.hardDeleteInventoryRecord(item.id);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleIssueToAssembly = async (item) => {
    try {
      await inventoryService.updateInventoryItem(item.id, {
        inventory_category: 'assembly_buffer',
        lifecycle_stage: 'ASSEMBLY',
        status: 'stored'
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleBuildSubmit = async (e) => {
    e.preventDefault();
    if (!subAssemblyForm.name) return alert("Assembly requires a name.");
    if (subAssemblyForm.components.some(c => !c.id || c.consumeQty <= 0)) {
      return alert("Ensure all selected components are valid and have consume quantities greater than 0.");
    }
    
    try {
      await inventoryService.createAssembly(machineId, subAssemblyForm, showBuildModal);
      setShowBuildModal(null);
      setSubAssemblyForm({ name: '', quantity: 1, components: [{ id: '', consumeQty: 1 }] });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (showStorageModal) {
      if (showStorageModal.type === 'tool') {
        setStorageForm({ rack: 'T', shelf: '1', bin: '01' });
      } else if (showStorageModal.type === 'fastener') {
        setStorageForm({ rack: 'F', shelf: '1', bin: '01' });
      } else {
        setStorageForm({ rack: 'A', shelf: '1', bin: '01' });
      }
    }
  }, [showStorageModal]);

  const getChecklistForType = (type) => {
    const lists = {
      procured: ['Visual Damage', 'Model Match', 'Quantity Count'],
      manufactured: ['Dimensional Tolerance', 'Surface Finish', 'Drawing Compliance', 'Burr Removal'],
      tool: ['Functional Test', 'Calibration Check', 'Storage Box Clean'],
      fastener: ['Size Verification', 'Thread Quality', 'Quantity Batch Count']
    };
    return lists[type] || ['General Inspection'];
  };

  const statusBadge = (status) => {
    const styles = {
      incoming: { bg: '#fff7ed', text: '#ea580c', label: '🟡 Incoming' },
      qc_pending: { bg: '#eff6ff', text: '#2563eb', label: '🔵 QC Pending' },
      approved: { bg: '#f0fdf4', text: '#16a34a', label: '🟢 Approved' },
      stored: { bg: '#f5f3ff', text: '#7c3aed', label: '💜 Stored' },
      rejected: { bg: '#fef2f2', text: '#dc2626', label: '🔴 Rejected' }
    };
    const s = styles[status] || styles.incoming;
    return <span style={{ padding: '2px 8px', borderRadius: '4px', background: s.bg, color: s.text, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>;
  };

  const filteredData = useMemo(() => {
    const active = inventoryItems.filter(i => i.status !== 'deleted');
    
    // Helper to gracefully map old or mismatched categories to the new strict schema
    const getCategory = (item) => {
      if (item.inventory_category === 'fastener_bay' || item.inventory_category === 'fastener') return 'fastener_bay';
      if (item.inventory_category === 'fabrication_store' || item.inventory_category === 'manufactured') return 'fabrication_store';
      if (item.inventory_category === 'production_stock' || item.inventory_category === 'procured') return 'production_stock';
      if (item.inventory_category === 'sub_assembly') return 'sub_assembly';
      if (item.inventory_category === 'full_assembly' || item.inventory_category === 'assembly_buffer') return 'full_assembly';
      if (item.inventory_category === 'quarantine_zone' || item.status === 'rejected') return 'quarantine_zone';
      if (item.inventory_category === 'dispatch_zone' || item.status === 'dispatched') return 'dispatch_zone';
      
      // Default to receiving hub if it's incoming or pending qc
      if (['incoming', 'qc_pending', 'approved'].includes(item.status)) return 'receiving_hub';
      
      return item.inventory_category || 'receiving_hub';
    };

    return {
      receiving: active.filter(i => getCategory(i) === 'receiving_hub'),
      production: active.filter(i => getCategory(i) === 'production_stock'),
      fabrication: active.filter(i => getCategory(i) === 'fabrication_store'),
      fasteners: active.filter(i => getCategory(i) === 'fastener_bay'),
      sub_assembly: active.filter(i => getCategory(i) === 'sub_assembly'),
      full_assembly: active.filter(i => getCategory(i) === 'full_assembly'),
      quarantine: active.filter(i => getCategory(i) === 'quarantine_zone'),
      dispatch: active.filter(i => getCategory(i) === 'dispatch_zone')
    };
  }, [inventoryItems]);

  const filteredComboboxItems = useMemo(() => {
    let list = masterList;
    if (itemFilter !== 'All') {
      list = list.filter(item => item.displayType === itemFilter);
    }
    if (searchQuery && !incomingForm.componentId) {
      const lowerQ = searchQuery.toLowerCase();
      list = list.filter(item => 
        item.name.toLowerCase().includes(lowerQ) || 
        item.displayType.toLowerCase().includes(lowerQ)
      );
    }
    
    return {
      'Recently Used': recentItems.map(id => masterList.find(i => i.id === id)).filter(Boolean),
      'PROCURED': list.filter(i => i.displayType === 'Procured'),
      'MANUFACTURED': list.filter(i => i.displayType === 'Manufactured'),
      'FASTENERS': list.filter(i => i.displayType === 'Fastener'),
      'TOOLS': list.filter(i => i.displayType === 'Tool')
    };
  }, [masterList, searchQuery, itemFilter, recentItems, incomingForm.componentId]);

  const handleTabChange = (tabId) => {
    navigate(`/dashboard/${machineId}/inventory?tab=${tabId}`);
  };

  const tableRef = React.useRef(null);
  
  const scrollToTable = () => {
    setTimeout(() => {
      if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleActionClick = (tabId) => {
    handleTabChange(tabId);
    scrollToTable();
  };

  const NavBlock = ({ id, title, count, active, onClick, height, themeColor = '#4f46e5', actions, actionPosition = 'bottom' }) => (
    <div 
      style={{
        background: active ? themeColor : '#ffffff',
        color: active ? '#ffffff' : '#334155',
        border: active ? 'none' : '1px solid #e2e8f0',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: height || '80px',
        flex: height ? 'none' : 1,
        boxShadow: active ? `0 10px 25px -5px ${themeColor}66` : '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        transform: active ? 'translateY(-2px)' : 'none',
        overflow: 'hidden'
      }}
    >
      {actions && actionPosition === 'top' && (
        <div style={{ display: 'flex', borderBottom: active ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', background: active ? 'transparent' : '#f8fafc' }}>
          {actions.map((action, idx) => (
             <button 
                key={idx} 
                onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                style={{
                  flex: 1, padding: '10px 4px', background: 'none', border: 'none', 
                  borderRight: idx < actions.length - 1 ? (active ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0') : 'none',
                  color: active ? '#fff' : themeColor, fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = active ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
             >
                {action.icon} {action.label}
             </button>
          ))}
        </div>
      )}

      <div onClick={() => onClick(id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', cursor: 'pointer' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, textAlign: 'center', letterSpacing: '-0.02em' }}>{title}</div>
        <div style={{ marginTop: '8px', background: active ? 'rgba(255,255,255,0.2)' : '#f1f5f9', color: active ? '#fff' : '#64748b', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
          {count} Items
        </div>
      </div>

      {actions && actionPosition === 'bottom' && (
        <div style={{ display: 'flex', borderTop: active ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', background: active ? 'transparent' : '#f8fafc' }}>
          {actions.map((action, idx) => (
             <button 
                key={idx} 
                onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                style={{
                  flex: 1, padding: '10px 4px', background: 'none', border: 'none', 
                  borderRight: idx < actions.length - 1 ? (active ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0') : 'none',
                  color: active ? '#fff' : '#475569', fontWeight: 600, fontSize: '11px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = active ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
             >
                {action.icon} {action.label}
             </button>
          ))}
        </div>
      )}
    </div>
  );

  const getStorageActions = (id) => [
    { label: 'View', icon: '👁', onClick: () => handleActionClick(id) },
    { label: 'Edit', icon: '✏️', onClick: () => handleActionClick(id) }
  ];

  const colors = {
    receiving: '#3b82f6',   // Blue
    production: '#10b981',  // Emerald
    fabrication: '#f59e0b', // Amber
    fasteners: '#64748b',   // Slate
    sub_assembly: '#8b5cf6',// Violet
    full_assembly: '#0f172a',// Slate 900
    quarantine: '#ef4444'   // Red
  };

  const FlowArrow = ({ style }) => (
    <div style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
    </div>
  );

  const FlowArrowDown = ({ style }) => (
    <div style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m-7-7 7 7 7-7"/></svg>
    </div>
  );

  const renderTable = () => {
    switch(activeTab) {
      case 'receiving':
        return (
          <div className="table-container" style={{ margin: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Batch ID</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplier</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Qty</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Received Date</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>QC Status</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.receiving.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '12px', color: '#475569' }}>{item.inventory_code || item.batchId}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#334155' }}>{item.source || 'Vendor'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{item.name}</div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>{item.type}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{item.quantity}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>{item.createdAt ? new Date(item.createdAt.toDate?.() || item.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td style={{ padding: '12px 16px' }}>{statusBadge(item.status)}</td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: '4px' }}>
                      {item.status === 'incoming' && (
                        <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => inventoryService.updateInventoryItem(item.id, { status: 'qc_pending' })}>To QC</button>
                      )}
                      {item.status === 'qc_pending' && (
                        <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => setShowQCModal(item)}>Process QC</button>
                      )}
                      {item.status === 'approved' && (
                        <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => setShowStorageModal(item)}>Assign Storage</button>
                      )}
                      <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => { setShowEditModal(item); setEditForm({ name: item.name, quantity: item.quantity, source: item.source || '', details: item.details || '' }); }}>Edit Intake</button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto', background: '#fee2e2', color: '#dc2626' }} onClick={() => handleDelete(item)}>Archive</button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto', background: '#7f1d1d', color: '#fff' }} onClick={() => handleHardDelete(item)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {filteredData.receiving.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>No items in Receiving Hub.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );

      case 'quarantine':
        return (
          <div className="table-container" style={{ margin: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Batch ID</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item Name</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rejected Qty</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rejection Reason</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Inspector</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.quarantine.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '12px', color: '#ef4444' }}>{item.inventory_code || item.batchId}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{item.name}</div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>{item.type}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{item.quantity}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#b91c1c', fontWeight: 500 }}>{item.qc?.remarks || 'Failed inspection'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{item.qc?.inspector}</td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: '4px' }}>
                        <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => inventoryService.updateInventoryItem(item.id, { status: 'qc_pending' })}>Rework</button>
                        <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => { setShowEditModal(item); setEditForm({ name: item.name, quantity: item.quantity, source: item.source || '', details: item.details || '' }); }}>Edit QC Notes</button>
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto', background: '#fee2e2', color: '#dc2626' }} onClick={() => handleDelete(item)}>Archive</button>
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto', background: '#7f1d1d', color: '#fff' }} onClick={() => handleHardDelete(item)}>Scrap</button>
                    </td>
                  </tr>
                ))}
                {filteredData.quarantine.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>Basket (Quarantine) is clear.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );

      default:
        const activeItems = filteredData[activeTab] || [];
        return (
          <div className="table-container" style={{ margin: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item Name</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Qty</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reserved Qty</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Storage Location</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tracking Code</th>
                  <th style={{ padding: '10px 16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{item.name}</div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>{item.type}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: '#16a34a' }}>{item.quantity}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: '#94a3b8' }}>0</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 6px', background: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>
                        {item.location?.rack ? `${item.location.rack}-${item.location.shelf}-${item.location.bin}` : 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>{item.inventory_code || item.batchId}</td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      
                      {activeTab === 'production' && (
                        <>
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => handleIssueToAssembly(item)}>Issue to Full Assembly</button>
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => alert("Transfer Stock workflow coming soon.")}>Transfer Stock</button>
                        </>
                      )}
                      
                      {activeTab === 'fabrication' && (
                        <>
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => alert("Update Fabrication Status workflow coming soon.")}>Update Status</button>
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => inventoryService.updateInventoryItem(item.id, { status: 'qc_pending' })}>Move to QC</button>
                        </>
                      )}

                      {activeTab === 'fasteners' && (
                        <>
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => alert("Restock workflow coming soon.")}>Restock</button>
                        </>
                      )}

                      {(activeTab === 'sub_assembly' || activeTab === 'full_assembly') && (
                        <>
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => alert("Update Assembly Status workflow coming soon.")}>Update Status</button>
                        </>
                      )}

                      <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto' }} onClick={() => { setShowEditModal(item); setEditForm({ name: item.name, quantity: item.quantity, source: item.source || '', details: item.details || '' }); }}>
                        {activeTab === 'production' ? 'Edit Stock' : 
                         activeTab === 'fasteners' ? 'Edit Hardware Data' : 
                         activeTab === 'fabrication' ? 'Edit Manufacturing Data' :
                         (activeTab === 'sub_assembly' || activeTab === 'full_assembly') ? 'Edit Assembly Data' : 'Edit Data'}
                      </button>

                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto', background: '#fee2e2', color: '#dc2626' }} onClick={() => handleDelete(item)}>Archive</button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'auto', height: 'auto', background: '#7f1d1d', color: '#fff' }} onClick={() => handleHardDelete(item)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {activeItems.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>No inventory found in this category.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}>
      
      {/* HEADER SECTION - COMPACT AND PROFESSIONAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>MATERIAL LIFECYCLE MANAGEMENT</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0, fontWeight: 500 }}>Track material flow from receiving to final assembly.</p>
        </div>
      </div>

      {/* DOMINANT KANBAN MAP CONTAINER (Imaginary Boundary) */}
      <div style={{ 
        background: '#ffffff', 
        border: '2px dashed #cbd5e1', 
        borderRadius: '24px', 
        padding: '24px', 
        marginBottom: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 40px minmax(200px, 1.2fr) 40px minmax(240px, 1.5fr)', gap: '12px', alignItems: 'stretch' }}>
          
          {/* Column 1: Receiving & Basket */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <NavBlock 
              id="receiving" 
              title="Receiving Hub" 
              count={filteredData.receiving.length} 
              active={activeTab === 'receiving'} 
              onClick={handleTabChange} 
              height="200px"
              themeColor={colors.receiving}
              actionPosition="top"
              actions={[
                { label: 'Add Logs', icon: '➕', onClick: () => setShowAddModal(true) },
                { label: 'View Logs', icon: '👁', onClick: () => handleActionClick('receiving') }
              ]}
            />
            
            <FlowArrowDown style={{ margin: '-4px 0' }} />

            <NavBlock 
              id="quarantine" 
              title="Basket" 
              count={filteredData.quarantine.length} 
              active={activeTab === 'quarantine'} 
              onClick={handleTabChange} 
              height="100px" 
              themeColor={colors.quarantine}
              actions={[{ label: 'View Rejects', icon: '🗑', onClick: () => handleActionClick('quarantine') }]}
            />
          </div>

          {/* Arrow Column 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '48px', alignItems: 'center', paddingBottom: '140px' }}>
            <FlowArrow />
            <FlowArrow />
            <FlowArrow />
          </div>

          {/* Column 2: Storage Stores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em', marginTop: '-4px' }}>ONLY AFTER QC</div>
            
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #4f46e5', background: '#fff', boxShadow: '0 2px 4px -1px rgba(79, 70, 229, 0.1)' }}>
                <button 
                  onClick={() => setShowBuildModal('sub_assembly')}
                  style={{ flex: 1, padding: '8px', background: '#4f46e5', color: '#fff', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = '#4338ca'}
                  onMouseOut={e => e.currentTarget.style.background = '#4f46e5'}
                >
                  Build subAss
                </button>
                <button 
                  onClick={() => setShowBuildModal('full_assembly')}
                  style={{ flex: 1, padding: '8px', background: '#fff', color: '#4f46e5', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseOut={e => e.currentTarget.style.background = '#fff'}
                >
                  Build full
                </button>
            </div>

            <NavBlock id="production" title="Production Stock" count={filteredData.production.length} active={activeTab === 'production'} onClick={handleTabChange} height="auto" themeColor={colors.production} actions={getStorageActions('production')} />
            <NavBlock id="fabrication" title="Fabrication Store" count={filteredData.fabrication.length} active={activeTab === 'fabrication'} onClick={handleTabChange} height="auto" themeColor={colors.fabrication} actions={getStorageActions('fabrication')} />
            <NavBlock id="fasteners" title="Fasteners Bay" count={filteredData.fasteners.length} active={activeTab === 'fasteners'} onClick={handleTabChange} height="auto" themeColor={colors.fasteners} actions={getStorageActions('fasteners')} />
          </div>

          {/* Arrow Column 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <FlowArrow />
          </div>

          {/* Column 3: Assembly */}
          <div style={{ display: 'flex', flexDirection: 'row', position: 'relative' }}>
            <div 
                onClick={() => handleTabChange('full_assembly')}
                style={{
                  background: activeTab === 'full_assembly' ? colors.full_assembly : '#ffffff',
                  color: activeTab === 'full_assembly' ? '#ffffff' : '#334155',
                  border: activeTab === 'full_assembly' ? 'none' : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  flex: 1,
                  padding: '24px',
                  paddingLeft: '130px', // Room for sub assembly
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: activeTab === 'full_assembly' ? `0 10px 25px -5px ${colors.full_assembly}66` : '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: activeTab === 'full_assembly' ? 'translateY(-2px)' : 'none',
                  overflow: 'hidden'
                }}
            >
                <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}>Full Assembly</div>
                <div style={{ background: activeTab === 'full_assembly' ? 'rgba(255,255,255,0.2)' : '#f1f5f9', color: activeTab === 'full_assembly' ? '#fff' : '#64748b', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{filteredData.full_assembly.length} Items</div>

                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', borderTop: activeTab === 'full_assembly' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', background: activeTab === 'full_assembly' ? 'transparent' : '#f8fafc' }}>
                  <button onClick={(e) => { e.stopPropagation(); handleActionClick('full_assembly'); }} style={{ flex: 1, padding: '12px', background: 'none', border: 'none', color: activeTab === 'full_assembly' ? '#fff' : '#475569', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>👁 View Logs</button>
                </div>

                {/* Nested Sub Assembly Box */}
                <div 
                  onClick={(e) => { e.stopPropagation(); handleTabChange('sub_assembly'); }}
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '50%',
                    transform: `translateY(-50%) ${activeTab === 'sub_assembly' ? 'scale(1.02)' : 'scale(1)'}`,
                    background: activeTab === 'sub_assembly' ? colors.sub_assembly : '#ffffff',
                    color: activeTab === 'sub_assembly' ? '#ffffff' : '#334155',
                    border: activeTab === 'sub_assembly' ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '0',
                    width: '140px',
                    height: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: activeTab === 'sub_assembly' ? `0 10px 25px -5px ${colors.sub_assembly}66` : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 10,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, textAlign: 'center', letterSpacing: '-0.02em', lineHeight: '1.2' }}>Sub<br/>Assembly</div>
                    <div style={{ marginTop: '8px', background: activeTab === 'sub_assembly' ? 'rgba(255,255,255,0.2)' : '#f1f5f9', color: activeTab === 'sub_assembly' ? '#fff' : '#64748b', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>{filteredData.sub_assembly.length} Items</div>
                  </div>

                  <div style={{ display: 'flex', borderTop: activeTab === 'sub_assembly' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', background: activeTab === 'sub_assembly' ? 'transparent' : '#f8fafc' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleActionClick('sub_assembly'); }} style={{ flex: 1, padding: '8px', background: 'none', border: 'none', borderRight: activeTab === 'sub_assembly' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', color: activeTab === 'sub_assembly' ? '#fff' : '#475569', fontWeight: 700, fontSize: '11px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>👁 View</button>
                    <button onClick={(e) => { e.stopPropagation(); handleActionClick('sub_assembly'); }} style={{ flex: 1, padding: '8px', background: 'none', border: 'none', color: activeTab === 'sub_assembly' ? '#fff' : '#475569', fontWeight: 700, fontSize: '11px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>✏️ Edit</button>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* DOMINANT OPERATIONAL TABLE */}
      <div ref={tableRef} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {activeTab === 'receiving' ? 'Receiving Hub' : 
           activeTab === 'quarantine' ? 'Basket (Quarantine)' : 
           activeTab === 'production' ? 'Production Stock' : 
           activeTab === 'fabrication' ? 'Fabrication Store' : 
           activeTab === 'fasteners' ? 'Fasteners Bay' : 
           activeTab === 'sub_assembly' ? 'Sub Assembly Inventory' : 
           activeTab === 'full_assembly' ? 'Full Assembly Inventory' : 'Inventory'}
        </div>
        {renderTable()}
      </div>

      {/* MODALS */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 500, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#0f172a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 600 }}>Log Incoming Material</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <form onSubmit={handleAddIncoming} style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '16px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Search Item</label>
                
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {['All', 'Procured', 'Manufactured', 'Fastener', 'Tool'].map(f => (
                    <button 
                      type="button" 
                      key={f}
                      onClick={() => setItemFilter(f)}
                      style={{ 
                        padding: '4px 10px', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        borderRadius: '12px', 
                        background: itemFilter === f ? '#0f172a' : '#f1f5f9', 
                        color: itemFilter === f ? '#fff' : '#64748b', 
                        border: 'none', 
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <input 
                  type="text" 
                  placeholder="Type to search component..." 
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                    if(incomingForm.componentId) setIncomingForm({ ...incomingForm, componentId: '' });
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: incomingForm.componentId ? '2px solid #10b981' : '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                />

                {showDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '4px', maxHeight: '280px', overflowY: 'auto', zIndex: 50, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                    {Object.entries(filteredComboboxItems).map(([groupName, items]) => {
                      if (items.length === 0) return null;
                      if (groupName === 'Recently Used' && searchQuery && !incomingForm.componentId) return null;
                      
                      return (
                        <div key={groupName}>
                          <div style={{ padding: '8px 12px', background: '#f8fafc', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', borderTop: groupName !== 'Recently Used' ? '1px solid #e2e8f0' : 'none' }}>{groupName}</div>
                          {items.map(item => (
                            <div 
                              key={item.id} 
                              onClick={() => {
                                setIncomingForm({ ...incomingForm, componentId: item.id });
                                setSearchQuery(item.name);
                                setShowDropdown(false);
                              }}
                              style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{item.name}</span>
                              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: 500 }}>{item.displayType} • {item.source || 'Standard Part'}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {Object.values(filteredComboboxItems).every(arr => arr.length === 0) && (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>No items found matching "{searchQuery}"</div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Intake Quantity</label>
                  <input type="number" required min="1" value={incomingForm.quantity} onChange={e => setIncomingForm({ ...incomingForm, quantity: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Supplier / Vendor</label>
                  <input placeholder="e.g. Acme Corp" value={incomingForm.source} onChange={e => setIncomingForm({ ...incomingForm, source: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Notes / GRN Reference</label>
                <textarea rows="2" value={incomingForm.details} onChange={e => setIncomingForm({ ...incomingForm, details: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Log to Receiving Hub</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQCModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 500, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#3b82f6', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 600 }}>Quality Check: {showQCModal.name}</h2>
              <button onClick={() => setShowQCModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Batch Details</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>Batch: #{showQCModal.batchId} | Qty: {showQCModal.quantity}</div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Inspector Name</label>
                <input required value={qcForm.inspector} onChange={e => setQCForm({ ...qcForm, inspector: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Inspection Checklist</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getChecklistForType(showQCModal.type).map((item, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Remarks / Observation</label>
                <textarea rows="3" required value={qcForm.remarks} onChange={e => setQCForm({ ...qcForm, remarks: e.target.value })} placeholder="State reasons for pass/fail..." style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => handleProcessQC(false)} style={{ flex: 1, padding: '12px', background: '#ef4444', border: 'none', borderRadius: '4px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: '13px' }}>🔴 FAIL (To Quarantine)</button>
                <button type="button" onClick={() => handleProcessQC(true)} style={{ flex: 1, padding: '12px', background: '#22c55e', border: 'none', borderRadius: '4px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: '13px' }}>🟢 PASS (To Storage)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStorageModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 450, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#10b981', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 600 }}>Assign Storage: {showStorageModal.name}</h2>
              <button onClick={() => setShowStorageModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <form onSubmit={handleAssignStorage} style={{ padding: '20px' }}>
               <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                 <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Rack</label>
                    <input required placeholder="A" value={storageForm.rack} onChange={e => setStorageForm({ ...storageForm, rack: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                 </div>
                 <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Shelf</label>
                    <input required placeholder="1" value={storageForm.shelf} onChange={e => setStorageForm({ ...storageForm, shelf: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                 </div>
                 <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Bin</label>
                    <input required placeholder="01" value={storageForm.bin} onChange={e => setStorageForm({ ...storageForm, bin: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                 </div>
               </div>
               <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowStorageModal(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#10b981', border: 'none', borderRadius: '4px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Confirm Storage</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 500, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#475569', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 600 }}>
                {activeTab === 'production' || activeTab === 'fasteners' ? 'Adjust Stock Entry' : 
                 activeTab === 'fabrication' ? 'Update Fabrication Data' :
                 activeTab === 'quarantine' ? 'Update QC Reject Notes' :
                 activeTab === 'receiving' ? 'Edit Intake Record' :
                 'Edit Inventory Record'}
              </h2>
              <button onClick={() => setShowEditModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Inventory Code</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{showEditModal.inventory_code || showEditModal.batchId}</div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Item Name / Specification</label>
                <input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#f1f5f9' }} readOnly />
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Core component definition is locked for traceability.</span>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    {activeTab === 'quarantine' ? 'Rejected Quantity' : 'Quantity / Count'}
                  </label>
                  <input type="number" required min="0" value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    {activeTab === 'fabrication' ? 'Internal Vendor / Source' : 'Supplier / Vendor'}
                  </label>
                  <input value={editForm.source} onChange={e => setEditForm({ ...editForm, source: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  {activeTab === 'quarantine' ? 'Updated QC Remarks' : 'Notes / Remarks'}
                </label>
                <textarea rows="2" value={editForm.details} onChange={e => setEditForm({ ...editForm, details: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowEditModal(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#475569', border: 'none', borderRadius: '4px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Save Updates</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBuildModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 600, maxWidth: '90vw', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: showBuildModal === 'sub_assembly' ? '#4f46e5' : '#0f172a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 600 }}>
                {showBuildModal === 'sub_assembly' ? 'Combine Items into Sub-Assembly' : 'Combine Items into Full Assembly'}
              </h2>
              <button onClick={() => setShowBuildModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <form onSubmit={handleBuildSubmit} style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>{showBuildModal === 'sub_assembly' ? 'Sub-Assembly Name' : 'Final Assembly Name'}</label>
                  <input required placeholder="e.g. X-Axis Carriage" value={subAssemblyForm.name} onChange={e => setSubAssemblyForm({ ...subAssemblyForm, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Quantity Created</label>
                  <input type="number" required min="1" value={subAssemblyForm.quantity} onChange={e => setSubAssemblyForm({ ...subAssemblyForm, quantity: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  <span>Consumed Components</span>
                  <button type="button" style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }} onClick={() => setSubAssemblyForm({ ...subAssemblyForm, components: [...subAssemblyForm.components, { id: '', consumeQty: 1 }] })}>+ Add Item</button>
                </label>
                
                {subAssemblyForm.components.map((comp, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ flex: 1 }}>
                      <select required value={comp.id} onChange={e => {
                        const newComps = [...subAssemblyForm.components];
                        newComps[idx].id = e.target.value;
                        setSubAssemblyForm({ ...subAssemblyForm, components: newComps });
                      }} style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                        <option value="">-- Select Source Item --</option>
                        {inventoryItems
                          .filter(i => i.status !== 'deleted' && i.quantity > 0)
                          .filter(i => {
                            const cat = i.inventory_category;
                            // When building SUB assembly: only allow raw materials
                            if (showBuildModal === 'sub_assembly') {
                              return ['production_stock', 'fabrication_store', 'fastener_bay', 'receiving_hub'].includes(cat) || !cat;
                            }
                            // When building FULL assembly: allow raw materials AND sub assemblies
                            return ['production_stock', 'fabrication_store', 'fastener_bay', 'sub_assembly', 'receiving_hub'].includes(cat) || !cat;
                          })
                          .map(item => (
                            <option key={item.id} value={item.id}>{item.inventory_code || item.batchId} - {item.name} (Available: {item.quantity})</option>
                          ))}
                      </select>
                    </div>
                    <div style={{ width: '100px' }}>
                      <input type="number" required min="1" placeholder="Qty" value={comp.consumeQty} onChange={e => {
                        const newComps = [...subAssemblyForm.components];
                        newComps[idx].consumeQty = Number(e.target.value);
                        setSubAssemblyForm({ ...subAssemblyForm, components: newComps });
                      }} style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                    </div>
                    {subAssemblyForm.components.length > 1 && (
                      <button type="button" onClick={() => {
                        const newComps = subAssemblyForm.components.filter((_, i) => i !== idx);
                        setSubAssemblyForm({ ...subAssemblyForm, components: newComps });
                      }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '4px' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowBuildModal(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', background: showBuildModal === 'sub_assembly' ? '#4f46e5' : '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                  {showBuildModal === 'sub_assembly' ? 'Build & Move to Sub-Assembly' : 'Finalize Full Assembly'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
