import React, { useState, useEffect } from "react";
import {
    getComponentsByMachine,
    addComponent,
    deleteComponent,
    updateComponent,
} from "../services/firebaseService";
import { useMachine } from "../context/MachineContext";
import { styles } from "../utils/styles";

const ComponentsModule = () => {
    const { selectedMachineId } = useMachine();
    const [components, setComponents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [filterType, setFilterType] = useState("all");
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: "",
        type: "mechanical",
        description: "",
        imageUrl: "",
    });

    const fetchComponents = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getComponentsByMachine(selectedMachineId);
            setComponents(data);
        } catch (err) {
            setError("Failed to load components: " + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedMachineId) {
            fetchComponents();
        }
    }, [selectedMachineId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddComponent = async () => {
        if (!formData.name.trim()) {
            setError("Component name is required");
            return;
        }

        try {
            setError(null);
            if (editingId) {
                // Update existing component
                await updateComponent(editingId, {
                    name: formData.name,
                    type: formData.type,
                    description: formData.description,
                    imageUrl: formData.imageUrl,
                });
                setComponents(
                    components.map((c) =>
                        c.id === editingId
                            ? {
                                ...c,
                                name: formData.name,
                                type: formData.type,
                                description: formData.description,
                                imageUrl: formData.imageUrl,
                            }
                            : c
                    )
                );
                setEditingId(null);
            } else {
                // Add new component
                const newComponent = await addComponent(selectedMachineId, formData);
                setComponents([newComponent, ...components]);
            }
            setFormData({
                name: "",
                type: "mechanical",
                description: "",
                imageUrl: "",
            });
            setShowForm(false);
        } catch (err) {
            setError("Failed to save component: " + err.message);
            console.error(err);
        }
    };

    const handleEditComponent = (component) => {
        setFormData(component);
        setEditingId(component.id);
        setShowForm(true);
    };

    const handleDeleteComponent = async (componentId) => {
        if (!window.confirm("Are you sure you want to delete this component?")) {
            return;
        }

        try {
            setError(null);
            await deleteComponent(componentId);
            setComponents(components.filter((c) => c.id !== componentId));
        } catch (err) {
            setError("Failed to delete component: " + err.message);
            console.error(err);
        }
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({
            name: "",
            type: "mechanical",
            description: "",
            imageUrl: "",
        });
    };

    const filteredComponents =
        filterType === "all"
            ? components
            : components.filter((c) => c.type === filterType);

    if (loading) {
        return <div style={styles.container}>Loading components...</div>;
    }

    return (
        <div>
            {error && (
                <div style={styles.errorBox}>
                    <p>{error}</p>
                    <button onClick={() => setError(null)} style={styles.button}>
                        Dismiss
                    </button>
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm ? (
                <div style={styles.form}>
                    <h2>{editingId ? "Edit Component" : "Add New Component"}</h2>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Component Name *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="e.g., Heating Element"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Type *</label>
                        <select
                            name="type"
                            value={formData.type}
                            onChange={handleInputChange}
                            style={styles.select}
                        >
                            <option value="mechanical">Mechanical</option>
                            <option value="electrical">Electrical</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Component description..."
                            style={styles.textarea}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Image URL</label>
                        <input
                            type="url"
                            name="imageUrl"
                            value={formData.imageUrl}
                            onChange={handleInputChange}
                            placeholder="https://example.com/image.jpg"
                            style={styles.input}
                        />
                        {formData.imageUrl && (
                            <div style={{ marginTop: "10px" }}>
                                <img
                                    src={formData.imageUrl}
                                    alt="Component"
                                    style={{
                                        maxWidth: "100%",
                                        maxHeight: "150px",
                                        borderRadius: "6px",
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            onClick={handleAddComponent}
                            style={{
                                ...styles.button,
                                backgroundColor: "#28a745",
                                flex: 1,
                            }}
                        >
                            {editingId ? "Update Component" : "Add Component"}
                        </button>
                        <button
                            onClick={handleCancelForm}
                            style={{
                                ...styles.button,
                                backgroundColor: "#6c757d",
                                flex: 1,
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ marginBottom: "30px" }}>
                    <button
                        onClick={() => setShowForm(true)}
                        style={{
                            ...styles.button,
                            backgroundColor: "#007bff",
                            fontSize: "16px",
                        }}
                    >
                        + Add Component
                    </button>
                </div>
            )}

            {/* Filter */}
            {components.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                    <label style={styles.label}>Filter by Type:</label>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        style={styles.select}
                    >
                        <option value="all">All Types</option>
                        <option value="mechanical">Mechanical</option>
                        <option value="electrical">Electrical</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
            )}

            {/* Components Table */}
            {filteredComponents.length > 0 ? (
                <table style={styles.table}>
                    <thead>
                        <tr style={{ backgroundColor: "#f5f5f5" }}>
                            <th style={styles.tableHeader}>Name</th>
                            <th style={styles.tableHeader}>Type</th>
                            <th style={styles.tableHeader}>Description</th>
                            <th style={styles.tableHeader}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredComponents.map((component) => (
                            <tr key={component.id} style={styles.tableRow}>
                                <td style={styles.tableCell}>
                                    <strong>{component.name}</strong>
                                </td>
                                <td style={styles.tableCell}>
                                    <span
                                        style={{
                                            ...styles.badge,
                                            backgroundColor:
                                                component.type === "mechanical"
                                                    ? "#d1ecf1"
                                                    : component.type === "electrical"
                                                        ? "#fff3cd"
                                                        : "#f8f9fa",
                                            color:
                                                component.type === "mechanical"
                                                    ? "#0c5460"
                                                    : component.type === "electrical"
                                                        ? "#856404"
                                                        : "#383d41",
                                        }}
                                    >
                                        {component.type}
                                    </span>
                                </td>
                                <td style={styles.tableCell}>
                                    {component.description || "-"}
                                </td>
                                <td style={styles.tableCell}>
                                    <button
                                        onClick={() => handleEditComponent(component)}
                                        style={{
                                            ...styles.button,
                                            backgroundColor: "#ffc107",
                                            color: "black",
                                            padding: "6px 12px",
                                            fontSize: "13px",
                                            marginRight: "8px",
                                        }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDeleteComponent(component.id)}
                                        style={{
                                            ...styles.button,
                                            backgroundColor: "#dc3545",
                                            padding: "6px 12px",
                                            fontSize: "13px",
                                        }}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div style={styles.emptyState}>
                    <p>No components found. Add your first component to get started!</p>
                </div>
            )}
        </div>
    );
};

export default ComponentsModule;
