import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

export const processFlowService = {
  // Part Preparations
  createPartPrep: async (data) => {
    return addDoc(collection(db, "partPreparations"), {
      ...data,
      createdAt: new Date()
    });
  },
  updatePartPrep: async (id, data) => {
    return updateDoc(doc(db, "partPreparations", id), {
      ...data,
      updatedAt: new Date()
    });
  },
  deletePartPrep: async (id) => deleteDoc(doc(db, "partPreparations", id)),

  // Sub-Assemblies
  createSubAssembly: async (data) => {
    return addDoc(collection(db, "subAssemblies"), {
      ...data,
      createdAt: new Date()
    });
  },
  updateSubAssembly: async (id, data) => {
    return updateDoc(doc(db, "subAssemblies", id), {
      ...data,
      updatedAt: new Date()
    });
  },
  deleteSubAssembly: async (id) => deleteDoc(doc(db, "subAssemblies", id)),

  // QC Checks
  createQC: async (data) => {
    return addDoc(collection(db, "qcChecks"), {
      ...data,
      createdAt: new Date()
    });
  },
  deleteQC: async (id) => deleteDoc(doc(db, "qcChecks", id)),

  // Final Assembly
  createFinalAssembly: async (data) => {
    return addDoc(collection(db, "finalAssembly"), {
      ...data,
      createdAt: new Date()
    });
  },
  updateFinalAssembly: async (id, data) => {
    return updateDoc(doc(db, "finalAssembly", id), {
      ...data,
      updatedAt: new Date()
    });
  },
  deleteFinalAssembly: async (id) => deleteDoc(doc(db, "finalAssembly", id)),
};
