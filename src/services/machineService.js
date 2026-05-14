import {
    collection,
    getDocs,
    getDoc,
    doc,
    deleteDoc,
    updateDoc,
    orderBy,
    query,
    serverTimestamp,
    setDoc
} from "firebase/firestore";

import { db } from "../firebase/config";

const COLLECTION_NAME = "machines";

export const machineService = {

    getAll: async () => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                orderBy("createdAt", "desc")
            );

            const snapshot = await getDocs(q);

            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));

        } catch (error) {
            console.error("Error fetching machines:", error);
            throw error;
        }
    },

    getById: async (id) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                return { id: snapshot.id, ...snapshot.data() };
            }

            return null;

        } catch (error) {
            console.error("Error fetching machine:", error);
            throw error;
        }
    },

    // ✅ UPDATED CREATE (CUSTOM ID)
    create: async (name) => {
        try {
            const customId = name
                .toLowerCase()
                .replace(/\s+/g, "-")       // spaces → dash
                .replace(/[^a-z0-9-]/g, ""); // remove special chars

            console.log("Creating machine with ID:", customId);

            const docRef = doc(db, COLLECTION_NAME, customId);

            await setDoc(docRef, {
                name,
                createdAt: serverTimestamp()
            });

            return {
                id: customId,
                name
            };

        } catch (error) {
            console.error("Error creating machine:", error);
            throw error;
        }
    },

    update: async (id, name) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);

            await updateDoc(docRef, {
                name,
                updatedAt: serverTimestamp()
            });

            return { id, name };

        } catch (error) {
            console.error("Error updating machine:", error);
            throw error;
        }
    },

    delete: async (id) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting machine:", error);
            throw error;
        }
    }
};