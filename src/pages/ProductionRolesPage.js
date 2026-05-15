import React, { useState, useEffect, useMemo } from 'react';
import { rolesService, SKILL_LEVELS } from '../services/rolesService';

const SkillBadge = ({ level }) => {
  const colors = {
    Trainee:   { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
    Junior:    { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    'Mid-level': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
    Senior:    { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
    Lead:      { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  };
  const s = colors[level] || colors.Trainee;
  return (
    <span style={{
      padding: '6px 12px', borderRadius: '8px',
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
      whiteSpace: 'nowrap', display: 'inline-block'
    }}>{level}</span>
  );
};

const Modal = ({ title, subtitle, onClose, children, hideClose }) => (
  <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
    <div style={{ background: '#ffffff', borderRadius: '24px', overflow: 'hidden', width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#0f172a', fontWeight: 900 }}>{title}</h2>
          {subtitle && <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{subtitle}</p>}
        </div>
        {!hideClose && (
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 900, cursor: 'pointer' }}>✕</button>
        )}
      </div>
      <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }} className="modern-scroll">
        {children}
      </div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '20px' }}>
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</label>
    {children}
  </div>
);

const inputStyle = {
  width: '100%', padding: '14px 16px', borderRadius: '12px',
  border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#0f172a', background: '#ffffff',
  boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s'
};

const Confirm = ({ message, onConfirm, onCancel }) => (
  <Modal title="Confirm Deletion" subtitle="This action cannot be undone." hideClose={true}>
    <p style={{ fontSize: '14px', color: '#334155', marginBottom: '32px', fontWeight: 500, lineHeight: 1.5 }}>{message}</p>
    <div style={{ display: 'flex', gap: '12px' }}>
      <button onClick={onCancel} style={{ flex: 1, padding: '14px', background: '#f1f5f9', border: 'none', borderRadius: '12px', fontWeight: 800, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
      <button onClick={onConfirm} style={{ flex: 1, padding: '14px', background: '#ef4444', border: 'none', borderRadius: '12px', fontWeight: 800, color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}>Delete</button>
    </div>
  </Modal>
);

const ProductionRolesPage = () => {
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  
  const [deptForm, setDeptForm] = useState({ name: '', color: '#6366f1', icon: '🏭', description: '' });
  const [roleForm, setRoleForm] = useState({ role_name: '', department: '', description: '', skill_level: 'Mid-level' });

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubDepts = rolesService.subscribeDepartments(data => {
      setDepartments(data.filter(d => d.active !== false));
      setLoading(false);
    });
    const unsubRoles = rolesService.subscribeRoles(data => {
      setRoles(data.filter(r => r.active_status !== false));
    });
    return () => { unsubDepts(); unsubRoles(); };
  }, []);

  useEffect(() => {
    if (!loading && !seeded) {
      setSeeded(true);
      rolesService.seedDefaults();
    }
  }, [loading, seeded]);

  const rolesByDept = useMemo(() => {
    const map = {};
    departments.forEach(d => { map[d.name] = []; });
    roles.forEach(r => {
      if (!map[r.department]) map[r.department] = [];
      map[r.department].push(r);
    });
    return map;
  }, [departments, roles]);

  const filteredDepts = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const q = searchQuery.toLowerCase();
    return departments.filter(d =>
      d.name.toLowerCase().includes(q) ||
      (rolesByDept[d.name] || []).some(r => r.role_name.toLowerCase().includes(q))
    );
  }, [departments, rolesByDept, searchQuery]);

  const totalRoles = roles.length;

  const handleAddDept = async (e) => {
    e.preventDefault();
    await rolesService.addDepartment(deptForm);
    setShowAddDept(false);
    setDeptForm({ name: '', color: '#6366f1', icon: '🏭', description: '' });
  };

  const handleEditDept = async (e) => {
    e.preventDefault();
    await rolesService.updateDepartment(editingDept.id, deptForm);
    setEditingDept(null);
  };

  const handleAddRole = async (e) => {
    e.preventDefault();
    await rolesService.addRole(roleForm);
    setShowAddRole(false);
    setRoleForm({ role_name: '', department: '', description: '', skill_level: 'Mid-level' });
  };

  const handleEditRole = async (e) => {
    e.preventDefault();
    await rolesService.updateRole(editingRole.id, roleForm);
    setEditingRole(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'dept') await rolesService.deleteDepartment(confirmDelete.item.id);
    if (confirmDelete.type === 'role') await rolesService.deleteRole(confirmDelete.item.id);
    setConfirmDelete(null);
  };

  const openAddRole = (deptName = '') => {
    setRoleForm({ role_name: '', department: deptName, description: '', skill_level: 'Mid-level' });
    setShowAddRole(true);
  };

  const openEditRole = (role) => {
    setRoleForm({ role_name: role.role_name, department: role.department, description: role.description || '', skill_level: role.skill_level || 'Mid-level' });
    setEditingRole(role);
  };

  const openEditDept = (dept) => {
    setDeptForm({ name: dept.name, color: dept.color || '#6366f1', icon: dept.icon || '🏭', description: dept.description || '' });
    setEditingDept(dept);
  };

  const colorPresets = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];
  const iconPresets  = ['🏭', '🔩', '⚡', '📋', '💻', '✅', '📦', '🔧', '⚙️', '🛠️'];

  const S = {
    page: { padding: '40px', height: '100vh', boxSizing: 'border-box', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexShrink: 0 },
    title: { fontSize: '28px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.02em' },
    subtitle: { fontSize: '15px', color: '#64748b', margin: 0, fontWeight: 500 },
    btnPrimary: { padding: '14px 24px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', borderRadius: '16px', fontWeight: 800, fontSize: '14px', letterSpacing: '0.05em', border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '8px' },
    btnSecondary: { padding: '14px 24px', backgroundColor: '#ffffff', color: '#4f46e5', border: '2px solid #e0e7ff', borderRadius: '16px', fontWeight: 800, fontSize: '14px', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s' },
    workspace: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: '40px' },
    topBar: { display: 'flex', gap: '24px', marginBottom: '32px', alignItems: 'stretch' },
    statBox: { backgroundColor: '#ffffff', padding: '20px 24px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' },
    searchInputWrapper: { flex: 1, backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' },
    deptCard: { backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', overflow: 'hidden' },
    deptHeader: { padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' },
    roleRow: { display: 'flex', alignItems: 'center', padding: '20px 32px', borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' },
    actionBtn: { width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  };

  return (
    <div style={S.page}>
      
      {/* HEADER */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Production Roles</h1>
          <p style={S.subtitle}>Manage manufacturing departments and operational job roles.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={S.btnSecondary} onClick={() => { setDeptForm({ name: '', color: '#6366f1', icon: '🏭', description: '' }); setShowAddDept(true); }}>
            + Add Department
          </button>
          <button style={S.btnPrimary} onClick={() => openAddRole()}>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> Add Role
          </button>
        </div>
      </div>

      <div style={S.workspace} className="modern-scroll">
        
        {/* TOP BAR: STATS + SEARCH */}
        <div style={S.topBar}>
          <div style={S.searchInputWrapper}>
            <span style={{ fontSize: '20px', color: '#94a3b8' }}>🔍</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by role or department name..."
              style={{ border: 'none', outline: 'none', fontSize: '16px', fontWeight: 600, color: '#0f172a', width: '100%', backgroundColor: 'transparent' }}
            />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '24px', height: '24px', color: '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}>✕</button>}
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={S.statBox}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#6366f1', lineHeight: 1 }}>{departments.length}</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Departments</div>
            </div>
            <div style={S.statBox}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{totalRoles}</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Roles</div>
            </div>
          </div>
        </div>

        {/* DEPARTMENTS GRID */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '15px', fontWeight: 600 }}>Loading production roles...</div>
        ) : filteredDepts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', backgroundColor: '#ffffff', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
            <span style={{ fontSize: '48px', opacity: 0.5, display: 'block', marginBottom: '16px' }}>🔍</span>
            <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#475569', margin: '0 0 8px 0' }}>No Roles Found</h4>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Try adjusting your search criteria or add a new department.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {filteredDepts.map(dept => {
              const deptRoles = (rolesByDept[dept.name] || []).filter(r =>
                !searchQuery.trim() ||
                r.role_name.toLowerCase().includes(searchQuery.toLowerCase())
              );
              const deptColor = dept.color || '#6366f1';

              return (
                <div key={dept.id} style={S.deptCard}>
                  {/* Dept Header */}
                  <div style={{...S.deptHeader, borderTop: `6px solid ${deptColor}`}}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: `${deptColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                        {dept.icon || '🏭'}
                      </div>
                      <div>
                        <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{dept.name}</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                          {dept.description || 'No description provided.'} 
                          <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span> 
                          <span style={{ fontWeight: 800, color: deptColor }}>{deptRoles.length} ROLES</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => openAddRole(dept.name)} style={{ padding: '8px 16px', borderRadius: '10px', backgroundColor: '#f1f5f9', border: 'none', color: '#475569', fontSize: '13px', fontWeight: 800, cursor: 'pointer', transition: 'background 0.2s' }}>
                        + Add Role
                      </button>
                      <button onClick={() => openEditDept(dept)} style={S.actionBtn} title="Edit Department">✎</button>
                      <button onClick={() => setConfirmDelete({ type: 'dept', item: dept })} style={{...S.actionBtn, color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2'}} title="Delete Department">🗑</button>
                    </div>
                  </div>

                  {/* Roles List */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {deptRoles.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: 500, backgroundColor: '#f8fafc' }}>
                        No roles defined in this department. 
                        <span onClick={() => openAddRole(dept.name)} style={{ color: deptColor, fontWeight: 700, cursor: 'pointer', marginLeft: '6px' }}>Add the first role →</span>
                      </div>
                    ) : (
                      deptRoles.map((role) => (
                        <div key={role.id} style={S.roleRow} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{role.role_name}</div>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{role.description || '—'}</div>
                          </div>
                          
                          <div style={{ width: '150px', display: 'flex', justifyContent: 'center' }}>
                            <SkillBadge level={role.skill_level} />
                          </div>

                          <div style={{ width: '120px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => openEditRole(role)} style={{...S.actionBtn, width: '32px', height: '32px'}} title="Edit Role"><span style={{fontSize: '13px'}}>✎</span></button>
                            <button onClick={() => setConfirmDelete({ type: 'role', item: role })} style={{...S.actionBtn, width: '32px', height: '32px', color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2'}} title="Delete Role"><span style={{fontSize: '13px'}}>🗑</span></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ADD/EDIT DEPT MODAL */}
      {(showAddDept || editingDept) && (
        <Modal
          title={editingDept ? `Edit Department` : 'New Department'}
          subtitle={editingDept ? `Modify the ${editingDept.name} department settings.` : 'Create a new functional department.'}
          onClose={() => { setShowAddDept(false); setEditingDept(null); }}
        >
          <form onSubmit={editingDept ? handleEditDept : handleAddDept}>
            <Field label="Department Name">
              <input required value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="e.g. Mechanical Assembly" style={inputStyle} />
            </Field>
            <Field label="Description">
              <input value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                placeholder="Short description of responsibilities…" style={inputStyle} />
            </Field>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              <Field label="Icon">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {iconPresets.map(ic => (
                    <button key={ic} type="button" onClick={() => setDeptForm({ ...deptForm, icon: ic })}
                      style={{ width: '42px', height: '42px', borderRadius: '12px', border: `2px solid ${deptForm.icon === ic ? '#6366f1' : '#e2e8f0'}`, fontSize: '20px', cursor: 'pointer', background: deptForm.icon === ic ? '#eef2ff' : '#f8fafc', transition: 'all 0.2s' }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Theme Color">
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {colorPresets.map(c => (
                    <button key={c} type="button" onClick={() => setDeptForm({ ...deptForm, color: c })}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', border: `3px solid ${deptForm.color === c ? '#0f172a' : 'transparent'}`, background: c, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} />
                  ))}
                </div>
              </Field>
            </div>

            <button type="submit" style={{ ...S.btnPrimary, width: '100%', justifyContent: 'center', padding: '16px' }}>
              {editingDept ? 'Save Changes' : 'Create Department'}
            </button>
          </form>
        </Modal>
      )}

      {/* ADD/EDIT ROLE MODAL */}
      {(showAddRole || editingRole) && (
        <Modal
          title={editingRole ? `Edit Role` : 'Add New Role'}
          subtitle={editingRole ? `Update details for ${editingRole.role_name}.` : 'Define a new operational role within a department.'}
          onClose={() => { setShowAddRole(false); setEditingRole(null); }}
        >
          <form onSubmit={editingRole ? handleEditRole : handleAddRole}>
            <Field label="Role Name">
              <input required value={roleForm.role_name} onChange={e => setRoleForm({ ...roleForm, role_name: e.target.value })}
                placeholder="e.g. Mechanical Assembly Technician" style={inputStyle} />
            </Field>
            <Field label="Department">
              <select required value={roleForm.department} onChange={e => setRoleForm({ ...roleForm, department: e.target.value })} style={inputStyle}>
                <option value="">— Select Department —</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.icon} {d.name}</option>)}
              </select>
            </Field>
            <Field label="Skill Level">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {SKILL_LEVELS.map(level => (
                  <button key={level} type="button" onClick={() => setRoleForm({ ...roleForm, skill_level: level })}
                    style={{
                      padding: '8px 16px', borderRadius: '10px', border: '1px solid',
                      borderColor: roleForm.skill_level === level ? '#6366f1' : '#e2e8f0',
                      background: roleForm.skill_level === level ? '#eef2ff' : '#ffffff',
                      color: roleForm.skill_level === level ? '#4338ca' : '#475569',
                      fontSize: '13px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s'
                    }}>
                    {level}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Description">
              <textarea rows="3" value={roleForm.description} onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder="Briefly describe the role's responsibilities…" style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>

            <button type="submit" style={{ ...S.btnPrimary, width: '100%', justifyContent: 'center', padding: '16px', marginTop: '12px' }}>
              {editingRole ? 'Save Changes' : 'Create Role'}
            </button>
          </form>
        </Modal>
      )}

      {/* CONFIRM ARCHIVE MODAL */}
      {confirmDelete && (
        <Confirm
          message={
            confirmDelete.type === 'dept'
              ? `Are you sure you want to delete the department "${confirmDelete.item.name}"? This will permanently remove the department. Roles may need to be reassigned.`
              : `Are you sure you want to delete the role "${confirmDelete.item.role_name}"?`
          }
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default ProductionRolesPage;
