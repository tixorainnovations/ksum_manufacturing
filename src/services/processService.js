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

const FLOWS_COLLECTION = "process_flows";
const STEPS_COLLECTION = "process_steps";

export const processService = {
    // Flows
    getFlowsByMachine: async (machineId) => {
        try {
            const q = query(
                collection(db, FLOWS_COLLECTION),
                where("machineId", "==", machineId),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching process flows:", error);
            throw error;
        }
    },

    createFlow: async (machineId, name) => {
        try {
            const docRef = await addDoc(collection(db, FLOWS_COLLECTION), {
                machineId,
                name,
                createdAt: new Date(),
            });
            return { id: docRef.id, machineId, name, createdAt: new Date() };
        } catch (error) {
            console.error("Error creating process flow:", error);
            throw error;
        }
    },

    deleteFlow: async (id) => {
        try {
            await deleteDoc(doc(db, FLOWS_COLLECTION, id));
            // Ideally, also delete associated steps, but for now we keep it simple
        } catch (error) {
            console.error("Error deleting process flow:", error);
            throw error;
        }
    },

    // Steps
    getStepsByFlow: async (flowId) => {
        try {
            const q = query(
                collection(db, STEPS_COLLECTION),
                where("flowId", "==", flowId),
                orderBy("order", "asc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching process steps:", error);
            throw error;
        }
    },

    createStep: async (flowId, machineId, stepData) => {
        try {
            const docRef = await addDoc(collection(db, STEPS_COLLECTION), {
                ...stepData,
                flowId,
                machineId,
                createdAt: new Date(),
            });
            return { id: docRef.id, ...stepData, flowId, machineId, createdAt: new Date() };
        } catch (error) {
            console.error("Error creating process step:", error);
            throw error;
        }
    },

    updateStep: async (id, data) => {
        try {
            const docRef = doc(db, STEPS_COLLECTION, id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating process step:", error);
            throw error;
        }
    },

    deleteStep: async (id) => {
        try {
            await deleteDoc(doc(db, STEPS_COLLECTION, id));
        } catch (error) {
            console.error("Error deleting process step:", error);
            throw error;
        }
    }
};
