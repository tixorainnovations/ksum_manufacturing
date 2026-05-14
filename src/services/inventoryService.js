import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const inventoryService = {
  // ============================================================================
  // REACT UI MUTATIONS (Backwards Compatible)
  // ============================================================================
  
  // Create new inventory batch
  addIncomingBatch: async (machineId, data) => {
    // Generate structured inventory_code (e.g., RCV-20260506-4821)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    
    let prefix = 'INV';
    if (data.type === 'procured') prefix = 'RCV';
    else if (data.type === 'manufactured' || data.type === 'subassembly') prefix = 'FAB';
    else if (data.type === 'fastener') prefix = 'FST';
    else if (data.type === 'tool') prefix = 'TOL';

    const inventoryCode = `${prefix}-${dateStr}-${randomCode}`;
    const timestamp = serverTimestamp();
    
    // Explicitly structure the payload for future-proofing and Flutter compatibility
    const payload = {
      // Existing React UI mappings (DO NOT REMOVE)
      machineId,
      batchId: inventoryCode, // Keep mapping for backward compatibility if needed
      inventory_code: inventoryCode,
      componentId: data.componentId || '',
      name: data.name || '',
      type: data.type || '',
      quantity: Number(data.quantity) || 1,
      source: data.source || 'Vendor',
      details: data.details || '',
      status: 'incoming', 
      createdAt: timestamp,
      updatedAt: timestamp,
      
      // New strictly typed backend fields for Flutter/ERP standardization
      inventory_category: 'receiving_hub',
      lifecycle_stage: 'RECEIVING',
      qc_status: 'PENDING',
      supplier: data.source || 'Vendor',
      remarks: data.details || '',
      received_date: timestamp,
      manufactured_flag: data.type === 'manufactured' || data.type === 'subassembly',
      procured_flag: data.type === 'procured' || data.type === 'fastener' || data.type === 'tool',
      unit: 'pcs',
      
      // Future-proofing fields
      barcode: '',
      rack_location: '',
      bin_location: '',
      serial_number: '',
      traceability_reference: '',

      // Audit Trail
      created_by: 'operator',
      updated_by: 'operator',
      deleted_at: null
    };
    
    return addDoc(collection(db, "inventory"), payload);
  },

  // Update inventory item status/details
  updateInventoryItem: async (id, data) => {
    const payload = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    // Automatically sync backend lifecycle stage with frontend UI status
    if (data.status) {
      if (data.status === 'qc_pending') {
        payload.lifecycle_stage = 'QC_PENDING';
        payload.qc_status = 'PENDING';
      } else if (data.status === 'scrapped') {
        payload.lifecycle_stage = 'SCRAPPED';
      } else if (data.status === 'rejected') {
        payload.lifecycle_stage = 'QUARANTINE';
        payload.qc_status = 'FAILED';
      } else if (data.status === 'deleted') {
        payload.lifecycle_stage = 'DELETED';
        payload.deleted_at = serverTimestamp();
      }
    }

    payload.updated_by = 'operator';

    return updateDoc(doc(db, "inventory", id), payload);
  },

  // QC Pass/Fail
  processQC: async (id, qcData, passed) => {
    return updateDoc(doc(db, "inventory", id), {
      status: passed ? 'approved' : 'rejected',
      lifecycle_stage: passed ? 'QC_PASSED' : 'QUARANTINE',
      qc_status: passed ? 'PASSED' : 'FAILED',
      qc: {
        ...qcData,
        processedAt: new Date()
      },
      updatedAt: serverTimestamp()
    });
  },

  // Assign storage
  assignStorage: async (id, location, itemType) => {
    let newCategory = 'production_stock';
    if (itemType === 'fastener') newCategory = 'fastener_bay';
    if (itemType === 'manufactured') newCategory = 'fabrication_store';
    if (itemType === 'subassembly') newCategory = 'assembly_buffer';
    if (itemType === 'tool') newCategory = 'tool_management';

    return updateDoc(doc(db, "inventory", id), {
      status: 'stored',
      lifecycle_stage: 'PRODUCTION_STOCK',
      inventory_category: newCategory,
      location,
      rack_location: location.rack || '',
      bin_location: location.bin || '',
      updatedAt: serverTimestamp()
    });
  },

  // ============================================================================
  // FLUTTER / REST API EQUIVALENTS (Normalized JSON Responses)
  // ============================================================================
  
  // GET /inventory
  getAllInventory: async (filters = {}) => {
    let q = collection(db, "inventory");
    
    // Apply optional filters (used by Flutter/APIs)
    if (filters.machineId) q = query(q, where("machineId", "==", filters.machineId));
    if (filters.lifecycle_stage) q = query(q, where("lifecycle_stage", "==", filters.lifecycle_stage));
    if (filters.inventory_type) q = query(q, where("type", "==", filters.inventory_type));
    if (filters.qc_status) q = query(q, where("qc_status", "==", filters.qc_status));
    
    const snapshot = await getDocs(query(q, orderBy("createdAt", "desc")));
    return snapshot.docs.map(doc => ({ inventory_id: doc.id, ...doc.data() }));
  },

  // GET /inventory/:id
  getInventoryById: async (id) => {
    const docRef = doc(db, "inventory", id);
    const docSnap = await getDocs(query(collection(db, "inventory"), where("__name__", "==", id)));
    if (!docSnap.empty) {
      return { inventory_id: docSnap.docs[0].id, ...docSnap.docs[0].data() };
    }
    return null;
  },

  // POST /inventory (Handled by addIncomingBatch)
  
  // PATCH /inventory/status
  patchInventoryStatus: async (id, newLifecycleStage) => {
    return updateDoc(doc(db, "inventory", id), {
      lifecycle_stage: newLifecycleStage,
      updatedAt: serverTimestamp()
    });
  },

  // DELETE /inventory/:id (Soft Delete)
  deleteInventoryRecord: async (id) => {
    return updateDoc(doc(db, "inventory", id), {
      status: 'deleted',
      lifecycle_stage: 'DELETED',
      deleted_at: serverTimestamp(),
      updated_by: 'operator'
    });
  },

  // HARD DELETE /inventory/:id
  hardDeleteInventoryRecord: async (id) => {
    return deleteDoc(doc(db, "inventory", id));
  },

  // Create Assembly or Sub-Assembly from existing components
  createAssembly: async (machineId, data, type) => {
    // Deduct quantities
    for (const comp of data.components) {
       const itemSnap = await getDocs(query(collection(db, "inventory"), where("__name__", "==", comp.id)));
       if (!itemSnap.empty) {
          const currentQty = itemSnap.docs[0].data().quantity || 0;
          const newQty = Math.max(0, currentQty - comp.consumeQty);
          await updateDoc(doc(db, "inventory", comp.id), { quantity: newQty, updatedAt: serverTimestamp() });
       }
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const prefix = type === 'sub_assembly' ? 'SUB' : 'ASM';
    const inventoryCode = `${prefix}-${dateStr}-${randomCode}`;
    const timestamp = serverTimestamp();

    const payload = {
      machineId,
      batchId: inventoryCode,
      inventory_code: inventoryCode,
      name: data.name,
      type: type === 'sub_assembly' ? 'subassembly' : 'fullassembly',
      quantity: Number(data.quantity),
      source: 'Internal Assembly',
      details: `Assembled from ${data.components.length} components.`,
      status: 'stored',
      createdAt: timestamp,
      updatedAt: timestamp,
      inventory_category: type,
      lifecycle_stage: 'ASSEMBLY',
      qc_status: 'PASSED',
      unit: 'pcs',
      manufactured_flag: true,
      procured_flag: false,
      created_by: 'operator',
      updated_by: 'operator',
      deleted_at: null
    };

    return addDoc(collection(db, "inventory"), payload);
  }
};
