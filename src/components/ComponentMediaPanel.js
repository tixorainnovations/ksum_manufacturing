import React, { useState, useRef } from 'react';
import { mediaService } from '../services/mediaService';

const UPLOAD_LIMITS = {
  images: { maxSize: 10 * 1024 * 1024, accept: "image/jpeg, image/png, image/webp" },
  drawings: { maxSize: 25 * 1024 * 1024, accept: "application/pdf, .dxf" },
  cad: { maxSize: 50 * 1024 * 1024, accept: ".stl, .step, .stp" },
  datasheets: { maxSize: 25 * 1024 * 1024, accept: "application/pdf" }
};

const SectionMedia = ({ title, type, dbField, component, collectionName, accept, maxSize }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const currentFiles = component[dbField] || [];

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log("File before upload:", file);
    console.log("File size:", file.size);
    console.log("File type:", file.type);

    if (file.size > maxSize) {
      alert(`File too large. Max size is ${maxSize / (1024 * 1024)}MB.`);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const mediaObj = await mediaService.uploadFile(file, collectionName, component.id, type, setProgress);
      
      // Update firestore
      let finalMediaObj = { ...mediaObj };
      if (type === 'images' && currentFiles.length === 0) {
        finalMediaObj.isPrimary = true;
      }
      if (type !== 'images') {
        finalMediaObj.type = type;
      }

      await mediaService.updateDocumentMedia(collectionName, component.id, dbField, finalMediaObj, "add");
    } catch (err) {
      console.error(err);
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fileObj) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;
    
    try {
      await mediaService.deleteFile(fileObj.path);
      await mediaService.updateDocumentMedia(collectionName, component.id, dbField, fileObj, "remove");
    } catch (err) {
      console.error(err);
      alert("Delete failed: " + err.message);
    }
  };

  const handleSetPrimary = async (fileObj) => {
    if (type !== 'images' || fileObj.isPrimary) return;
    try {
      await mediaService.updatePrimaryImage(collectionName, component.id, currentFiles, fileObj.id);
    } catch (err) {
      console.error(err);
      alert("Update primary image failed: " + err.message);
    }
  };

  return (
    <div className="media-section" style={{ marginBottom: '2rem' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{title}</h3>
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept={accept} 
            onChange={handleFileChange} 
          />
          <button 
            className="btn btn-outline text-sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? `Uploading ${Math.round(progress)}%` : '+ Upload'}
          </button>
        </div>
      </div>

      {uploading && (
        <div className="progress-bar mb-4" style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width 0.2s ease' }} />
        </div>
      )}

      {currentFiles.length === 0 ? (
        <div className="empty-state text-sm" style={{ padding: '2rem', background: '#f8fafc', borderRadius: '8px' }}>
          No files uploaded yet.
        </div>
      ) : (
        <div className={type === 'images' ? "image-grid" : "file-list"} style={type === 'images' ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' } : { display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {currentFiles.map(fileObj => (
            type === 'images' ? (
              <div key={fileObj.id} className="image-card" style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: fileObj.isPrimary ? '2px solid var(--primary)' : '1px solid #e2e8f0' }}>
                <img src={fileObj.url} alt={fileObj.name} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                {fileObj.isPrimary && <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'var(--primary)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>Primary</div>}
                <div className="image-actions" style={{ position: 'absolute', bottom: '0', left: '0', right: '0', background: 'rgba(0,0,0,0.6)', padding: '4px', display: 'flex', justifyContent: 'space-between' }}>
                   {!fileObj.isPrimary && <button className="text-xs" style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => handleSetPrimary(fileObj)}>Set Primary</button>}
                   <button className="text-xs" style={{ color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 'auto' }} onClick={() => handleDelete(fileObj)}>Delete</button>
                </div>
              </div>
            ) : (
              <div key={fileObj.id} className="file-item flex justify-between items-center" style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: '1.5rem' }}>📄</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{fileObj.name}</div>
                    <div className="text-xs text-light">Uploaded {new Date(fileObj.uploadedAt).toLocaleDateString()} • {(fileObj.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href={fileObj.url} target="_blank" rel="noreferrer" className="btn btn-outline text-xs" style={{ padding: '0.25rem 0.5rem' }}>View</a>
                  <button className="btn btn-outline text-xs" style={{ padding: '0.25rem 0.5rem', borderColor: '#f87171', color: '#f87171' }} onClick={() => handleDelete(fileObj)}>Delete</button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
};

const ComponentMediaPanel = ({ component, collectionName, onClose }) => {
  if (!component) return null;

  return (
    <div className="drawer-overlay" onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div className="drawer-content" onClick={e => e.stopPropagation()} style={{ width: '600px', background: 'white', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', animation: 'slideInRight 0.3s ease' }}>
        <div className="drawer-header" style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', itemsCenter: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{component.name}</h2>
            <div className="text-sm text-light mt-1">
              {component.category || component.manufacturingType || 'Component'} • {component.drawingNo || component.spec || component.index || component.slNo}
            </div>
          </div>
          <button className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>

        <div className="drawer-body" style={{ padding: '1.5rem', flex: 1 }}>
          <SectionMedia 
            title="Component Images" 
            type="images" 
            dbField="images" 
            component={component} 
            collectionName={collectionName} 
            accept={UPLOAD_LIMITS.images.accept}
            maxSize={UPLOAD_LIMITS.images.maxSize}
          />
          
          <SectionMedia 
            title="Technical Drawings" 
            type="drawings" 
            dbField="files" 
            component={component} 
            collectionName={collectionName} 
            accept={UPLOAD_LIMITS.drawings.accept}
            maxSize={UPLOAD_LIMITS.drawings.maxSize}
          />
          
          <SectionMedia 
            title="CAD Files" 
            type="cad" 
            dbField="files" 
            component={component} 
            collectionName={collectionName} 
            accept={UPLOAD_LIMITS.cad.accept}
            maxSize={UPLOAD_LIMITS.cad.maxSize}
          />
          
          <SectionMedia 
            title="Datasheets" 
            type="datasheets" 
            dbField="files" 
            component={component} 
            collectionName={collectionName} 
            accept={UPLOAD_LIMITS.datasheets.accept}
            maxSize={UPLOAD_LIMITS.datasheets.maxSize}
          />
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default ComponentMediaPanel;
