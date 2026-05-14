import {
    collection,
    addDoc,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    query,
    where,
    orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";

const COLLECTION_NAME = "quality_checks";

export const qualityService = {
    getByMachine: async (machineId) => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("machineId", "==", machineId),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching quality checks:", error);
            throw error;
        }
    },

    create: async (machineId, checkData) => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...checkData,
                machineId,
                createdAt: new Date(),
            });
            return { id: docRef.id, ...checkData, machineId, createdAt: new Date() };
        } catch (error) {
            console.error("Error creating quality check:", error);
            throw error;
        }
    },

    update: async (id, data) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating quality check:", error);
            throw error;
        }
    },

    delete: async (id) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting quality check:", error);
            throw error;
        }
    }
};
