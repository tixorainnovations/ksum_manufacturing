import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ============================================================================
// PRODUCTION ROLES SERVICE
// Manages manufacturing departments and operational job roles.
// Flutter-ready schema — all fields strictly typed.
// ============================================================================

export const SKILL_LEVELS = ['Trainee', 'Junior', 'Mid-level', 'Senior', 'Lead'];

export const DEFAULT_DEPARTMENTS = [
  {
    name: 'Mechanical Assembly',
    color: '#f59e0b',
    icon: '🔩',
    defaultRoles: [
      { role_name: 'Mechanical Assembly Technician', skill_level: 'Mid-level', description: 'Assembles mechanical sub-systems and structural components.' },
      { role_name: 'Gantry Assembly Operator', skill_level: 'Senior', description: 'Responsible for precision gantry frame assembly and alignment.' },
      { role_name: 'Frame Assembly Technician', skill_level: 'Junior', description: 'Handles frame build, bolting, and structural integrity checks.' },
    ]
  },
  {
    name: 'Electronics',
    color: '#3b82f6',
    icon: '⚡',
    defaultRoles: [
      { role_name: 'Electronics Technician', skill_level: 'Mid-level', description: 'Installs and tests electronic components and control boards.' },
      { role_name: 'Wiring Technician', skill_level: 'Junior', description: 'Performs cable management, crimping, and electrical wiring.' },
      { role_name: 'PCB Integration Operator', skill_level: 'Senior', description: 'Integrates and validates PCBs into the machine control system.' },
    ]
  },
  {
    name: 'Procurement',
    color: '#10b981',
    icon: '📋',
    defaultRoles: [
      { role_name: 'Procurement Executive', skill_level: 'Mid-level', description: 'Sources and purchases materials and components from vendors.' },
      { role_name: 'Vendor Coordinator', skill_level: 'Junior', description: 'Coordinates with vendors for delivery timelines and quality.' },
      { role_name: 'Purchase Manager', skill_level: 'Lead', description: 'Manages purchase orders, budgets, and supplier relationships.' },
    ]
  },
  {
    name: 'Software',
    color: '#8b5cf6',
    icon: '💻',
    defaultRoles: [
      { role_name: 'Firmware Developer', skill_level: 'Senior', description: 'Develops and maintains machine firmware and control logic.' },
      { role_name: 'CNC Software Engineer', skill_level: 'Senior', description: 'Writes G-code post-processors and CNC toolpath software.' },
      { role_name: 'UI/Control System Engineer', skill_level: 'Mid-level', description: 'Builds operator HMI and machine monitoring dashboards.' },
    ]
  },
  {
    name: 'Quality Control',
    color: '#ef4444',
    icon: '✅',
    defaultRoles: [
      { role_name: 'QC Inspector', skill_level: 'Mid-level', description: 'Inspects incoming and outgoing components against specifications.' },
      { role_name: 'Calibration Technician', skill_level: 'Senior', description: 'Calibrates measurement tools and validates machine precision.' },
      { role_name: 'Testing Engineer', skill_level: 'Senior', description: 'Conducts functional tests and documents acceptance criteria.' },
    ]
  },
  {
    name: 'Manufacturing & Fabrication',
    color: '#f97316',
    icon: '🏭',
    defaultRoles: [
      { role_name: 'Laser Cutting Operator', skill_level: 'Mid-level', description: 'Operates laser cutting machines for sheet metal fabrication.' },
      { role_name: '3D Printing Technician', skill_level: 'Junior', description: 'Manages FDM/SLA printers and post-processing of printed parts.' },
      { role_name: 'CNC Machining Operator', skill_level: 'Senior', description: 'Programs and operates CNC mills and lathes for precision parts.' },
    ]
  },
  {
    name: 'Inventory & Logistics',
    color: '#06b6d4',
    icon: '📦',
    defaultRoles: [
      { role_name: 'Inventory Coordinator', skill_level: 'Mid-level', description: 'Tracks stock levels, reorder points, and material flow.' },
      { role_name: 'Dispatch Executive', skill_level: 'Junior', description: 'Manages outbound shipments, packaging, and delivery records.' },
      { role_name: 'Material Handler', skill_level: 'Trainee', description: 'Handles physical movement of materials within the warehouse.' },
    ]
  },
];

export const rolesService = {

  // ── DEPARTMENTS ────────────────────────────────────────────────────────────

  subscribeDepartments: (callback) => {
    const q = query(collection(db, 'production_departments'), orderBy('created_at', 'asc'));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  addDepartment: async (data) => {
    return addDoc(collection(db, 'production_departments'), {
      name: data.name,
      color: data.color || '#64748b',
      icon: data.icon || '🏭',
      description: data.description || '',
      active: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  },

  updateDepartment: async (id, data) => {
    return updateDoc(doc(db, 'production_departments', id), {
      ...data,
      updated_at: serverTimestamp(),
    });
  },

  deleteDepartment: async (id) => {
    return updateDoc(doc(db, 'production_departments', id), {
      active: false,
      updated_at: serverTimestamp(),
    });
  },

  // ── ROLES ──────────────────────────────────────────────────────────────────

  subscribeRoles: (callback) => {
    const q = query(collection(db, 'production_roles'), orderBy('created_at', 'asc'));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  addRole: async (data) => {
    return addDoc(collection(db, 'production_roles'), {
      role_name: data.role_name,
      department: data.department,
      description: data.description || '',
      skill_level: data.skill_level || 'Mid-level',
      active_status: true,
      // Future-ready fields
      assigned_users: [],
      workstation: '',
      shift: '',
      certification_level: '',
      permissions: [],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  },

  updateRole: async (id, data) => {
    return updateDoc(doc(db, 'production_roles', id), {
      ...data,
      updated_at: serverTimestamp(),
    });
  },

  deleteRole: async (id) => {
    return updateDoc(doc(db, 'production_roles', id), {
      active_status: false,
      updated_at: serverTimestamp(),
    });
  },

  // ── SEED ───────────────────────────────────────────────────────────────────
  // Seeds default departments and roles if the system is empty (first run only).
  seedDefaults: async () => {
    const existing = await getDocs(collection(db, 'production_departments'));
    if (!existing.empty) return; // Already seeded

    for (const dept of DEFAULT_DEPARTMENTS) {
      const deptRef = await addDoc(collection(db, 'production_departments'), {
        name: dept.name,
        color: dept.color,
        icon: dept.icon,
        description: '',
        active: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      for (const role of dept.defaultRoles) {
        await addDoc(collection(db, 'production_roles'), {
          role_name: role.role_name,
          department: dept.name,
          department_id: deptRef.id,
          description: role.description,
          skill_level: role.skill_level,
          active_status: true,
          assigned_users: [],
          workstation: '',
          shift: '',
          certification_level: '',
          permissions: [],
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }
    }
  },
};
