import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";

const COLLECTION = "fasteners";

export const fastenerService = {
  getAll: async () => {
    const q = query(collection(db, COLLECTION), orderBy("index", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  create: async (item) => {
    return addDoc(collection(db, COLLECTION), {
      ...item,
      createdAt: serverTimestamp()
    });
  },

  createBulk: async (items) => {
    const promises = items.map(item =>
      addDoc(collection(db, COLLECTION), {
        ...item,
        createdAt: serverTimestamp()
      })
    );
    return Promise.all(promises);
  },

  delete: async (id) => {
    return deleteDoc(doc(db, COLLECTION, id));
  }
};
