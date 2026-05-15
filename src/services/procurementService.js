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
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const procurementService = {
  // Create new purchase order
  createPurchaseOrder: async (machineId, data) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const poNumber = `PO-${dateStr}-${randomCode}`;
    const timestamp = serverTimestamp();
    
    const payload = {
      machineId,
      poNumber,
      supplier: data.supplier || 'Unknown Supplier',
      items: data.items || [],
      totalAmount: Number(data.totalAmount) || 0,
      status: 'pending', // pending, ordered, received, cancelled
      orderDate: data.orderDate || timestamp,
      expectedDelivery: data.expectedDelivery || null,
      createdAt: timestamp,
      updatedAt: timestamp,
      remarks: data.remarks || '',
      created_by: 'admin',
      updated_by: 'admin'
    };
    
    return addDoc(collection(db, "procurement"), payload);
  },

  // Save estimations for components
  saveEstimations: async (machineId, estimations) => {
    const batch = writeBatch(db);
    const collectionRef = collection(db, "component_estimations");
    
    for (const est of estimations) {
      const q = query(collectionRef, where("machineId", "==", machineId), where("componentId", "==", est.componentId));
      const snapshot = await getDocs(q);
      
      const updateData = {
        updatedAt: serverTimestamp()
      };
      
      if (est.marketRate !== undefined) updateData.marketRate = Number(est.marketRate) || 0;
      if (est.bufferPercent !== undefined) updateData.bufferPercent = Number(est.bufferPercent) || 0;
      if (est.procurementMode !== undefined) updateData.procurementMode = est.procurementMode;

      if (!snapshot.empty) {
        batch.update(snapshot.docs[0].ref, updateData);
      } else {
        const newDoc = doc(collectionRef);
        batch.set(newDoc, {
          machineId,
          componentId: est.componentId,
          marketRate: updateData.marketRate || 0,
          bufferPercent: updateData.bufferPercent || 0,
          procurementMode: updateData.procurementMode || 'unassigned',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
    return batch.commit();
  },

  // Create Tender Package
  createTender: async (machineId, data) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const tenderId = `TND-${dateStr}-${randomCode}`;
    const timestamp = serverTimestamp();

    const payload = {
      machineId,
      tenderId,
      title: data.title || 'New Tender',
      category: data.category || 'General',
      items: data.items || [], // List of component IDs and estimated rates
      status: 'draft', // draft, published, closed
      createdAt: timestamp,
      updatedAt: timestamp,
      remarks: data.remarks || ''
    };

    return addDoc(collection(db, "tenders"), payload);
  },

  // Update purchase order
  updatePurchaseOrder: async (id, data) => {
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
      updated_by: 'admin'
    };
    return updateDoc(doc(db, "procurement", id), payload);
  },

  // Delete purchase order
  deletePurchaseOrder: async (id) => {
    return deleteDoc(doc(db, "procurement", id));
  }
};
