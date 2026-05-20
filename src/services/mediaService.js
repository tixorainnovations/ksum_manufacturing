import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebase/config";

const GITHUB_TOKEN = (process.env.REACT_APP_GITHUB_TOKEN || '').trim();
const GITHUB_OWNER = (process.env.REACT_APP_GITHUB_OWNER || '').trim();
const GITHUB_REPO = (process.env.REACT_APP_GITHUB_REPO || '').trim();

console.log("GitHub ENV CHECK", {
  token: !!GITHUB_TOKEN,
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO
});

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Content-Type': 'application/json',
});

// Helper to convert Blob/File to Base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

export const mediaService = {
  // New abstracted upload logic for Images using GitHub
  uploadImageToGitHub: async (file, fileName, category, onProgress) => {
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      throw new Error("GitHub environment variables are missing. Check .env and restart npm start");
    }

    if (onProgress) onProgress(10); // Start progress

    const base64Data = await fileToBase64(file);
    if (onProgress) onProgress(40);

    const path = `components/${category.toLowerCase()}/${fileName}`;
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

    // Check if file already exists (to handle duplicate / replace logic)
    // We will let the calling component handle the prompt, so here we just upload.
    // GitHub PUT requires 'sha' if the file exists and we want to overwrite.
    let sha = null;
    try {
      const getRes = await fetch(url, { headers: getAuthHeaders() });
      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
      }
    } catch (e) {
      // Ignore if it doesn't exist
    }

    if (onProgress) onProgress(60);

    const body = {
      message: `Upload ${fileName}`,
      content: base64Data,
    };
    if (sha) {
      body.sha = sha;
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (onProgress) onProgress(90);

    if (!res.ok) {
      let errData;
      try { errData = await res.json(); } catch(e) {}
      if (res.status === 401 || (errData && errData.message === "Bad credentials")) {
         throw new Error("Bad credentials: Your GitHub token is invalid or lacks the 'repo' scope. Please create a Classic Token with 'repo' scope and update .env");
      }
      throw new Error(errData?.message || "Failed to upload to GitHub");
    }

    const responseData = await res.json();
    
    // Generate the raw URL for faster serving
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${path}`;
    
    if (onProgress) onProgress(100);

    return {
      id: `${Date.now()}_${fileName}`, // unique identifier
      name: fileName,
      fileName: fileName,
      url: rawUrl,
      githubPath: path,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "Admin", // To be replaced with actual user logic if available
      size: file.size,
      type: file.type,
      format: file.name.split('.').pop().toLowerCase()
    };
  },

  deleteFileFromGitHub: async (githubPath) => {
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !githubPath) return;

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`;

    try {
      // 1. Get SHA
      const getRes = await fetch(url, { headers: getAuthHeaders() });
      if (!getRes.ok) throw new Error("File not found on GitHub");
      const data = await getRes.json();
      
      // 2. Delete using SHA
      const delRes = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: `Delete ${githubPath}`,
          sha: data.sha
        })
      });

      if (!delRes.ok) {
         console.warn("Failed to delete from GitHub. Res:", await delRes.text());
      }
    } catch (e) {
      console.warn("Could not delete file from GitHub:", e);
      throw e;
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
