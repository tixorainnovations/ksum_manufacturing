import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase/config';

const ComponentInventoryPage = () => {
  const { machineId } = useParams();
  const [inventory, setInventory] = useState({
    procured: [],
    manufactured: [],
    tools: [],
    fasteners: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!machineId) return;

    // Listeners for all inventory-related collections
    const unsubComponents = onSnapshot(
      query(collection(db, "components"), where("machineId", "==", machineId)),
      (snapshot) => {
        const allComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInventory(prev => ({
          ...prev,
          procured: allComps.filter(c => c.componentType === 'procured' || !c.componentType),
          manufactured: allComps.filter(c => c.componentType === 'manufactured')
        }));
        setLoading(false);
      }
    );

    const unsubTools = onSnapshot(
      collection(db, "tools"), // Tools might not have machineId yet, or are global
      (snapshot) => {
        setInventory(prev => ({
          ...prev,
          tools: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }));
      }
    );

    const unsubFasteners = onSnapshot(
      collection(db, "fasteners"),
      (snapshot) => {
        setInventory(prev => ({
          ...prev,
          fasteners: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }));
      }
    );

    return () => {
      unsubComponents();
      unsubTools();
      unsubFasteners();
    };
  }, [machineId]);

  const allItems = [
    ...inventory.procured.map(item => ({ ...item, type: 'Procured' })),
    ...inventory.manufactured.map(item => ({ ...item, type: 'Manufactured' })),
    ...inventory.tools.map(item => ({ ...item, type: 'Tool' })),
    ...inventory.fasteners.map(item => ({ ...item, type: 'Fastener' }))
  ];

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'all' || item.type.toLowerCase() === activeTab.toLowerCase();
    return matchesSearch && matchesTab;
  });

  if (loading) return <div className="p-6">Loading inventory...</div>;

  return (
    <div className="p-6">
      <div className="card-header mb-6">
        <div>
          <h2 className="card-title" style={{ fontSize: '1.75rem' }}>Component Inventory</h2>
          <p className="text-light text-sm">Real-time stock levels and resource tracking across all categories.</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6 gap-4">
        <div className="flex gap-2">
          {['all', 'procured', 'manufactured', 'tool', 'fastener'].map(tab => (
            <button 
              key={tab}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}s
            </button>
          ))}
        </div>
        <div className="relative" style={{ width: 300 }}>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input 
            type="text" 
            placeholder="Search inventory..." 
            className="form-input" 
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Procured Items', count: inventory.procured.length, color: '#6366f1' },
          { label: 'Manufactured Parts', count: inventory.manufactured.length, color: '#10b981' },
          { label: 'Tools', count: inventory.tools.length, color: '#f59e0b' },
          { label: 'Fasteners', count: inventory.fasteners.length, color: '#ec4899' }
        ].map(stat => (
          <div key={stat.label} className="card p-4 flex flex-col justify-center border-none shadow-sm" style={{ borderLeft: `4px solid ${stat.color}` }}>
            <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">{stat.label}</div>
            <div className="text-2xl font-black text-gray-800">{stat.count}</div>
          </div>
        ))}
      </div>

      <div className="card border-none shadow-xl overflow-hidden" style={{ borderRadius: '24px' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Item Name</th>
                <th>Stock / Qty</th>
                <th>Location / Details</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td>
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      item.type === 'Procured' ? 'bg-indigo-50 text-indigo-600' :
                      item.type === 'Manufactured' ? 'bg-green-50 text-green-600' :
                      item.type === 'Tool' ? 'bg-amber-50 text-amber-600' :
                      'bg-pink-50 text-pink-600'
                    }`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="font-bold text-gray-500 text-sm">{item.category || item.manufacturingType || '-'}</td>
                  <td>
                    <div className="font-bold text-gray-900">{item.name}</div>
                    <div className="text-xs text-light italic">{item.description || item.drawingNo || '-'}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg text-indigo-600">{item.quantity || item.qty || 0}</span>
                      <span className="text-xs text-gray-400 font-bold">units</span>
                    </div>
                  </td>
                  <td className="text-sm font-medium text-gray-600">
                    {item.location || item.material || 'General Store'}
                  </td>
                  <td>
                    {(item.quantity || item.qty || 0) > 0 ? (
                      <span className="flex items-center gap-1.5 text-green-600 font-bold text-xs">
                        <div style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%' }}></div>
                        In Stock
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-red-500 font-bold text-xs">
                        <div style={{ width: 6, height: 6, background: '#ef4444', borderRadius: '50%' }}></div>
                        Out of Stock
                      </span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="text-center py-12">
                    <div className="text-4xl mb-4">📦</div>
                    <div className="font-bold text-gray-400">No matching items found in inventory</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComponentInventoryPage;
