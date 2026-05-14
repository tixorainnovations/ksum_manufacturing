import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { storage as firebaseStorage, db } from "../firebase/config";

export const uploadMediaFile = async (file, componentId, category) => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/\s+/g, "_");
  const path = `component-assets/components/${componentId}/${category}/${timestamp}_${safeName}`;
  const storageRef = ref(firebaseStorage, path);

  console.log("Bucket:", firebaseStorage.app.options.storageBucket);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log("Upload progress:", progress);
      },
      (error) => {
        console.error("UPLOAD ERROR:", error);
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          downloadURL,
          path,
          fileName: file.name
        });
      }
    );
  });
};

export const mediaService = {
  uploadFile: async (file, collectionName, documentId, category, onProgress) => {
    const timestamp = Date.now();
    const safeName = file.name.replace(/\s+/g, "_");
    const extension = file.name.split('.').pop();
    const path = `component-assets/${collectionName}/${documentId}/${category}/${timestamp}_${safeName}`;
    const storageRef = ref(firebaseStorage, path);

    console.log("Bucket:", firebaseStorage.app.options.storageBucket);
    console.log("File:", file);

    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
          console.log("Upload progress:", progress);
        },
        (error) => {
          console.error("UPLOAD ERROR:", error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const mediaObj = {
            id: `${timestamp}_${safeName}`,
            name: file.name,
            url: downloadURL,
            path: path,
            uploadedAt: new Date().toISOString(),
            size: file.size,
            type: file.type,
            format: extension
          };
          resolve(mediaObj);
        }
      );
    });
  },

  deleteFile: async (filePath) => {
    try {
      const storageRef = ref(firebaseStorage, filePath);
      await deleteObject(storageRef);
    } catch (e) {
      console.warn("Could not delete file from storage:", e);
    }
  },

  updateDocumentMedia: async (collectionName, documentId, mediaField, mediaObj, action = "add") => {
    const docRef = doc(db, collectionName, documentId);
    if (action === "add") {
      await updateDoc(docRef, {
        [mediaField]: arrayUnion(mediaObj)
      });
    } else {
      await updateDoc(docRef, {
        [mediaField]: arrayRemove(mediaObj)
      });
    }
  },
  
  updatePrimaryImage: async (collectionName, documentId, imagesList, primaryImageId) => {
     const docRef = doc(db, collectionName, documentId);
     const updatedImages = imagesList.map(img => ({
         ...img,
         isPrimary: img.id === primaryImageId
     }));
     await updateDoc(docRef, {
         images: updatedImages
     });
  }
};
