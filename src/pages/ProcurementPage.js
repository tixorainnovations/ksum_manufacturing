import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { procurementService } from '../services/procurementService';
import Papa from 'papaparse';

const ProcurementPage = () => {
  const { machineId } = useParams();
  const [activeTab, setActiveTab] = useState('planning'); // planning, tenders, pos
  
  // Data States
  const [components, setComponents] = useState([]);
  const [tools, setTools] = useState([]);
  const [fasteners, setFasteners] = useState([]);
  const [estimations, setEstimations] = useState({}); // componentId -> {marketRate, bufferPercent}
  const [tenders, setTenders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection for Tenders
  const [selectedItems, setSelectedItems] = useState([]);

  // Modals
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [tenderForm, setTenderForm] = useState({ title: '', category: '', remarks: '' });
  const [poForm, setPoForm] = useState({ supplier: '', remarks: '' });
  const [productionForm, setProductionForm] = useState({ department: 'Mechanical', priority: 'Medium', remarks: '' });
  const [activeDetailItem, setActiveDetailItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const exportDocument = (type, data, format) => {
    if (format === 'pdf') {
      window.print();
      return;
    }

    let csvContent = "";
    let fileName = "";
    const ext = format === 'excel' ? 'xls' : format === 'doc' ? 'doc' : 'csv';

    if (type === 'tender') {
      fileName = `${data.tenderId}_Details.${ext}`;
      csvContent = "ID,Tender Title,Category,Item Name,Quantity,Estimated Rate,Total\n";
      data.items.forEach(item => {
        csvContent += `${data.tenderId},${data.title},${data.category},${item.name},${item.quantity},${item.estimatedRate},${item.totalEstimated}\n`;
      });
    } else if (type === 'po') {
      fileName = `${data.poNumber}_Details.${ext}`;
      csvContent = "PO Number,Supplier,Item Name,Quantity,Unit Price,Total Price\n";
      data.items.forEach(item => {
        csvContent += `${data.poNumber},${data.supplier},${item.name},${item.quantity},${item.unitPrice},${item.totalPrice}\n`;
      });
    } else if (type === 'mfg') {
      fileName = `${data.batchNumber}_Shop_Order.${ext}`;
      csvContent = "Batch Number,Department,Priority,Item Name,Quantity,Status\n";
      data.items.forEach(item => {
        csvContent += `${data.batchNumber},${data.department},${data.priority},${item.name},${item.quantity},${data.status}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: format === 'doc' ? 'application/msword' : 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Sub-tabs for Planning Modes
  const [planningMode, setPlanningMode] = useState('unassigned'); // unassigned, tender, direct, inhouse, other

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const newEsts = { ...estimations };
        let count = 0;

        results.data.forEach(row => {
          // Find component by name (case-insensitive)
          const compName = (row.name || row.Component || row.item || '').trim().toLowerCase();
          const marketRate = Number(row.rate || row.marketRate || row.Price || 0);
          const buffer = Number(row.buffer || row.bufferPercent || 0);

          if (compName) {
            const comp = [...components, ...tools, ...fasteners].find(c => c.name?.toLowerCase().trim() === compName);
            if (comp) {
              newEsts[comp.id] = { marketRate, bufferPercent: buffer };
              count++;
            }
          }
        });

        setEstimations(newEsts);
        setShowUploadModal(false);
        alert(`Successfully mapped ${count} items from CSV. Don't forget to click 'Save Estimations' to persist changes.`);
      }
    });
  };

  const downloadTemplate = () => {
    const csvContent = "name,marketRate,bufferPercent\nLinear block 2,120,10\nIdler pulleys,250,5";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'estimation_template.csv';
    a.click();
  };

  useEffect(() => {
    if (!machineId) return;

    // Fetch Components
    const unsubComps = onSnapshot(query(collection(db, "components"), where("machineId", "==", machineId)), (snap) => {
      setComponents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Tools
    const unsubTools = onSnapshot(query(collection(db, "tools"), where("machineId", "==", machineId)), (snap) => {
      setTools(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), componentType: 'tool' })));
    });

    // Fetch Fasteners
    const unsubFasteners = onSnapshot(query(collection(db, "fasteners"), where("machineId", "==", machineId)), (snap) => {
      setFasteners(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), componentType: 'fastener' })));
    });

    // Fetch Estimations
    const unsubEsts = onSnapshot(query(collection(db, "component_estimations"), where("machineId", "==", machineId)), (snap) => {
      const estMap = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        estMap[data.componentId] = data;
      });
      setEstimations(estMap);
    });

    // Fetch Tenders
    const unsubTenders = onSnapshot(query(collection(db, "tenders"), where("machineId", "==", machineId), orderBy("createdAt", "desc")), (snap) => {
      setTenders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Purchase Orders
    const unsubPOs = onSnapshot(query(collection(db, "procurement"), where("machineId", "==", machineId), orderBy("createdAt", "desc")), (snap) => {
      setPurchaseOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Production Orders
    const unsubProd = onSnapshot(query(collection(db, "production_orders"), where("machineId", "==", machineId), orderBy("createdAt", "desc")), (snap) => {
      setProductionOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubComps();
      unsubTools();
      unsubFasteners();
      unsubEsts();
      unsubTenders();
      unsubPOs();
      unsubProd();
    };
  }, [machineId]);

  const handleRateChange = (componentId, field, value) => {
    const val = field === 'procurementMode' ? value : Number(value);
    setEstimations(prev => ({
      ...prev,
      [componentId]: {
        ...(prev[componentId] || { marketRate: 0, bufferPercent: 0, procurementMode: 'unassigned' }),
        [field]: val
      }
    }));
  };

  const saveEstimations = async () => {
    try {
      const estList = Object.entries(estimations).map(([id, data]) => ({
        componentId: id,
        marketRate: data.marketRate,
        bufferPercent: data.bufferPercent
      }));
      await procurementService.saveEstimations(machineId, estList);
      alert("Estimations saved successfully!");
    } catch (error) {
      console.error(error);
    }
  };

  const toggleSelection = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCreateTender = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) return alert("Select at least one item.");
    
    try {
      const tenderItems = selectedItems.map(id => {
        const item = planningData.find(c => c.id === id);
        return {
          componentId: id,
          name: item.name,
          quantity: item.quantity,
          estimatedRate: item.finalRate,
          totalEstimated: item.totalAmount
        };
      });

      await procurementService.createTender(machineId, {
        ...tenderForm,
        items: tenderItems
      });

      setShowTenderModal(false);
      setSelectedItems([]);
      setTenderForm({ title: '', category: '', remarks: '' });
      setActiveTab('tenders');
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) return alert("Select at least one item.");

    try {
      const poItems = selectedItems.map(id => {
        const item = planningData.find(c => c.id === id);
        return {
          componentId: id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.finalRate,
          totalPrice: item.totalAmount
        };
      });

      const totalAmount = poItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

      await procurementService.createPurchaseOrder(machineId, {
        ...poForm,
        items: poItems,
        totalAmount
      });

      setShowPOModal(false);
      setSelectedItems([]);
      setPoForm({ supplier: '', remarks: '' });
      setActiveTab('pos');
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateProductionOrder = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) return alert("Select at least one item.");

    try {
      const prodItems = selectedItems.map(id => {
        const item = planningData.find(c => c.id === id);
        return {
          componentId: id,
          name: item.name,
          quantity: item.quantity,
          baseRate: item.finalRate
        };
      });

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const batchNumber = `MFG-${dateStr}-${randomCode}`;

      await addDoc(collection(db, "production_orders"), {
        machineId,
        batchNumber,
        ...productionForm,
        items: prodItems,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      setShowProductionModal(false);
      setSelectedItems([]);
      setProductionForm({ department: 'Mechanical', priority: 'Medium', remarks: '' });
      alert("Sent to Production successfully!");
    } catch (error) {
      console.error(error);
    }
  };

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [globalBuffer, setGlobalBuffer] = useState(0);

  const planningData = useMemo(() => {
    // Combine all sources
    const allItems = [
      ...components,
      ...tools.map(t => ({ ...t, quantity: t.qty || 1 })),
      ...fasteners.map(f => ({ ...f, quantity: f.qty || 1 }))
    ];

    let filtered = allItems.map(item => {
      const est = estimations[item.id] || { marketRate: 0, bufferPercent: 0, procurementMode: 'unassigned' };
      const base = est.marketRate || 0;
      const buffer = globalBuffer > 0 ? globalBuffer : (est.bufferPercent || 0);
      const finalRate = base * (1 + buffer / 100);
      return {
        ...item,
        marketRate: base,
        bufferPercent: buffer,
        procurementMode: est.procurementMode || 'unassigned',
        finalRate: finalRate,
        totalAmount: finalRate * item.quantity
      };
    });

    // Filter by Planning Mode Tab
    filtered = filtered.filter(item => item.procurementMode === planningMode);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item => item.name.toLowerCase().includes(q));
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.componentType === typeFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    return filtered;
  }, [components, tools, fasteners, estimations, searchQuery, typeFilter, categoryFilter, globalBuffer, planningMode]);

  const handleAssignMode = async (mode) => {
    if (selectedItems.length === 0) return;
    try {
      const updates = selectedItems.map(id => ({
        componentId: id,
        procurementMode: mode
      }));
      await procurementService.saveEstimations(machineId, updates);
      setSelectedItems([]);
      alert(`Moved ${selectedItems.length} items to ${mode.toUpperCase()}`);
    } catch (err) {
      console.error(err);
    }
  };

  const totalEstimationValue = planningData.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const unestimatedCount = planningData.filter(item => item.marketRate === 0).length;
  const totalItemsCount = planningData.length;

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* COMPLETENESS WARNING */}
      {unestimatedCount > 0 && activeTab === 'planning' && planningMode !== 'unassigned' && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '16px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.1)' }}>
          <div style={{ fontSize: '24px' }}>🚫</div>
          <div style={{ flex: 1 }}>
             <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#9f1239' }}>{planningMode.toUpperCase()} Process Blocked</h4>
             <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#be123c' }}>
               You have {unestimatedCount} unestimated items in the {planningMode} list. Full estimation for this category is required before proceeding.
             </p>
          </div>
          <button 
            onClick={() => { setSearchQuery(''); setTypeFilter('all'); setCategoryFilter('all'); }}
            style={{ background: '#ffe4e6', color: '#9f1239', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            Find Missing Rates
          </button>
        </div>
      )}
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Procurement & Tendering</h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Estimate costs, bundle packages, and manage tenders.</p>
        </div>
        {activeTab === 'planning' && (
          <div style={{ display: 'flex', gap: '12px' }}>
             <button 
                onClick={() => setShowUploadModal(true)}
                style={{ background: '#fff', color: '#4f46e5', border: '1px solid #4f46e5', padding: '12px 20px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                📤 Bulk Upload CSV
              </button>
             <button 
                onClick={saveEstimations}
                style={{ background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0', padding: '12px 20px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                💾 Save Estimations
              </button>
              
              {planningMode === 'tender' && (
                <button 
                  disabled={selectedItems.length === 0 || unestimatedCount > 0}
                  onClick={() => setShowTenderModal(true)}
                  style={{ 
                    background: (selectedItems.length > 0 && unestimatedCount === 0) ? '#4f46e5' : '#e2e8f0', 
                    color: 'white', 
                    border: 'none', 
                    padding: '12px 24px', 
                    borderRadius: '12px', 
                    fontWeight: 600, 
                    cursor: (selectedItems.length > 0 && unestimatedCount === 0) ? 'pointer' : 'not-allowed',
                    boxShadow: (selectedItems.length > 0 && unestimatedCount === 0) ? '0 4px 6px -1px rgba(79, 70, 229, 0.2)' : 'none'
                  }}
                >
                  📦 Create Tender Package ({selectedItems.length})
                </button>
              )}

              {planningMode === 'direct' && (
                <button 
                  disabled={selectedItems.length === 0 || unestimatedCount > 0}
                  onClick={() => setShowPOModal(true)}
                  style={{ 
                    background: (selectedItems.length > 0 && unestimatedCount === 0) ? '#16a34a' : '#e2e8f0', 
                    color: 'white', 
                    border: 'none', 
                    padding: '12px 24px', 
                    borderRadius: '12px', 
                    fontWeight: 600, 
                    cursor: (selectedItems.length > 0 && unestimatedCount === 0) ? 'pointer' : 'not-allowed'
                  }}
                >
                  🛒 Create Purchase Order ({selectedItems.length})
                </button>
              )}
              {planningMode === 'inhouse' && (
                <button 
                  disabled={selectedItems.length === 0 || unestimatedCount > 0}
                  onClick={() => setShowProductionModal(true)}
                  style={{ 
                    background: (selectedItems.length > 0 && unestimatedCount === 0) ? '#2563eb' : '#e2e8f0', 
                    color: 'white', 
                    border: 'none', 
                    padding: '12px 24px', 
                    borderRadius: '12px', 
                    fontWeight: 600, 
                    cursor: (selectedItems.length > 0 && unestimatedCount === 0) ? 'pointer' : 'not-allowed'
                  }}
                >
                  🏭 Send to Production ({selectedItems.length})
                </button>
              )}
          </div>
        )}
      </div>

      {/* PRODUCTION ORDER MODAL */}
      {showProductionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Start Inhouse Production</h2>
              <button onClick={() => setShowProductionModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleCreateProductionOrder} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Target Department</label>
                <select 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                  value={productionForm.department}
                  onChange={(e) => setProductionForm({...productionForm, department: e.target.value})}
                >
                  <option value="Mechanical">Mechanical Shop</option>
                  <option value="Electrical">Electrical Assembly</option>
                  <option value="3D Printing">3D Printing Lab</option>
                  <option value="CNC Machining">CNC Machining Center</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Production Priority</label>
                <select 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                  value={productionForm.priority}
                  onChange={(e) => setProductionForm({...productionForm, priority: e.target.value})}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent (Critical Path)</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Fabrication Notes</label>
                <textarea 
                  placeholder="Specific manufacturing requirements..."
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box', minHeight: '80px' }}
                  value={productionForm.remarks}
                  onChange={(e) => setProductionForm({...productionForm, remarks: e.target.value})}
                />
              </div>
              <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '12px', marginBottom: '24px' }}>
                 <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>MANUFACTURING {selectedItems.length} ITEMS</div>
                 <div style={{ fontSize: '11px', color: '#1e3a8a' }}>Internal Valuation: ₹{planningData.filter(i => selectedItems.includes(i.id)).reduce((a,b) => a + b.totalAmount, 0).toLocaleString()}</div>
              </div>
              <button type="submit" style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}>Release to Shop Floor</button>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '450px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📤</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0' }}>Bulk Upload Estimations</h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>Upload a CSV file to automatically set Market Rates and Buffers based on component names.</p>
            
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
               <input 
                 type="file" 
                 accept=".csv" 
                 onChange={handleCSVUpload}
                 style={{ width: '100%', fontSize: '13px' }}
               />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
               <button onClick={downloadTemplate} style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Download Template</button>
               <button onClick={() => setShowUploadModal(false)} style={{ flex: 1, background: '#f1f5f9', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        {[
          { id: 'planning', label: '1. Planning & Estimation', icon: '📊' },
          { id: 'tenders', label: '2. Tender Packages', icon: '📜' },
          { id: 'pos', label: '3. Purchase Orders', icon: '🛒' },
          { id: 'inhouse_mfg', label: '4. Inhouse Mfg', icon: '🏭' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* PLANNING SUB-TABS (Only visible in Planning Tab) */}
      {activeTab === 'planning' && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '24px', borderBottom: '2px solid #e2e8f0', padding: '0 8px' }}>
            {[
              { id: 'unassigned', label: 'Unassigned Items', count: [...components, ...tools, ...fasteners].filter(i => (estimations[i.id]?.procurementMode || 'unassigned') === 'unassigned').length },
              { id: 'tender', label: '1. Tender', count: [...components, ...tools, ...fasteners].filter(i => estimations[i.id]?.procurementMode === 'tender').length },
              { id: 'direct', label: '2. Direct Purchase', count: [...components, ...tools, ...fasteners].filter(i => estimations[i.id]?.procurementMode === 'direct').length },
              { id: 'inhouse', label: '3. Inhouse Manufacturing', count: [...components, ...tools, ...fasteners].filter(i => estimations[i.id]?.procurementMode === 'inhouse').length },
              { id: 'other', label: '4. Other', count: [...components, ...tools, ...fasteners].filter(i => estimations[i.id]?.procurementMode === 'other').length },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => { setPlanningMode(m.id); setSelectedItems([]); }}
                style={{
                  padding: '12px 4px',
                  border: 'none',
                  background: 'none',
                  borderBottom: planningMode === m.id ? '2px solid #4f46e5' : '2px solid transparent',
                  color: planningMode === m.id ? '#4f46e5' : '#64748b',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {m.label} <span style={{ background: planningMode === m.id ? '#eef2ff' : '#f1f5f9', color: planningMode === m.id ? '#4f46e5' : '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{m.count}</span>
              </button>
            ))}
          </div>
          
          {selectedItems.length > 0 && planningMode === 'unassigned' && (
            <div style={{ marginTop: '16px', padding: '16px', background: '#eef2ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <span style={{ fontSize: '14px', fontWeight: 600, color: '#4338ca' }}>Move {selectedItems.length} selected items to:</span>
               <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleAssignMode('tender')} style={{ background: 'white', border: '1px solid #4338ca', color: '#4338ca', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Tender</button>
                  <button onClick={() => handleAssignMode('direct')} style={{ background: 'white', border: '1px solid #4338ca', color: '#4338ca', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Direct Purchase</button>
                  <button onClick={() => handleAssignMode('inhouse')} style={{ background: 'white', border: '1px solid #4338ca', color: '#4338ca', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Inhouse Mfg</button>
                  <button onClick={() => handleAssignMode('other')} style={{ background: 'white', border: '1px solid #4338ca', color: '#4338ca', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Other</button>
               </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: PLANNING */}
      {activeTab === 'planning' && (
        <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '300px' }}>
               <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search components..." 
                    style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
               </div>
               <select 
                 value={typeFilter} 
                 onChange={(e) => setTypeFilter(e.target.value)}
                 style={{ padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', fontWeight: 600 }}
               >
                 <option value="all">All Types</option>
                 <option value="procured">Procured</option>
                 <option value="manufactured">Manufactured</option>
                 <option value="tool">Tools</option>
                 <option value="fastener">Fasteners</option>
               </select>
               <select 
                 value={categoryFilter} 
                 onChange={(e) => setCategoryFilter(e.target.value)}
                 style={{ padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', fontWeight: 600 }}
               >
                 <option value="all">All Categories</option>
                 <option value="Electronics">Electronics</option>
                 <option value="Mechanical">Mechanical</option>
                 <option value="Custom">Custom</option>
                 <option value="Fasteners">Fasteners</option>
                 <option value="Tools">Tools</option>
               </select>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', borderLeft: '1px solid #e2e8f0', marginLeft: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', whiteSpace: 'nowrap' }}>GLOBAL BUFFER %:</span>
                  <input 
                    type="number" 
                    placeholder="0" 
                    style={{ width: '60px', padding: '10px', borderRadius: '10px', border: '1px solid #4f46e5', fontSize: '13px', fontWeight: 700, textAlign: 'center', color: '#4f46e5' }}
                    value={globalBuffer || ''}
                    onChange={(e) => setGlobalBuffer(Number(e.target.value))}
                  />
               </div>
            </div>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>TOTAL PROJECT ESTIMATION</div>
               <div style={{ fontSize: '20px', fontWeight: 800, color: '#4f46e5' }}>₹{totalEstimationValue.toLocaleString()}</div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px', width: '40px' }}>
                  <input type="checkbox" checked={selectedItems.length === planningData.length && planningData.length > 0} onChange={() => setSelectedItems(selectedItems.length === planningData.length ? [] : planningData.map(c => c.id))} />
                </th>
                <th style={{ padding: '16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Component</th>
                <th style={{ padding: '16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: '16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Category</th>
                <th style={{ padding: '16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Mode</th>
                <th style={{ padding: '16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Qty</th>
                <th style={{ padding: '16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Market Rate (₹)</th>
                <th style={{ padding: '16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Buffer (%)</th>
                <th style={{ padding: '16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Final Rate</th>
                <th style={{ padding: '16px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {planningData.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px' }}>
                    <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleSelection(item.id)} />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {item.id.slice(0,8)}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: item.componentType === 'procured' ? '#f0fdf4' : '#eff6ff', color: item.componentType === 'procured' ? '#16a34a' : '#2563eb', textTransform: 'uppercase' }}>
                      {item.componentType}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{item.category || 'Uncategorized'}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <select 
                      value={item.procurementMode} 
                      onChange={(e) => handleRateChange(item.id, 'procurementMode', e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#475569', background: '#f8fafc' }}
                    >
                      <option value="unassigned">Unassigned</option>
                      <option value="tender">Tender</option>
                      <option value="direct">Direct Purchase</option>
                      <option value="inhouse">Inhouse Mfg</option>
                      <option value="other">Other</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px', fontWeight: 700 }}>{item.quantity}</td>
                  <td style={{ padding: '16px' }}>
                    <input 
                      type="number" 
                      value={item.marketRate} 
                      onChange={(e) => handleRateChange(item.id, 'marketRate', e.target.value)}
                      style={{ width: '100px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 600 }}
                    />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <input 
                      type="number" 
                      value={item.bufferPercent} 
                      disabled={globalBuffer > 0}
                      onChange={(e) => handleRateChange(item.id, 'bufferPercent', e.target.value)}
                      style={{ 
                        width: '70px', 
                        padding: '8px', 
                        borderRadius: '8px', 
                        border: '1px solid #e2e8f0', 
                        fontWeight: 600,
                        background: globalBuffer > 0 ? '#f8fafc' : 'white',
                        color: globalBuffer > 0 ? '#94a3b8' : '#1e293b'
                      }}
                    />
                  </td>
                  <td style={{ padding: '16px', fontWeight: 700, color: '#475569' }}>₹{item.finalRate.toFixed(2)}</td>
                  <td style={{ padding: '16px', fontWeight: 800, color: '#0f172a' }}>₹{item.totalAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: TENDERS */}
      {activeTab === 'tenders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
          {tenders.map(tender => (
            <div key={tender.id} style={{ background: 'white', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tender.tenderId}</span>
                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{tender.status}</span>
               </div>
               <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>{tender.title}</h3>
               <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>{tender.category} • {tender.items.length} components</div>
               
               <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                  {tender.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                       <span style={{ color: '#475569' }}>{item.name} x {item.quantity}</span>
                       <span style={{ fontWeight: 700, color: '#1e293b' }}>₹{item.totalEstimated.toLocaleString()}</span>
                    </div>
                  ))}
                  {tender.items.length > 3 && <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>+ {tender.items.length - 3} more items</div>}
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                     <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>ESTIMATED TOTAL</div>
                     <div style={{ fontSize: '18px', fontWeight: 800, color: '#4f46e5' }}>₹{tender.items.reduce((a,b) => a + b.totalEstimated, 0).toLocaleString()}</div>
                  </div>
                  <button 
                    onClick={() => { setActiveDetailItem({...tender, type: 'tender'}); setShowDetailModal(true); }}
                    style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Manage Tender
                  </button>
               </div>
            </div>
          ))}
          {tenders.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '64px', background: 'white', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>No Tender Packages</h3>
              <p style={{ color: '#64748b' }}>Select items in the Planning tab to group them into tenders.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: POS */}
      {activeTab === 'pos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {purchaseOrders.map(po => (
            <div key={po.id} style={{ background: 'white', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>{po.poNumber}</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#f0fdf4', color: '#16a34a', textTransform: 'uppercase' }}>{po.status}</span>
               </div>
               <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }}>{po.supplier}</h3>
               <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>₹{po.totalAmount.toLocaleString()} • {po.items?.length || 0} items</div>
               <button 
                 onClick={() => { setActiveDetailItem({...po, type: 'po'}); setShowDetailModal(true); }}
                 style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 600, cursor: 'pointer' }}
               >
                 View Details
               </button>
            </div>
          ))}
        </div>
      )}

      {/* TENDER MODAL */}
      {showTenderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Bundle Tender Package</h2>
              <button onClick={() => setShowTenderModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleCreateTender} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Tender Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., Electronics & Sensors Batch"
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                  value={tenderForm.title}
                  onChange={(e) => setTenderForm({...tenderForm, title: e.target.value})}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Category / Vendor Type</label>
                <select 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                  value={tenderForm.category}
                  onChange={(e) => setTenderForm({...tenderForm, category: e.target.value})}
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Fasteners">Fasteners</option>
                  <option value="Services">Services</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '24px' }}>
                 <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>PACKAGING {selectedItems.length} ITEMS</div>
                 <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Bundle Estimation: ₹{planningData.filter(i => selectedItems.includes(i.id)).reduce((a,b) => a + b.totalAmount, 0).toLocaleString()}</div>
              </div>
              <button type="submit" style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}>Create Tender Package</button>
            </form>
          </div>
        </div>
      )}

      {/* PURCHASE ORDER MODAL */}
      {showPOModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Create Direct Purchase Order</h2>
              <button onClick={() => setShowPOModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleCreatePO} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Supplier Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., Electronics World Ltd."
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}
                  value={poForm.supplier}
                  onChange={(e) => setPoForm({...poForm, supplier: e.target.value})}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Remarks / Order Notes</label>
                <textarea 
                  placeholder="Additional instructions..."
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box', minHeight: '80px' }}
                  value={poForm.remarks}
                  onChange={(e) => setPoForm({...poForm, remarks: e.target.value})}
                />
              </div>
              <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '12px', marginBottom: '24px' }}>
                 <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>ORDERING {selectedItems.length} ITEMS</div>
                 <div style={{ fontSize: '11px', color: '#15803d' }}>Total PO Value: ₹{planningData.filter(i => selectedItems.includes(i.id)).reduce((a,b) => a + b.totalAmount, 0).toLocaleString()}</div>
              </div>
              <button type="submit" style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}>Finalize Purchase Order</button>
            </form>
          </div>
        </div>
      )}
      {/* TAB CONTENT: INHOUSE MFG */}
      {activeTab === 'inhouse_mfg' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {productionOrders.map(order => (
            <div key={order.id} style={{ background: 'white', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>{order.batchNumber}</span>
                  <span style={{ 
                    background: order.priority === 'Urgent' ? '#fef2f2' : '#eff6ff', 
                    color: order.priority === 'Urgent' ? '#dc2626' : '#2563eb', 
                    padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' 
                  }}>{order.priority} PRIORITY</span>
               </div>
               <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>{order.department}</h3>
               <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>{order.items?.length || 0} items for manufacturing</div>
               
               <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                  {order.items?.slice(0, 2).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                       <span style={{ color: '#475569' }}>{item.name} x {item.quantity}</span>
                    </div>
                  ))}
                  {order.items?.length > 2 && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>+ {order.items.length - 2} more items</div>}
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{order.status}</span>
                  <button 
                    onClick={() => { setActiveDetailItem({...order, type: 'mfg'}); setShowDetailModal(true); }}
                    style={{ background: 'white', color: '#1e293b', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    View Shop Order
                  </button>
               </div>
            </div>
          ))}
          {productionOrders.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '64px', background: 'white', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏭</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>No Inhouse Orders</h3>
              <p style={{ color: '#64748b' }}>Release items from the Inhouse Manufacturing planning tab to start production.</p>
            </div>
          )}
        </div>
      )}

      {/* UNIVERSAL DETAIL MODAL */}
      {showDetailModal && activeDetailItem && (
        <div className="modal-print-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px' }}>
          <style>
            {`
              @media print {
                body * { visibility: hidden; }
                .modal-print-container, .modal-print-container * { visibility: visible; }
                .modal-print-container { position: absolute; left: 0; top: 0; width: 100%; height: auto; background: white !important; backdrop-filter: none; }
                .no-print { display: none !important; }
                .modal-card { box-shadow: none !important; border: none !important; width: 100% !important; max-width: none !important; margin: 0 !important; }
              }
            `}
          </style>
          <div className="modal-card" style={{ background: 'white', borderRadius: '32px', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ padding: '32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  {activeDetailItem.type === 'tender' ? activeDetailItem.tenderId : activeDetailItem.type === 'po' ? activeDetailItem.poNumber : activeDetailItem.batchNumber}
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                  {activeDetailItem.type === 'tender' ? activeDetailItem.title : activeDetailItem.type === 'po' ? activeDetailItem.supplier : `${activeDetailItem.department} Production`}
                </h2>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <span style={{ background: '#eef2ff', color: '#4f46e5', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{activeDetailItem.status}</span>
                  {activeDetailItem.priority && <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{activeDetailItem.priority} PRIORITY</span>}
                </div>
              </div>
              <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxWidth: '350px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => exportDocument(activeDetailItem.type, activeDetailItem, 'excel')}
                  style={{ background: '#fff', color: '#16a34a', border: '1px solid #16a34a', padding: '8px 12px', borderRadius: '10px', fontWeight: 700, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  📊 EXCEL
                </button>
                <button 
                  onClick={() => exportDocument(activeDetailItem.type, activeDetailItem, 'doc')}
                  style={{ background: '#fff', color: '#2563eb', border: '1px solid #2563eb', padding: '8px 12px', borderRadius: '10px', fontWeight: 700, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  📝 DOC
                </button>
                <button 
                  onClick={() => exportDocument(activeDetailItem.type, activeDetailItem, 'pdf')}
                  style={{ background: '#0f172a', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '10px', fontWeight: 700, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  📄 PDF
                </button>
                <button onClick={() => setShowDetailModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', marginLeft: '8px' }}>✕</button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#475569', marginBottom: '16px', textTransform: 'uppercase' }}>Item Breakdown</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                    <th style={{ padding: '12px 0', fontSize: '11px', color: '#94a3b8' }}>ITEM DESCRIPTION</th>
                    <th style={{ padding: '12px 0', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>QTY</th>
                    <th style={{ padding: '12px 0', fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>UNIT PRICE</th>
                    <th style={{ padding: '12px 0', fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDetailItem.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '16px 0', fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{item.name}</td>
                      <td style={{ padding: '16px 0', textAlign: 'center', color: '#475569', fontWeight: 600 }}>{item.quantity}</td>
                      <td style={{ padding: '16px 0', textAlign: 'right', color: '#475569' }}>₹{(item.estimatedRate || item.unitPrice || item.baseRate || 0).toLocaleString()}</td>
                      <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>₹{(item.totalEstimated || item.totalPrice || (item.baseRate * item.quantity) || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {activeDetailItem.remarks && (
                <div style={{ marginTop: '32px', padding: '20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>Remarks & Notes</div>
                  <div style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>{activeDetailItem.remarks}</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>GRAND TOTAL VALUE</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
                    ₹{(activeDetailItem.totalAmount || activeDetailItem.items.reduce((a,b) => a + (b.totalEstimated || b.totalPrice || (b.baseRate * b.quantity) || 0), 0)).toLocaleString()}
                  </div>
               </div>
               <div style={{ display: 'flex', gap: '12px' }}>
                  <button style={{ padding: '12px 24px', borderRadius: '12px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                    {activeDetailItem.type === 'tender' ? 'Publish Tender' : activeDetailItem.type === 'po' ? 'Mark as Ordered' : 'Update Production Status'}
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementPage;
