import React, { useState, useEffect } from "react";
import {
    getQualityChecksByMachine,
    addQualityCheck,
    deleteQualityCheck,
    updateQualityCheck,
} from "../services/firebaseService";
import { useMachine } from "../context/MachineContext";
import { styles } from "../utils/styles";

const QualityChecksModule = () => {
    const { selectedMachineId } = useMachine();
    const [checks, setChecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
    });

    useEffect(() => {
        if (selectedMachineId) {
            fetchChecks();
        }
    }, [selectedMachineId]);

    const fetchChecks = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getQualityChecksByMachine(selectedMachineId);
            setChecks(data);
        } catch (err) {
            setError("Failed to load quality checks: " + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddCheck = async () => {
        if (!formData.name.trim()) {
            setError("Quality check name is required");
            return;
        }

        try {
            setError(null);
            if (editingId) {
                // Update existing check
                await updateQualityCheck(editingId, {
                    name: formData.name,
                    description: formData.description,
                });
                setChecks(
                    checks.map((c) =>
                        c.id === editingId
                            ? {
                                ...c,
                                name: formData.name,
                                description: formData.description,
                            }
                            : c
                    )
                );
                setEditingId(null);
            } else {
                // Add new check
                const newCheck = await addQualityCheck(selectedMachineId, formData);
                setChecks([newCheck, ...checks]);
            }
            setFormData({
                name: "",
                description: "",
            });
            setShowForm(false);
        } catch (err) {
            setError("Failed to save quality check: " + err.message);
            console.error(err);
        }
    };

    const handleEditCheck = (check) => {
        setFormData({
            name: check.name,
            description: check.description,
        });
        setEditingId(check.id);
        setShowForm(true);
    };

    const handleDeleteCheck = async (checkId) => {
        if (!window.confirm("Are you sure you want to delete this quality check?")) {
            return;
        }

        try {
            setError(null);
            await deleteQualityCheck(checkId);
            setChecks(checks.filter((c) => c.id !== checkId));
        } catch (err) {
            setError("Failed to delete quality check: " + err.message);
            console.error(err);
        }
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({
            name: "",
            description: "",
        });
    };

    if (loading) {
        return <div style={styles.container}>Loading quality checks...</div>;
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
                    <h2>{editingId ? "Edit Quality Check" : "Add New Quality Check"}</h2>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Check Name *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="e.g., Temperature Calibration"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Quality check description..."
                            style={styles.textarea}
                        />
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            onClick={handleAddCheck}
                            style={{
                                ...styles.button,
                                backgroundColor: "#28a745",
                                flex: 1,
                            }}
                        >
                            {editingId ? "Update Check" : "Add Check"}
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
                            backgroundColor: "#28a745",
                            fontSize: "16px",
                        }}
                    >
                        + Add Quality Check
                    </button>
                </div>
            )}

            {/* Quality Checks Cards */}
            {checks.length > 0 ? (
                <div style={styles.cardContainer}>
                    {checks.map((check) => (
                        <div
                            key={check.id}
                            style={{
                                ...styles.card,
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <h3 style={{ marginTop: 0 }}>{check.name}</h3>
                            {check.description && (
                                <p style={{ color: "#666", flex: 1 }}>
                                    {check.description}
                                </p>
                            )}
                            <p style={{ color: "#999", fontSize: "12px", margin: "10px 0 0 0" }}>
                                Created: {new Date(check.createdAt?.toDate?.() || check.createdAt).toLocaleDateString()}
                            </p>
                            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                                <button
                                    onClick={() => handleEditCheck(check)}
                                    style={{
                                        ...styles.button,
                                        backgroundColor: "#ffc107",
                                        color: "black",
                                        flex: 1,
                                        padding: "8px 12px",
                                        fontSize: "14px",
                                    }}
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDeleteCheck(check.id)}
                                    style={{
                                        ...styles.button,
                                        backgroundColor: "#dc3545",
                                        flex: 1,
                                        padding: "8px 12px",
                                        fontSize: "14px",
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={styles.emptyState}>
                    <p>No quality checks yet. Add your first quality check to get started!</p>
                </div>
            )}
        </div>
    );
};

export default QualityChecksModule;
