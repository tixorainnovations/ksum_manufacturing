import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import Papa from 'papaparse';
import { db } from '../firebase/config';
import { componentService } from '../services/componentService';
import { toolService } from '../services/toolService';
import { fastenerService } from '../services/fastenerService';
import ComponentMediaPanel from '../components/ComponentMediaPanel';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MFG_TYPES = ["milling", "lasercut", "3d_print", "acrylic_cut", "bending"];
const FASTENER_CATS = ["screw", "bolt", "nut", "washer", "spacer", "insert"];

const ComponentsPage = () => {
  const { machineId } = useParams();
  const [activeTab, setActiveTab] = useState('procured');
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  
  // Multi-step Upload State
  const [uploadStep, setUploadStep] = useState('select');
  const [previewData, setPreviewData] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Filters
  const [filter, setFilter] = useState('all');

  // Form States (Single Add)
  const [procuredForm, setProcuredForm] = useState({
    index: 1, category: '', name: '', description: '', quantity: 1, orderId: ''
  });
  const [mfgForm, setMfgForm] = useState({
    slNo: 1, parent: '', sub: '', drawingNo: '', name: '', quantity: 1, order: 1, manufacturingType: 'milling', material: ''
  });
  const [toolForm, setToolForm] = useState({
    index: 1, name: '', category: '', description: '', qty: 1, location: ''
  });
  const [fastenerForm, setFastenerForm] = useState({
    index: 1, category: 'screw', name: '', spec: '', material: '', qty: 1, location: ''
  });

  const [csvFile, setCsvFile] = useState(null);
  const [allComponents, setAllComponents] = useState([]);
  const [tools, setTools] = useState([]);
  const [fasteners, setFasteners] = useState([]);

  // Firestore Listener: 100% Stable Query
  useEffect(() => {
    if (!machineId) return;
    setLoading(true);

    const q = query(
      collection(db, "components"),
      where("machineId", "==", machineId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllComponents(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Listener Error:", error);
      setLoading(false);
    });

    const unsubscribeTools = onSnapshot(query(collection(db, "tools"), where("machineId", "==", machineId)), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTools(data.sort((a, b) => (Number(a.index) || 999) - (Number(b.index) || 999)));
    });

    const unsubscribeFasteners = onSnapshot(query(collection(db, "fasteners"), where("machineId", "==", machineId)), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFasteners(data.sort((a, b) => (Number(a.index) || 999) - (Number(b.index) || 999)));
    });

    return () => {
      unsubscribe();
      unsubscribeTools();
      unsubscribeFasteners();
    };
  }, [machineId]);

  // Derived State: Filter and Sort components locally
  const components = React.useMemo(() => {
    if (activeTab === 'tools') {
      let filtered = tools;
      if (filter !== 'all') {
         filtered = filtered.filter(item => item.category?.toLowerCase() === filter.toLowerCase());
      }
      return [...filtered].sort((a, b) => (Number(a.index) || 999) - (Number(b.index) || 999));
    }
    
    if (activeTab === 'fasteners') {
      let filtered = fasteners;
      if (filter !== 'all') {
         filtered = filtered.filter(item => item.category?.toLowerCase() === filter.toLowerCase());
      }
      return [...filtered].sort((a, b) => (Number(a.index) || 999) - (Number(b.index) || 999));
    }

    let filtered = allComponents.filter(item => item.componentType === activeTab);
    
    if (filter !== 'all') {
      if (activeTab === 'procured') {
        filtered = filtered.filter(item => item.category?.toLowerCase() === filter.toLowerCase());
      } else {
        filtered = filtered.filter(item => item.manufacturingType === filter);
      }
    }

    if (activeTab === 'manufactured') {
      return [...filtered].sort((a, b) => (Number(a.slNo) || 999) - (Number(b.slNo) || 999));
    } else {
      return [...filtered].sort((a, b) => (Number(a.index) || 999) - (Number(b.index) || 999));
    }
  }, [allComponents, tools, fasteners, activeTab, filter]);

  // Dynamic Categories for Filter
  const dynamicCategories = React.useMemo(() => {
    if (activeTab === 'fasteners') return FASTENER_CATS;
    const cats = new Set();
    if (activeTab === 'tools') {
      tools.forEach(item => { if (item.category) cats.add(item.category); });
    } else {
      allComponents.filter(item => item.componentType === 'procured').forEach(item => {
        if (item.category) cats.add(item.category);
      });
    }
    return Array.from(cats);
  }, [allComponents, tools, activeTab]);

  // Validation Logics
  const validateMfgRow = (row) => {
    const errors = [];
    if (!row.name?.toString().trim()) errors.push("Missing Name");
    if (!row.drawingNo?.toString().trim()) errors.push("Missing Drawing #");
    if (!MFG_TYPES.includes(row.manufacturingType)) errors.push("Invalid Type");
    return errors;
  };

  const validateProcuredRow = (row) => {
    const errors = [];
    if (!row.name || row.name.toString().trim() === "") errors.push("Missing Name");
    if (!row.category || row.category.toString().trim() === "") errors.push("Missing Category");
    if (!row.quantity || isNaN(Number(row.quantity)) || Number(row.quantity) <= 0) errors.push("Invalid Quantity");
    if (!row.index || isNaN(Number(row.index))) errors.push("Invalid Index");
    return errors;
  };

  const validateToolRow = (row) => {
    const errors = [];
    if (!row.name || row.name.toString().trim() === "") errors.push("Missing Name");
    if (!row.qty || isNaN(Number(row.qty)) || Number(row.qty) <= 0) errors.push("Invalid Quantity");
    if (!row.index || isNaN(Number(row.index))) errors.push("Invalid Index");
    return errors;
  };

  const validateFastenerRow = (row) => {
    const errors = [];
    if (!row.name || row.name.toString().trim() === "") errors.push("Missing Name");
    if (!row.category || row.category.toString().trim() === "") errors.push("Missing Category");
    if (!row.qty || isNaN(Number(row.qty)) || Number(row.qty) <= 0) errors.push("Invalid Quantity");
    if (!row.index || isNaN(Number(row.index))) errors.push("Invalid Index");
    return errors;
  };

  const formatCategory = (cat) => {
    if (!cat) return "";
    return cat.toString().trim().toLowerCase().replace(/^\w/, c => c.toUpperCase());
  };

  const normalizeHeader = (header) => header.toLowerCase().trim().replace(/[\s._/-]/g, "");

  const handleDownloadPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text(`Component List - ${activeTab.toUpperCase()}`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    let head = [];
    let body = [];

    if (activeTab === 'procured') {
      head = [['SL', 'Order ID', 'Category', 'Item Name', 'Description', 'Qty/P']];
      body = components.map((item, idx) => [
        idx + 1,
        item.orderId || '-',
        item.category || '-',
        item.name || '-',
        item.description || '-',
        item.quantity || 0
      ]);
    } else if (activeTab === 'tools') {
      head = [['SL', 'Category', 'Name', 'Description', 'Qty', 'Location']];
      body = components.map((item, idx) => [
        idx + 1,
        item.category || '-',
        item.name || '-',
        item.description || '-',
        item.qty || 0,
        item.location || '-'
      ]);
    } else if (activeTab === 'fasteners') {
      head = [['SL', 'Category', 'Name', 'Specification', 'Material', 'Qty', 'Location']];
      body = components.map((item, idx) => [
        idx + 1,
        item.category || '-',
        item.name || '-',
        item.spec || '-',
        item.material || '-',
        item.qty || 0,
        item.location || '-'
      ]);
    } else {
      head = [['SL', 'Parent', 'Sub', 'Drawing No', 'Name', 'Qty', 'Order', 'MFG Type', 'Material']];
      body = components.map((item, idx) => [
        idx + 1,
        item.parent || '-',
        item.sub || '-',
        item.drawingNo || '-',
        item.name || '-',
        item.quantity || 0,
        item.order || 1,
        item.manufacturingType || '-',
        item.material || '-'
      ]);
    }

    autoTable(doc, {
      startY: 36,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [67, 56, 202] }
    });

    doc.save(`${activeTab}_components.pdf`);
  };

  const handleProcessCSV = () => {
    if (!csvFile) return;

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map((rawRow, idx) => {
          console.log("RAW:", rawRow);
          
          if (activeTab === 'procured') {
            const mapped = {};
            Object.keys(rawRow).forEach((key) => {
              const normalized = normalizeHeader(key);
              if (normalized === "index") mapped.index = rawRow[key];
              if (normalized === "category" || normalized === "catagory") mapped.category = rawRow[key];
              if (normalized === "name" || normalized === "item") mapped.name = rawRow[key];
              if (normalized === "description") mapped.description = rawRow[key];
              if (normalized === "qty" || normalized === "quantity" || normalized === "qtyp") mapped.qty = rawRow[key];
              if (normalized === "orderid") mapped.orderId = rawRow[key];
            });


            console.log("MAPPED:", mapped);

            const finalRow = {
              index: Number(mapped.index) || idx + 1,
              category: formatCategory(mapped.category),
              name: mapped.name?.toString().trim() || "",
              description: mapped.description?.toString().trim() || "",
              quantity: Number(mapped.qty) || 0,
              orderId: mapped.orderId?.toString().trim() || "",
            };

            const errors = validateProcuredRow(finalRow);
            return { ...finalRow, tempId: idx, isValid: errors.length === 0, errors };
          } else if (activeTab === 'tools') {
            const mapped = {};
            Object.keys(rawRow).forEach((key) => {
              const normalized = normalizeHeader(key);
              if (normalized === "index") mapped.index = rawRow[key];
              if (normalized === "category" || normalized === "catagory") mapped.category = rawRow[key];
              if (normalized === "name") mapped.name = rawRow[key];
              if (normalized === "description") mapped.description = rawRow[key];
              if (normalized === "qty" || normalized === "quantity") mapped.qty = rawRow[key];
              if (normalized === "location") mapped.location = rawRow[key];
            });

            const finalRow = {
              index: Number(mapped.index) || idx + 1,
              category: formatCategory(mapped.category),
              name: mapped.name?.toString().trim() || "",
              description: mapped.description?.toString().trim() || "",
              qty: Number(mapped.qty) || 1,
              location: mapped.location?.toString().trim() || "",
            };

            const errors = validateToolRow(finalRow);
            return { ...finalRow, tempId: idx, isValid: errors.length === 0, errors };
          } else if (activeTab === 'fasteners') {
            const mapped = {};
            Object.keys(rawRow).forEach((key) => {
              const normalized = normalizeHeader(key);
              if (normalized === "index") mapped.index = rawRow[key];
              if (normalized === "category" || normalized === "catagory") mapped.category = rawRow[key];
              if (normalized === "name") mapped.name = rawRow[key];
              if (normalized === "specification" || normalized === "spec") mapped.spec = rawRow[key];
              if (normalized === "material") mapped.material = rawRow[key];
              if (normalized === "qty" || normalized === "quantity") mapped.qty = rawRow[key];
              if (normalized === "location") mapped.location = rawRow[key];
            });

            const finalRow = {
              index: Number(mapped.index) || idx + 1,
              category: mapped.category?.toString().trim().toLowerCase() || "screw",
              name: mapped.name?.toString().trim() || "",
              spec: mapped.spec?.toString().trim() || "",
              material: mapped.material?.toString().trim() || "",
              qty: Number(mapped.qty) || 1,
              location: mapped.location?.toString().trim() || "",
            };

            const errors = validateFastenerRow(finalRow);
            return { ...finalRow, tempId: idx, isValid: errors.length === 0, errors };
          } else {
            // Manufactured Mapping
            const mapped = {};
            Object.keys(rawRow).forEach(key => {
              const normalized = normalizeHeader(key);
              if (normalized === "slno" || normalized === "sl") mapped.slNo = rawRow[key];
              if (normalized === "parent") mapped.parent = rawRow[key];
              if (normalized === "sub") mapped.sub = rawRow[key];
              if (normalized === "dwgno" || normalized === "drawingno") mapped.drawingNo = rawRow[key];
              if (normalized === "name") mapped.name = rawRow[key];
              if (normalized === "qty" || normalized === "quantity") mapped.quantity = rawRow[key];
              if (normalized === "order") mapped.order = rawRow[key];
              if (normalized === "manufacturingtype" || normalized === "mfgtype") mapped.mfgType = rawRow[key];
              if (normalized === "material") mapped.material = rawRow[key];
            });

            if (!mapped.drawingNo) {
              Object.keys(rawRow).forEach(key => {
                if (key.toLowerCase().includes("dwg") || key.toLowerCase().includes("drawing")) mapped.drawingNo = rawRow[key];
              });
            }

            const finalRow = {
              slNo: Number(mapped.slNo) || idx + 1,
              parent: mapped.parent?.toString().trim() || '',
              sub: mapped.sub?.toString().trim() || '',
              drawingNo: mapped.drawingNo?.toString().trim() || '',
              name: mapped.name?.toString().trim() || '',
              quantity: Number(mapped.quantity) || 1,
              order: Number(mapped.order) || 1,
              manufacturingType: mapped.mfgType?.toString().trim().toLowerCase().replace(/\s+/g, '_') || 'milling',
              material: mapped.material?.toString().trim() || ''
            };

            const errors = validateMfgRow(finalRow);
            return { ...finalRow, tempId: idx, isValid: errors.length === 0, errors };
          }
        });

        setPreviewData(parsed);
        setUploadStep('preview');
      }
    });
  };

  const handleConfirmUpload = async () => {
    const validData = previewData.filter(row => row.isValid);
    if (validData.length === 0) return;
    
    setIsUploading(true);
    try {
      const uploadData = validData.map(({ tempId, isValid, errors, ...rest }) => rest);
      if (activeTab === 'tools') {
         await Promise.all(uploadData.map(data => toolService.create({ ...data, machineId, createdAt: new Date() })));
      } else if (activeTab === 'fasteners') {
         await fastenerService.createBulk(uploadData.map(d => ({ ...d, machineId })));
      } else {
         await componentService.bulkCreate(machineId, activeTab, uploadData);
      }
      setShowUploadModal(false);
      setUploadStep('select');
      setPreviewData([]);
    } catch (error) {
      alert("Upload failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const updatePreviewRow = (index, field, value) => {
    const updated = [...previewData];
    updated[index][field] = value;
    
    if (['quantity', 'index', 'slNo', 'order'].includes(field)) {
      updated[index][field] = Number(value);
    }

    if (field === 'category' && (activeTab === 'procured' || activeTab === 'tools')) {
      updated[index][field] = formatCategory(value);
    }
    if (field === 'category' && activeTab === 'fasteners') {
      updated[index][field] = value.toString().toLowerCase();
    }

    let errors = [];
    if (activeTab === 'procured') errors = validateProcuredRow(updated[index]);
    else if (activeTab === 'tools') errors = validateToolRow(updated[index]);
    else if (activeTab === 'fasteners') errors = validateFastenerRow(updated[index]);
    else errors = validateMfgRow(updated[index]);

    updated[index].isValid = errors.length === 0;
    updated[index].errors = errors;
    setPreviewData(updated);
  };

  const deletePreviewRow = (index) => {
    setPreviewData(previewData.filter((_, i) => i !== index));
  };

  const handleDownloadTemplate = () => {
    let content = "";
    if (activeTab === 'procured') {
      content = "Order ID,Category,Item,Description,Qty/P\nORD-001,Electronics,Motor Driver,High torque driver,2";
    } else if (activeTab === 'tools') {
      content = "Index,Category,Name,Description,Qty,Location\n1,Mechanical,Allen Key Set,Metric set 1.5mm–10mm,2,Tool Rack A";
    } else if (activeTab === 'fasteners') {
      content = "Index,Category,Name,Specification,Material,Qty,Location\n1,Screw,M3 Socket Head Screw,M3 x 10mm,SS304,20,Bin A1\n2,Nut,M3 Hex Nut,M3,SS304,20,Bin A1";
    } else {
      content = "slNo,parent,sub,drawingNo,name,quantity,order,manufacturingType,material\n1,Base,Bed,P01,Plate,1,1,milling,mdf";
    }
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}_template.csv`;
    a.click();
  };

  const stats = {
    total: previewData.length,
    valid: previewData.filter(r => r.isValid).length,
    invalid: previewData.filter(r => !r.isValid).length
  };

  const MediaThumbnail = ({ item, tab }) => {
    const primaryImage = item.images?.find(i => i.isPrimary) || item.images?.[0];
    if (primaryImage) {
      return <img src={primaryImage.url} alt={item.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />;
    }
    const icon = tab === 'tools' ? '🧰' : tab === 'fasteners' ? '🔩' : tab === 'manufactured' ? '⚙️' : '📦';
    return (
      <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
        {icon}
      </div>
    );
  };

  const MediaStatus = ({ item }) => {
    const imgCount = item.images?.length || 0;
    const fileCount = item.files?.length || 0;
    if (imgCount === 0 && fileCount === 0) return <span className="text-xs text-light" style={{ fontStyle: 'italic' }}>No Media</span>;
    return (
      <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
        {imgCount > 0 && <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 4px', background: '#f1f5f9', color: '#475569' }}>{imgCount} Img</span>}
        {fileCount > 0 && <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 4px', background: '#e0e7ff', color: '#4338ca' }}>{fileCount} File</span>}
      </div>
    );
  };

  return (
    <div className="selection-container">
      {/* Header & Tabs */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Components</h1>
          <div className="tabs">
            <button className={`tab-btn ${activeTab === 'procured' ? 'active' : ''}`} onClick={() => { setActiveTab('procured'); setFilter('all'); }}>📦 Procured</button>
            <button className={`tab-btn ${activeTab === 'manufactured' ? 'active' : ''}`} onClick={() => { setActiveTab('manufactured'); setFilter('all'); }}>🛠️ Manufactured</button>
            <button className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => { setActiveTab('tools'); setFilter('all'); }}>🧰 Tools</button>
            <button className={`tab-btn ${activeTab === 'fasteners' ? 'active' : ''}`} onClick={() => { setActiveTab('fasteners'); setFilter('all'); }}>🔩 Fasteners</button>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <select className="form-input" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All {activeTab === 'manufactured' ? 'MFG Types' : 'Categories'}</option>
            {(activeTab === 'manufactured' ? MFG_TYPES : dynamicCategories).map(opt => (
              <option key={opt} value={opt}>{formatCategory(opt)}</option>
            ))}
          </select>
          <button className="btn btn-outline" onClick={handleDownloadPDF}>📄 Download PDF</button>
          <button className="btn btn-outline" onClick={() => { setUploadStep('select'); setShowUploadModal(true); }}>📤 Upload CSV</button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add {activeTab === 'procured' ? 'Item' : activeTab === 'tools' ? 'Tool' : activeTab === 'fasteners' ? 'Fastener' : 'Part'}</button>
        </div>
      </div>

      {/* Main List */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '60px 0' }}><div className="spinner"></div></div>
        ) : components.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                {activeTab === 'procured' ? (
                  <tr><th>Media</th><th>SL</th><th>Order ID</th><th>Category</th><th>Item</th><th>Description</th><th>Qty/P</th><th>Status</th><th>Actions</th></tr>
                ) : activeTab === 'tools' ? (
                  <tr><th>Media</th><th>SL</th><th>Category</th><th>Name</th><th>Description</th><th>Qty</th><th>Location</th><th>Status</th><th>Actions</th></tr>
                ) : activeTab === 'fasteners' ? (
                  <tr><th>Media</th><th>SL</th><th>Category</th><th>Name</th><th>Specification</th><th>Material</th><th>Qty</th><th>Location</th><th>Status</th><th>Actions</th></tr>
                ) : (
                  <tr><th>Media</th><th>SL</th><th>Hierarchy</th><th>Drawing / Name</th><th>Qty / Order</th><th>MFG Type</th><th>Material</th><th>Status</th><th>Actions</th></tr>
                )}
              </thead>
              <tbody>
                {components.map((item, index) => (
                  <tr key={item.id}>
                    <td><MediaThumbnail item={item} tab={activeTab} /></td>
                    {activeTab === 'procured' ? (
                      <>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{index + 1}</td>
                        <td className="text-sm">{item.orderId || '-'}</td>
                        <td><span className={`badge badge-${item.category?.toLowerCase() || 'default'}`}>{item.category}</span></td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td className="text-sm text-light">{item.description}</td>
                        <td style={{ fontWeight: 500 }}>{item.quantity}</td>
                      </>
                    ) : activeTab === 'tools' ? (
                      <>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{index + 1}</td>
                        <td><span className={`badge badge-${item.category?.toLowerCase() || 'default'}`}>{item.category}</span></td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td className="text-sm text-light">{item.description}</td>
                        <td style={{ fontWeight: 500 }}>{item.qty}</td>
                        <td className="text-sm">{item.location || '-'}</td>
                      </>
                    ) : activeTab === 'fasteners' ? (
                      <>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{index + 1}</td>
                        <td><span className={`badge`} style={{ background: '#f1f5f9', color: '#475569', textTransform: 'capitalize' }}>{item.category}</span></td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td className="text-sm">{item.spec || '-'}</td>
                        <td className="text-sm">{item.material || '-'}</td>
                        <td style={{ fontWeight: 500 }}>{item.qty}</td>
                        <td className="text-sm">{item.location || '-'}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{index + 1}</td>
                        <td><div style={{ fontWeight: 600 }}>{item.parent}</div><div className="text-sm text-light">↳ {item.sub}</div></td>
                        <td><div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>{item.drawingNo}</div><div>{item.name}</div></td>
                        <td><div>{item.quantity}</div><div className="text-sm text-light">Ord: {item.order}</div></td>
                        <td><span className={`badge badge-${item.manufacturingType}`}>{item.manufacturingType}</span></td>
                        <td>{item.material}</td>
                      </>
                    )}
                    <td><MediaStatus item={item} /></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-outline text-xs" style={{ padding: '0.25rem 0.5rem', borderColor: '#cbd5e1', color: '#475569' }} onClick={() => {
                          setSelectedComponent(item);
                          setShowMediaPanel(true);
                        }}>✏️ Edit</button>
                        <button className="action-btn" onClick={() => {
                          if (activeTab === 'tools') toolService.delete(item.id);
                          else if (activeTab === 'fasteners') fastenerService.delete(item.id);
                          else componentService.delete(item.id);
                        }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
             <div style={{ fontSize: '3rem' }}>{activeTab === 'procured' ? '📦' : activeTab === 'tools' ? '🧰' : activeTab === 'fasteners' ? '🔩' : '⚙️'}</div>
             <h3>No {activeTab} components found</h3>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className={`modal-content ${uploadStep === 'preview' ? 'full' : 'large'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2>Bulk Upload {activeTab === 'procured' ? 'Procured Items' : activeTab === 'tools' ? 'Tools' : activeTab === 'fasteners' ? 'Fasteners' : 'Manufactured Parts'}</h2>
              {uploadStep === 'preview' && (
                <div className="preview-summary">
                  <div className="summary-item"><span className="summary-label">Total</span><span className="summary-value">{stats.total}</span></div>
                  <div className="summary-item"><span className="summary-label" style={{ color: '#10b981' }}>Valid</span><span className="summary-value" style={{ color: '#10b981' }}>{stats.valid}</span></div>
                  <div className="summary-item"><span className="summary-label" style={{ color: '#f43f5e' }}>Invalid</span><span className="summary-value" style={{ color: '#f43f5e' }}>{stats.invalid}</span></div>
                </div>
              )}
            </div>

            {uploadStep === 'select' ? (
              <div style={{ padding: '2rem 0' }}>
                <p className="text-sm text-light mb-6">Upload CSV. Categories will be automatically read from your file.</p>
                <input type="file" accept=".csv" className="form-input mb-6" onChange={e => setCsvFile(e.target.files[0])} />
                <div className="flex gap-3">
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleProcessCSV} disabled={!csvFile}>Process CSV</button>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleDownloadTemplate}>Template</button>
                  <button className="btn btn-text" onClick={() => setShowUploadModal(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="table-container mb-6">
                  <table>
                    <thead>
                      {activeTab === 'procured' ? (
                        <tr><th>Index</th><th>Order ID</th><th>Category</th><th>Item</th><th>Description</th><th>Qty/P</th><th>Actions</th></tr>
                      ) : activeTab === 'tools' ? (
                        <tr><th>Index</th><th>Category</th><th>Name</th><th>Description</th><th>Qty</th><th>Location</th><th>Actions</th></tr>
                      ) : activeTab === 'fasteners' ? (
                        <tr><th>Index</th><th>Category</th><th>Name</th><th>Specification</th><th>Material</th><th>Qty</th><th>Location</th><th>Actions</th></tr>
                      ) : (
                        <tr><th>Sl</th><th>Parent</th><th>Sub</th><th>Dwg No</th><th>Name</th><th>Qty</th><th>Order</th><th>Type</th><th>Mat</th><th>Actions</th></tr>
                      )}
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={row.tempId} className={!row.isValid ? 'row-invalid' : ''}>
                          {activeTab === 'procured' ? (
                            <>
                              <td><input className="inline-edit-input" type="number" value={row.index} onChange={e => updatePreviewRow(idx, 'index', e.target.value)} /></td>
                              <td><input className="inline-edit-input" value={row.orderId} onChange={e => updatePreviewRow(idx, 'orderId', e.target.value)} /></td>
                              <td>
                                <input 
                                  className={`inline-edit-input ${row.errors?.includes("Missing Category") ? 'input-error' : ''}`}
                                  value={row.category || ""} 
                                  onChange={e => updatePreviewRow(idx, 'category', e.target.value)}
                                  placeholder="Category"
                                />
                                {row.errors?.includes("Missing Category") && <div className="error-msg">Required</div>}
                              </td>
                              <td>
                                <input className={`inline-edit-input ${row.errors?.includes("Missing Name") ? 'input-error' : ''}`} value={row.name} onChange={e => updatePreviewRow(idx, 'name', e.target.value)} />
                                {row.errors?.length > 0 && <div className="error-msg">{row.errors.join(", ")}</div>}
                              </td>
                              <td><input className="inline-edit-input" value={row.description} onChange={e => updatePreviewRow(idx, 'description', e.target.value)} /></td>
                              <td><input className="inline-edit-input" type="number" value={row.quantity} onChange={e => updatePreviewRow(idx, 'quantity', e.target.value)} />{Number(row.quantity) <= 0 && <div className="error-msg">Invalid Qty</div>}</td>
                            </>
                          ) : activeTab === 'tools' ? (
                            <>
                              <td><input className="inline-edit-input" type="number" value={row.index} onChange={e => updatePreviewRow(idx, 'index', e.target.value)} /></td>
                              <td>
                                <input 
                                  className="inline-edit-input"
                                  value={row.category || ""} 
                                  onChange={e => updatePreviewRow(idx, 'category', e.target.value)}
                                  placeholder="Category"
                                />
                              </td>
                              <td>
                                <input className={`inline-edit-input ${row.errors?.includes("Missing Name") ? 'input-error' : ''}`} value={row.name} onChange={e => updatePreviewRow(idx, 'name', e.target.value)} />
                                {row.errors?.length > 0 && <div className="error-msg">{row.errors.join(", ")}</div>}
                              </td>
                              <td><input className="inline-edit-input" value={row.description} onChange={e => updatePreviewRow(idx, 'description', e.target.value)} /></td>
                              <td><input className="inline-edit-input" type="number" value={row.qty} onChange={e => updatePreviewRow(idx, 'qty', e.target.value)} />{Number(row.qty) <= 0 && <div className="error-msg">Invalid Qty</div>}</td>
                              <td><input className="inline-edit-input" value={row.location} onChange={e => updatePreviewRow(idx, 'location', e.target.value)} /></td>
                            </>
                          ) : activeTab === 'fasteners' ? (
                            <>
                              <td><input className="inline-edit-input" type="number" value={row.index} onChange={e => updatePreviewRow(idx, 'index', e.target.value)} /></td>
                              <td>
                                <select className="inline-edit-input" value={row.category || "screw"} onChange={e => updatePreviewRow(idx, 'category', e.target.value)}>
                                  {FASTENER_CATS.map(cat => <option key={cat} value={cat}>{formatCategory(cat)}</option>)}
                                </select>
                              </td>
                              <td>
                                <input className={`inline-edit-input ${row.errors?.includes("Missing Name") ? 'input-error' : ''}`} value={row.name} onChange={e => updatePreviewRow(idx, 'name', e.target.value)} />
                                {row.errors?.length > 0 && <div className="error-msg">{row.errors.join(", ")}</div>}
                              </td>
                              <td><input className="inline-edit-input" value={row.spec} onChange={e => updatePreviewRow(idx, 'spec', e.target.value)} /></td>
                              <td><input className="inline-edit-input" value={row.material} onChange={e => updatePreviewRow(idx, 'material', e.target.value)} /></td>
                              <td><input className="inline-edit-input" type="number" value={row.qty} onChange={e => updatePreviewRow(idx, 'qty', e.target.value)} />{Number(row.qty) <= 0 && <div className="error-msg">Invalid Qty</div>}</td>
                              <td><input className="inline-edit-input" value={row.location} onChange={e => updatePreviewRow(idx, 'location', e.target.value)} /></td>
                            </>
                          ) : (
                            <>
                              <td><input className="inline-edit-input" type="number" value={row.slNo} onChange={e => updatePreviewRow(idx, 'slNo', e.target.value)} /></td>
                              <td><input className="inline-edit-input" value={row.parent} onChange={e => updatePreviewRow(idx, 'parent', e.target.value)} /></td>
                              <td><input className="inline-edit-input" value={row.sub} onChange={e => updatePreviewRow(idx, 'sub', e.target.value)} /></td>
                              <td><input className="inline-edit-input" value={row.drawingNo} onChange={e => updatePreviewRow(idx, 'drawingNo', e.target.value)} />{!row.drawingNo && <div className="error-msg">Req</div>}</td>
                              <td><input className="inline-edit-input" value={row.name} onChange={e => updatePreviewRow(idx, 'name', e.target.value)} />{!row.name && <div className="error-msg">Req</div>}</td>
                              <td><input className="inline-edit-input" type="number" value={row.quantity} onChange={e => updatePreviewRow(idx, 'quantity', e.target.value)} /></td>
                              <td><input className="inline-edit-input" type="number" value={row.order} onChange={e => updatePreviewRow(idx, 'order', e.target.value)} /></td>
                              <td><select className="inline-edit-input" value={row.manufacturingType} onChange={e => updatePreviewRow(idx, 'manufacturingType', e.target.value)}>{MFG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                              <td><input className="inline-edit-input" value={row.material} onChange={e => updatePreviewRow(idx, 'material', e.target.value)} /></td>
                            </>
                          )}
                          <td><button className="action-btn" onClick={() => deletePreviewRow(idx)}>🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-3 sticky-bottom" style={{ position: 'sticky', bottom: 0, background: 'white', padding: '1rem 0', borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-outline" onClick={() => setUploadStep('select')}>Back</button>
                  <button className="btn btn-primary" onClick={handleConfirmUpload} disabled={stats.valid === 0 || isUploading}>
                    {isUploading ? 'Uploading...' : `Confirm & Upload ${stats.valid} items`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className={`modal-content ${activeTab === 'manufactured' ? 'xl' : 'large'}`} onClick={e => e.stopPropagation()}>
             <h2 className="mb-6">Add {activeTab}</h2>
             <form onSubmit={async (e) => {
                e.preventDefault();
                let data = activeTab === 'procured' ? procuredForm : activeTab === 'tools' ? toolForm : activeTab === 'fasteners' ? fastenerForm : mfgForm;
                if (activeTab === 'procured' || activeTab === 'tools') {
                  data = { ...data, category: formatCategory(data.category) };
                  if (activeTab === 'procured' && !data.category) return alert("Please enter a category");
                }
                try {
                  if (activeTab === 'tools') {
                    await toolService.create({ ...data, machineId, createdAt: new Date() });
                    setToolForm({ index: 1, name: '', category: '', description: '', qty: 1, location: '' });
                  } else if (activeTab === 'fasteners') {
                    await fastenerService.create({ ...data, machineId, createdAt: new Date() });
                    setFastenerForm({ index: 1, category: 'screw', name: '', spec: '', material: '', qty: 1, location: '' });
                  } else {
                    await componentService.create(machineId, activeTab, data);
                    if (activeTab === 'procured') setProcuredForm({ index: 1, category: '', name: '', description: '', quantity: 1, orderId: '' });
                  }
                  setShowAddModal(false);
                } catch (err) { alert(err.message); }
              }}>
               {activeTab === 'procured' ? (
                 <div className="grid grid-cols-2" style={{ gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label">Order ID</label>
                      <input className="form-input" value={procuredForm.orderId} onChange={e => setProcuredForm({...procuredForm, orderId: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category *</label>
                      <input 
                        className="form-input" 
                        required 
                        value={procuredForm.category} 
                        onChange={e => setProcuredForm({...procuredForm, category: e.target.value})} 
                        placeholder="e.g. Electronics"
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Item Name *</label>
                      <input className="form-input" required value={procuredForm.name} onChange={e => setProcuredForm({...procuredForm, name: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input className="form-input" value={procuredForm.description} onChange={e => setProcuredForm({...procuredForm, description: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Quantity *</label>
                      <input type="number" className="form-input" required value={procuredForm.quantity} onChange={e => setProcuredForm({...procuredForm, quantity: e.target.value})} />
                    </div>
                 </div>
               ) : activeTab === 'tools' ? (
                 <div className="grid grid-cols-2" style={{ gap: '1.25rem' }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Tool Name *</label>
                      <input className="form-input" required value={toolForm.name} onChange={e => setToolForm({...toolForm, name: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <input className="form-input" value={toolForm.category} onChange={e => setToolForm({...toolForm, category: e.target.value})} placeholder="e.g. Mechanical" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Quantity *</label>
                      <input type="number" className="form-input" required value={toolForm.qty} onChange={e => setToolForm({...toolForm, qty: e.target.value})} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Description</label>
                      <input className="form-input" value={toolForm.description} onChange={e => setToolForm({...toolForm, description: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Location</label>
                      <input className="form-input" value={toolForm.location} onChange={e => setToolForm({...toolForm, location: e.target.value})} placeholder="e.g. Tool Rack A" />
                    </div>
                 </div>
               ) : activeTab === 'fasteners' ? (
                 <div className="grid grid-cols-2" style={{ gap: '1.25rem' }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Fastener Name *</label>
                      <input className="form-input" required value={fastenerForm.name} onChange={e => setFastenerForm({...fastenerForm, name: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category *</label>
                      <select className="form-input" required value={fastenerForm.category} onChange={e => setFastenerForm({...fastenerForm, category: e.target.value})}>
                        {FASTENER_CATS.map(cat => <option key={cat} value={cat}>{formatCategory(cat)}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Specification</label>
                      <input className="form-input" value={fastenerForm.spec} onChange={e => setFastenerForm({...fastenerForm, spec: e.target.value})} placeholder="e.g. M3 x 10mm" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Material</label>
                      <input className="form-input" value={fastenerForm.material} onChange={e => setFastenerForm({...fastenerForm, material: e.target.value})} placeholder="e.g. SS304" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Quantity *</label>
                      <input type="number" className="form-input" required value={fastenerForm.qty} onChange={e => setFastenerForm({...fastenerForm, qty: e.target.value})} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Location</label>
                      <input className="form-input" value={fastenerForm.location} onChange={e => setFastenerForm({...fastenerForm, location: e.target.value})} placeholder="e.g. Bin A1" />
                    </div>
                 </div>
               ) : (
                  <div className="grid grid-cols-3" style={{ gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label">Drawing No *</label>
                      <input className="form-input" required value={mfgForm.drawingNo} onChange={e => setMfgForm({...mfgForm, drawingNo: e.target.value})} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Part Name *</label>
                      <input className="form-input" required value={mfgForm.name} onChange={e => setMfgForm({...mfgForm, name: e.target.value})} />
                    </div>
                  </div>
               )}
               <div className="flex gap-2 mt-8">
                 <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
                 <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save</button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* Media Management Panel */}
      {showMediaPanel && (
        <ComponentMediaPanel 
          component={components.find(c => c.id === selectedComponent?.id) || selectedComponent} 
          collectionName={activeTab === 'tools' ? 'tools' : activeTab === 'fasteners' ? 'fasteners' : 'components'}
          onClose={() => {
            setShowMediaPanel(false);
            setSelectedComponent(null);
          }} 
        />
      )}
    </div>
  );
};

export default ComponentsPage;
