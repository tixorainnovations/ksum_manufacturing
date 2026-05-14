import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const logService = {
  logActivity: async (machineId, action, entity, details = "") => {
    try {
      await addDoc(collection(db, "activityLogs"), {
        machineId,
        action, // e.g., "Created", "Updated", "Deleted"
        entity, // e.g., "Component", "Process Flow", "QC"
        details,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  }
};
