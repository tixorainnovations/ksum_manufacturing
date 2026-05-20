import React, { useState, useRef } from 'react';
import { mediaService } from '../services/mediaService';
import { optimizeImage, sanitizeFileName } from '../utils/imageOptimizer';
import SafeImage from './common/SafeImage';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      background: type === 'error' ? '#ef4444' : '#10b981', color: 'white',
      padding: '12px 24px', borderRadius: '8px', zIndex: 9999,
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '12px'
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>&times;</button>
    </div>
  );
};


const ImageDropZone = ({ onDrop, uploading, progress }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files[0]);
    }
  };
  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onDrop(e.target.files[0]);
    }
    // reset
    e.target.value = null;
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !uploading && fileInputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragOver ? 'var(--primary)' : '#cbd5e1'}`,
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        background: isDragOver ? '#f0f9ff' : '#f8fafc',
        cursor: uploading ? 'default' : 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '1rem'
      }}
    >
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/jpeg, image/png, image/webp" onChange={handleChange} />
      {uploading ? (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>Uploading... {Math.round(progress)}%</div>
          <div className="progress-bar" style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width 0.2s ease' }} />
          </div>
        </div>
      ) : (
        <div style={{ color: '#64748b' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📁</span>
          <span style={{ fontWeight: 500, color: '#334155' }}>Click or drag image to upload</span>
          <br/>
          <span style={{ fontSize: '0.8rem' }}>JPEG, PNG, WebP up to 10MB</span>
        </div>
      )}
    </div>
  );
};

const ExternalLinkSection = ({ title, dbField, component, collectionName, showToast }) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const currentFiles = component[dbField] || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url || !name) return;
    setAdding(true);
    try {
      const newFile = {
        id: Date.now().toString(),
        name,
        url,
        type: 'external_link',
        uploadedAt: new Date().toISOString()
      };
      await mediaService.updateDocumentMedia(collectionName, component.id, dbField, newFile, 'add');
      setUrl('');
      setName('');
    } catch (err) {
      showToast("Failed to add link: " + err.message, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (fileObj) => {
    if (!window.confirm("Delete this link?")) return;
    try {
      await mediaService.updateDocumentMedia(collectionName, component.id, dbField, fileObj, 'remove');
    } catch (err) {
      showToast("Failed to delete: " + err.message, "error");
    }
  };

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
        <input required type="text" placeholder="File Name (e.g., Drawing v1)" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        <input required type="url" placeholder="Google Drive / External URL" value={url} onChange={e => setUrl(e.target.value)} style={{ flex: 2, padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        <button disabled={adding} type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>{adding ? 'Adding...' : 'Add Link'}</button>
      </form>

      {currentFiles.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>No external links added yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {currentFiles.map(file => (
            <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{file.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Added {new Date(file.uploadedAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href={file.url} target="_blank" rel="noreferrer" className="btn btn-outline text-xs" style={{ padding: '0.25rem 0.5rem' }}>Open Link</a>
                <button onClick={() => handleDelete(file)} className="btn btn-outline text-xs" style={{ padding: '0.25rem 0.5rem', color: '#ef4444', borderColor: '#ef4444' }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ComponentMediaPanel = ({ component, collectionName, onClose }) => {
  const [activeTab, setActiveTab] = useState('images');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState({ message: '', type: '' });

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 5000);
  };

  if (!component) return null;

  const currentImages = component.images || [];

  const handleImageUpload = async (file) => {
    if (file.size > MAX_IMAGE_SIZE) {
      showToast("File is too large. Max 10MB allowed.", "error");
      return;
    }

    try {
      setUploading(true);
      setProgress(10);
      
      const drawingNo = component.drawingNo || component.slNo || component.id;
      const optimizedFile = await optimizeImage(file, 1600, 0.8);
      const newFileName = sanitizeFileName(drawingNo, optimizedFile.name);

      // Check duplicates
      const existingImg = currentImages.find(i => i.fileName === newFileName);
      if (existingImg) {
        const choice = window.confirm(`An image named ${newFileName} already exists.\nClick OK to REPLACE, or Cancel to abort.`);
        if (!choice) {
          setUploading(false);
          setProgress(0);
          return;
        }
      }

      setProgress(30);
      const category = component.category || component.manufacturingType || 'misc';
      const uploadedMedia = await mediaService.uploadImageToGitHub(optimizedFile, newFileName, category, setProgress);

      if (currentImages.length === 0) uploadedMedia.isPrimary = true;

      if (existingImg) {
         await mediaService.updateDocumentMedia(collectionName, component.id, 'images', existingImg, 'remove');
      }
      
      await mediaService.updateDocumentMedia(collectionName, component.id, 'images', uploadedMedia, 'add');
      
    } catch (err) {
      console.error(err);
      showToast("Upload failed: " + err.message, "error");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDeleteImage = async (imgObj) => {
    if (!window.confirm("Delete this image completely?")) return;
    try {
      if (imgObj.githubPath) {
        await mediaService.deleteFileFromGitHub(imgObj.githubPath);
      }
      await mediaService.updateDocumentMedia(collectionName, component.id, 'images', imgObj, 'remove');
    } catch (err) {
      showToast("Delete failed: " + err.message, "error");
    }
  };

  const tabs = [
    { id: 'images', label: 'Images', count: currentImages.length },
    { id: 'drawings', label: 'Drawings', count: (component.drawings || []).length },
    { id: 'cad', label: 'CAD Files', count: (component.cadFiles || []).length },
    { id: 'datasheets', label: 'Datasheets', count: (component.datasheets || []).length }
  ];

  return (
    <div className="drawer-overlay" onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div className="drawer-content" onClick={e => e.stopPropagation()} style={{ width: '600px', background: 'white', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', animation: 'slideInRight 0.3s ease' }}>
        
        <div className="drawer-header" style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{component.name}</h2>
            <div className="text-sm text-light mt-1">
              {component.category || component.manufacturingType || 'Component'} • {component.drawingNo || component.spec || component.index || component.slNo}
            </div>
          </div>
          <button className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 1.5rem' }}>
          {tabs.map(t => (
            <div 
              key={t.id} 
              onClick={() => setActiveTab(t.id)}
              style={{ padding: '1rem 0', marginRight: '1.5rem', cursor: 'pointer', fontWeight: activeTab === t.id ? 600 : 400, color: activeTab === t.id ? 'var(--primary)' : '#64748b', borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent' }}
            >
              {t.label} <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '10px', fontSize: '0.75rem', marginLeft: '4px' }}>{t.count}</span>
            </div>
          ))}
        </div>

        <div className="drawer-body" style={{ padding: '1.5rem', flex: 1 }}>
          {activeTab === 'images' && (
            <div>
              <ImageDropZone onDrop={handleImageUpload} uploading={uploading} progress={progress} />
              
              {currentImages.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>No images uploaded yet.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                  {currentImages.map(img => (
                    <div key={img.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: img.isPrimary ? '2px solid var(--primary)' : '1px solid #e2e8f0', height: '140px' }}>
                      <SafeImage src={img.url} alt={img.name} />
                      {img.isPrimary && <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'var(--primary)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>Primary</div>}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '6px', display: 'flex', justifyContent: 'space-between' }}>
                         {!img.isPrimary && <button style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => mediaService.updatePrimaryImage(collectionName, component.id, currentImages, img.id)}>Set Primary</button>}
                         <button style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', marginLeft: 'auto' }} onClick={() => handleDeleteImage(img)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'drawings' && <ExternalLinkSection title="Technical Drawings" dbField="drawings" component={component} collectionName={collectionName} showToast={showToast} />}
          {activeTab === 'cad' && <ExternalLinkSection title="CAD Files" dbField="cadFiles" component={component} collectionName={collectionName} showToast={showToast} />}
          {activeTab === 'datasheets' && <ExternalLinkSection title="Datasheets" dbField="datasheets" component={component} collectionName={collectionName} showToast={showToast} />}

        </div>
      </div>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
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
