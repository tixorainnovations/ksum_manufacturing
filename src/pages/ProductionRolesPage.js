import React, { useState, useEffect, useMemo } from 'react';
import { rolesService, SKILL_LEVELS, DEFAULT_DEPARTMENTS } from '../services/rolesService';

// ── SKILL LEVEL BADGE ─────────────────────────────────────────────────────────
const SkillBadge = ({ level }) => {
  const colors = {
    Trainee:   { bg: '#f1f5f9', text: '#64748b' },
    Junior:    { bg: '#dbeafe', text: '#1d4ed8' },
    'Mid-level': { bg: '#d1fae5', text: '#065f46' },
    Senior:    { bg: '#fef3c7', text: '#92400e' },
    Lead:      { bg: '#ede9fe', text: '#5b21b6' },
  };
  const s = colors[level] || colors.Trainee;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px',
      background: s.bg, color: s.text,
      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
      whiteSpace: 'nowrap',
    }}>{level}</span>
  );
};

// ── MODAL SHELL ───────────────────────────────────────────────────────────────
const Modal = ({ title, headerColor = '#0f172a', onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
    <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
      <div style={{ background: headerColor, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 600 }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  </div>
);

// ── FORM FIELD ────────────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</label>
    {children}
  </div>
);

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: '4px',
  border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff',
  boxSizing: 'border-box',
};

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
const Confirm = ({ message, onConfirm, onCancel }) => (
  <Modal title="Confirm Action" headerColor="#dc2626" onClose={onCancel}>
    <p style={{ fontSize: '13px', color: '#334155', marginBottom: '24px' }}>{message}</p>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={onCancel} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
      <button onClick={onConfirm} style={{ flex: 1, padding: '10px', background: '#dc2626', border: 'none', borderRadius: '4px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Confirm Archive</button>
    </div>
  </Modal>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const ProductionRolesPage = () => {
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  // ── Modals & forms ────────────────────────────────────────────────────────
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, item }
  const [preselectedDept, setPreselectedDept] = useState('');

  const [deptForm, setDeptForm] = useState({ name: '', color: '#64748b', icon: '🏭', description: '' });
  const [roleForm, setRoleForm] = useState({ role_name: '', department: '', description: '', skill_level: 'Mid-level' });

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDepts, setExpandedDepts] = useState({});

  // ── Live subscriptions ────────────────────────────────────────────────────
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

  // ── Auto-seed on first load ───────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !seeded) {
      setSeeded(true);
      rolesService.seedDefaults();
    }
  }, [loading, seeded]);

  // ── Expand all by default after load ─────────────────────────────────────
  useEffect(() => {
    if (departments.length > 0) {
      const all = {};
      departments.forEach(d => { all[d.id] = true; });
      setExpandedDepts(prev => ({ ...all, ...prev }));
    }
  }, [departments.length]);

  // ── Computed ──────────────────────────────────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddDept = async (e) => {
    e.preventDefault();
    await rolesService.addDepartment(deptForm);
    setShowAddDept(false);
    setDeptForm({ name: '', color: '#64748b', icon: '🏭', description: '' });
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
    setPreselectedDept('');
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
    setPreselectedDept(deptName);
    setRoleForm({ role_name: '', department: deptName, description: '', skill_level: 'Mid-level' });
    setShowAddRole(true);
  };

  const openEditRole = (role) => {
    setRoleForm({ role_name: role.role_name, department: role.department, description: role.description || '', skill_level: role.skill_level || 'Mid-level' });
    setEditingRole(role);
  };

  const openEditDept = (dept) => {
    setDeptForm({ name: dept.name, color: dept.color || '#64748b', icon: dept.icon || '🏭', description: dept.description || '' });
    setEditingDept(dept);
  };

  const toggleDept = (id) => setExpandedDepts(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Color presets ─────────────────────────────────────────────────────────
  const colorPresets = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#64748b'];
  const iconPresets  = ['🏭', '🔩', '⚡', '📋', '💻', '✅', '📦', '🔧', '⚙️', '🛠️'];

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '24px', background: '#f1f5f9', minHeight: '100vh', boxSizing: 'border-box' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            PRODUCTION ROLES MANAGEMENT
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Manage manufacturing departments and operational job roles.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setDeptForm({ name: '', color: '#64748b', icon: '🏭', description: '' }); setShowAddDept(true); }}
            style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
            + Add Department
          </button>
          <button onClick={() => openAddRole()}
            style={{ padding: '8px 16px', background: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
            + Add Role
          </button>
        </div>
      </div>

      {/* ── STATS ROW ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Departments', value: departments.length, color: '#0f172a' },
          { label: 'Total Roles', value: totalRoles, color: '#3b82f6' },
          { label: 'Active Roles', value: totalRoles, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px', minWidth: 140 }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── SEARCH ─────────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '14px', color: '#94a3b8' }}>🔍</span>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search departments or roles…"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', color: '#0f172a', background: 'transparent' }}
        />
        {searchQuery && <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>✕</button>}
      </div>

      {/* ── DEPARTMENT CARDS ───────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '13px' }}>Loading departments…</div>
      ) : filteredDepts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '13px' }}>No departments found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredDepts.map(dept => {
            const deptRoles = (rolesByDept[dept.name] || []).filter(r =>
              !searchQuery.trim() ||
              r.role_name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            const isExpanded = expandedDepts[dept.id] !== false;
            const deptColor = dept.color || '#64748b';

            return (
              <div key={dept.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                {/* Department Header */}
                <div
                  onClick={() => toggleDept(dept.id)}
                  style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', cursor: 'pointer', borderLeft: `4px solid ${deptColor}`, gap: '12px', userSelect: 'none' }}>
                  <span style={{ fontSize: '18px' }}>{dept.icon || '🏭'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{dept.name}</div>
                    {dept.description && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{dept.description}</div>}
                  </div>
                  <span style={{
                    background: deptColor + '20', color: deptColor,
                    padding: '3px 10px', borderRadius: '12px',
                    fontSize: '11px', fontWeight: 700,
                  }}>{deptRoles.length} {deptRoles.length === 1 ? 'Role' : 'Roles'}</span>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openAddRole(dept.name)}
                      style={{ padding: '4px 10px', fontSize: '11px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                      + Role
                    </button>
                    <button onClick={() => openEditDept(dept)}
                      style={{ padding: '4px 10px', fontSize: '11px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                      Edit
                    </button>
                    <button onClick={() => setConfirmDelete({ type: 'dept', item: dept })}
                      style={{ padding: '4px 10px', fontSize: '11px', background: '#fff', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}>
                      Archive
                    </button>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '4px' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Role Rows */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9' }}>
                    {deptRoles.length === 0 ? (
                      <div style={{ padding: '20px 24px', color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                        No roles defined. <button onClick={() => openAddRole(dept.name)} style={{ border: 'none', background: 'none', color: deptColor, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '12px' }}>Add one →</button>
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '8px 24px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', fontWeight: 700 }}>Role Name</th>
                            <th style={{ padding: '8px 12px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', fontWeight: 700 }}>Skill Level</th>
                            <th style={{ padding: '8px 12px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', fontWeight: 700 }}>Description</th>
                            <th style={{ padding: '8px 16px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', fontWeight: 700 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deptRoles.map((role, idx) => (
                            <tr key={role.id} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{ padding: '10px 24px' }}>
                                <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{role.role_name}</div>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <SkillBadge level={role.skill_level} />
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b', maxWidth: '280px' }}>
                                {role.description || '—'}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button onClick={() => openEditRole(role)}
                                    style={{ padding: '3px 10px', fontSize: '11px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                                    Edit
                                  </button>
                                  <button onClick={() => setConfirmDelete({ type: 'role', item: role })}
                                    style={{ padding: '3px 10px', fontSize: '11px', background: '#fff', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}>
                                    Archive
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ ADD/EDIT DEPARTMENT MODAL ══════════════════════════════════════════ */}
      {(showAddDept || editingDept) && (
        <Modal
          title={editingDept ? `Edit Department: ${editingDept.name}` : 'New Department'}
          headerColor="#0f172a"
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
            <div style={{ display: 'flex', gap: '16px' }}>
              <Field label="Department Icon">
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  {iconPresets.map(ic => (
                    <button key={ic} type="button" onClick={() => setDeptForm({ ...deptForm, icon: ic })}
                      style={{ width: 36, height: 36, borderRadius: '6px', border: `2px solid ${deptForm.icon === ic ? '#0f172a' : '#e2e8f0'}`, fontSize: '18px', cursor: 'pointer', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Accent Color">
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {colorPresets.map(c => (
                    <button key={c} type="button" onClick={() => setDeptForm({ ...deptForm, color: c })}
                      style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${deptForm.color === c ? '#0f172a' : 'transparent'}`, background: c, cursor: 'pointer' }} />
                  ))}
                </div>
              </Field>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={() => { setShowAddDept(false); setEditingDept(null); }}
                style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button type="submit"
                style={{ flex: 1, padding: '10px', background: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                {editingDept ? 'Save Changes' : 'Create Department'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══ ADD/EDIT ROLE MODAL ════════════════════════════════════════════════ */}
      {(showAddRole || editingRole) && (
        <Modal
          title={editingRole ? `Edit Role: ${editingRole.role_name}` : 'Add New Role'}
          headerColor="#1e3a5f"
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
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {SKILL_LEVELS.map(level => (
                  <button key={level} type="button" onClick={() => setRoleForm({ ...roleForm, skill_level: level })}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', border: '1px solid',
                      borderColor: roleForm.skill_level === level ? '#0f172a' : '#e2e8f0',
                      background: roleForm.skill_level === level ? '#0f172a' : '#fff',
                      color: roleForm.skill_level === level ? '#fff' : '#475569',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
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
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={() => { setShowAddRole(false); setEditingRole(null); }}
                style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button type="submit"
                style={{ flex: 1, padding: '10px', background: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                {editingRole ? 'Save Changes' : 'Add Role'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══ CONFIRM ARCHIVE ════════════════════════════════════════════════════ */}
      {confirmDelete && (
        <Confirm
          message={
            confirmDelete.type === 'dept'
              ? `Archive department "${confirmDelete.item.name}"? All roles within it will remain in the database but the department will be hidden.`
              : `Archive role "${confirmDelete.item.role_name}"? This will hide it from the system but preserve audit history.`
          }
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default ProductionRolesPage;
