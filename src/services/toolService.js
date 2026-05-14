import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const toolService = {
  create: async (data) => addDoc(collection(db, "tools"), data),
  getAll: async () => {
    const snapshot = await getDocs(collection(db, "tools"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  delete: async (id) => deleteDoc(doc(db, "tools", id)),
};
