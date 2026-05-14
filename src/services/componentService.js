import {
    collection,
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    query,
    where,
    orderBy,
    writeBatch,
    serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase/config";

const COLLECTION_NAME = "components";

export const componentService = {
    // Single create with type
    create: async (machineId, componentType, componentData) => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...componentData,
                machineId,
                componentType, // "procured" or "manufactured"
                quantity: Number(componentData.quantity) || 0,
                createdAt: serverTimestamp(),
            });
            return { id: docRef.id, ...componentData };
        } catch (error) {
            console.error("Error creating component:", error);
            throw error;
        }
    },

    // Bulk create with type
    bulkCreate: async (machineId, componentType, componentsList) => {
        try {
            const batch = writeBatch(db);
            const collectionRef = collection(db, COLLECTION_NAME);
            
            componentsList.forEach(comp => {
                const docRef = doc(collectionRef);
                batch.set(docRef, {
                    ...comp,
                    machineId,
                    componentType,
                    quantity: Number(comp.quantity) || 0,
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();
            return componentsList.length;
        } catch (error) {
            console.error("Error in bulk create:", error);
            throw error;
        }
    },

    update: async (id, data) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...data,
                quantity: Number(data.quantity) || 0,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating component:", error);
            throw error;
        }
    },

    delete: async (id) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting component:", error);
            throw error;
        }
    }
};
