import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase/config';

const MachineDashboard = () => {
  const { machineId } = useParams();
  const [counts, setCounts] = useState({
    components: 0,
    flows: 0,
    qc: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!machineId) return;

    // Real-time listeners for all collections to update counts
    const collections = [
      'components', 
      'tools', 
      'fasteners', 
      'partPreparations', 
      'subAssemblies', 
      'finalAssembly', 
      'quality_checks',
      'qcChecks'
    ];

    const data = {
      components: 0,
      tools: 0,
      fasteners: 0,
      partPreparations: 0,
      subAssemblies: 0,
      finalAssembly: 0,
      quality_checks: 0,
      qcChecks: 0
    };

    const unsubscribes = collections.map(colName => {
      // Tools and Fasteners are currently global (no machineId filter)
      const q = (colName === 'tools' || colName === 'fasteners')
        ? query(collection(db, colName))
        : query(collection(db, colName), where("machineId", "==", machineId));

      return onSnapshot(q, (snapshot) => {
        data[colName] = snapshot.size;
        
        // Use a functional update to ensure we always have the latest state
        setCounts(prev => ({
          ...prev,
          components: data.components + data.tools + data.fasteners,
          flows: data.partPreparations + data.subAssemblies + data.finalAssembly,
          qc: data.quality_checks + data.qcChecks
        }));
        setLoading(false);
      }, (error) => {
        console.error(`Error in ${colName} listener:`, error);
      });
    });

    // Listener for recent activity
    const activityQuery = query(
      collection(db, "activityLogs"),
      where("machineId", "==", machineId),
      orderBy("timestamp", "desc"),
      limit(5)
    );

    const unsubscribeActivity = onSnapshot(activityQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecentActivity(logs);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
      unsubscribeActivity();
    };
  }, [machineId]);

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";
    return Math.floor(seconds) + " seconds ago";
  };

  const getMachineStatus = () => {
    if (counts.components > 0 && counts.flows > 0 && counts.qc > 0) {
      return {
        label: "Ready for operation",
        color: "#10b981",
        description: "Configuration is complete and verified."
      };
    }
    return {
      label: "Setup incomplete",
      color: "#f59e0b",
      description: "Define components, process flows, and QC to begin."
    };
  };

  const status = getMachineStatus();

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded"></div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-2xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title" style={{ fontSize: '1.5rem' }}>Dashboard Overview</h2>
        <div style={{ fontSize: '0.8rem', color: (counts.flows > 0 && counts.qc > 0) ? '#10b981' : '#f59e0b', fontWeight: 800, textTransform: 'uppercase' }}>
          {(counts.flows > 0 && counts.qc > 0) ? "● Fully Configured" : "○ Setup Pending"}
        </div>
      </div>

      <div className="grid grid-cols-3">
        <div className="card">
          <div className="text-light text-sm" style={{ fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Components</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#6366f1' }}>{counts.components}</div>
          <div className="text-sm mt-4 text-gray-500">{counts.components === 0 ? "Start by adding components" : "Registered in system"}</div>
        </div>
        
        <div className="card">
          <div className="text-light text-sm" style={{ fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Process Flows</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#10b981' }}>{counts.flows}</div>
          <div className="text-sm mt-4 text-gray-500">Active workflow stages</div>
        </div>

        <div className="card">
          <div className="text-light text-sm" style={{ fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Quality Checks</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f59e0b' }}>{counts.qc}</div>
          <div className="text-sm mt-4 text-gray-500">Inspection definitions</div>
        </div>
      </div>

      <div className="grid grid-cols-2 mt-4">
        <div className="card">
          <h3 className="card-title">Recent Activity</h3>
          <div style={{ marginTop: '1rem' }}>
            {recentActivity.length > 0 ? (
              <div className="flex flex-col gap-4">
                {recentActivity.map(log => (
                  <div key={log.id} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="text-sm font-bold text-gray-800">{log.action} {log.entity}</div>
                      <div className="text-xs text-gray-500">{log.details}</div>
                    </div>
                    <div className="text-xs text-light italic">{getRelativeTime(log.timestamp)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p className="text-sm">No recent activity recorded.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="card">
          <h3 className="card-title">Machine Status</h3>
          <div style={{ marginTop: '1rem' }}>
            <div className="flex items-center gap-2 mb-2">
              <div style={{ width: 12, height: 12, background: status.color, borderRadius: '50%' }}></div>
              <span className="text-sm font-bold" style={{ color: status.color }}>{status.label}</span>
            </div>
            <p className="text-sm text-light">{status.description}</p>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <div className="text-xs font-black uppercase text-gray-400 mb-2">Setup Progress</div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-1000" 
                  style={{ width: `${((counts.components > 0 ? 1 : 0) + (counts.flows > 0 ? 1 : 0) + (counts.qc > 0 ? 1 : 0)) / 3 * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MachineDashboard;
