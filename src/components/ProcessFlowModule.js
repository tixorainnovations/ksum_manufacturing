import React, { useState, useEffect } from "react";
import {
    getProcessFlowsByMachine,
    getProcessStepsByFlow,
    addProcessFlow,
    addProcessStep,
    deleteProcessFlow,
    deleteProcessStep,
    updateProcessStep,
    getComponentsByMachine,
} from "../services/firebaseService";
import { useMachine } from "../context/MachineContext";
import { styles } from "../utils/styles";

const ProcessFlowModule = () => {
    const { selectedMachineId } = useMachine();
    const [flows, setFlows] = useState([]);
    const [selectedFlowId, setSelectedFlowId] = useState(null);
    const [steps, setSteps] = useState([]);
    const [components, setComponents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showFlowForm, setShowFlowForm] = useState(false);
    const [showStepForm, setShowStepForm] = useState(false);
    const [flowName, setFlowName] = useState("");
    const [editingStepId, setEditingStepId] = useState(null);

    const [stepFormData, setStepFormData] = useState({
        stepName: "",
        order: 1,
        components: [],
        instructions: "",
    });

    useEffect(() => {
        if (selectedMachineId) {
            fetchData();
        }
    }, [selectedMachineId]);

    useEffect(() => {
        if (selectedFlowId) {
            fetchSteps();
        }
    }, [selectedFlowId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [flowsData, componentsData] = await Promise.all([
                getProcessFlowsByMachine(selectedMachineId),
                getComponentsByMachine(selectedMachineId),
            ]);
            setFlows(flowsData);
            setComponents(componentsData);
            if (flowsData.length > 0) {
                setSelectedFlowId(flowsData[0].id);
            }
        } catch (err) {
            setError("Failed to load data: " + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSteps = async () => {
        try {
            const stepsData = await getProcessStepsByFlow(selectedFlowId);
            setSteps(stepsData);
        } catch (err) {
            setError("Failed to load steps: " + err.message);
            console.error(err);
        }
    };

    const handleAddFlow = async () => {
        if (!flowName.trim()) {
            setError("Flow name is required");
            return;
        }

        try {
            setError(null);
            const newFlow = await addProcessFlow(selectedMachineId, flowName.trim());
            setFlows([newFlow, ...flows]);
            setFlowName("");
            setShowFlowForm(false);
            setSelectedFlowId(newFlow.id);
        } catch (err) {
            setError("Failed to add flow: " + err.message);
            console.error(err);
        }
    };

    const handleDeleteFlow = async (flowId) => {
        if (!window.confirm("Delete this flow and all its steps?")) {
            return;
        }

        try {
            setError(null);
            await deleteProcessFlow(flowId);
            const newFlows = flows.filter((f) => f.id !== flowId);
            setFlows(newFlows);
            setSelectedFlowId(newFlows.length > 0 ? newFlows[0].id : null);
            setSteps([]);
        } catch (err) {
            setError("Failed to delete flow: " + err.message);
            console.error(err);
        }
    };

    const handleAddStep = async () => {
        if (!stepFormData.stepName.trim() || !selectedFlowId) {
            setError("Step name and selected flow are required");
            return;
        }

        try {
            setError(null);
            if (editingStepId) {
                // Update existing step
                await updateProcessStep(editingStepId, {
                    stepName: stepFormData.stepName,
                    order: stepFormData.order,
                    components: stepFormData.components,
                    instructions: stepFormData.instructions,
                });
                await fetchSteps();
                setEditingStepId(null);
            } else {
                // Add new step
                await addProcessStep(selectedFlowId, stepFormData);
                await fetchSteps();
            }
            setStepFormData({
                stepName: "",
                order: steps.length + 1,
                components: [],
                instructions: "",
            });
            setShowStepForm(false);
        } catch (err) {
            setError("Failed to save step: " + err.message);
            console.error(err);
        }
    };

    const handleEditStep = (step) => {
        setStepFormData(step);
        setEditingStepId(step.id);
        setShowStepForm(true);
    };

    const handleDeleteStep = async (stepId) => {
        if (!window.confirm("Delete this step?")) {
            return;
        }

        try {
            setError(null);
            await deleteProcessStep(stepId);
            setSteps(steps.filter((s) => s.id !== stepId));
        } catch (err) {
            setError("Failed to delete step: " + err.message);
            console.error(err);
        }
    };

    const handleComponentToggle = (componentId) => {
        setStepFormData((prev) => ({
            ...prev,
            components: prev.components.includes(componentId)
                ? prev.components.filter((id) => id !== componentId)
                : [...prev.components, componentId],
        }));
    };

    if (loading) {
        return <div style={styles.container}>Loading process flows...</div>;
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

            {/* Flows Section */}
            <div style={{ marginBottom: "40px" }}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "20px",
                    }}
                >
                    <h2>Process Flows</h2>
                    <button
                        onClick={() => setShowFlowForm(true)}
                        style={{
                            ...styles.button,
                            backgroundColor: "#007bff",
                        }}
                    >
                        + Add Flow
                    </button>
                </div>

                {showFlowForm && (
                    <div style={styles.form}>
                        <h3>Create New Flow</h3>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Flow Name *</label>
                            <input
                                type="text"
                                value={flowName}
                                onChange={(e) => setFlowName(e.target.value)}
                                placeholder="e.g., Standard Production Flow"
                                style={styles.input}
                            />
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                onClick={handleAddFlow}
                                style={{
                                    ...styles.button,
                                    backgroundColor: "#28a745",
                                    flex: 1,
                                }}
                            >
                                Create Flow
                            </button>
                            <button
                                onClick={() => {
                                    setShowFlowForm(false);
                                    setFlowName("");
                                }}
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
                )}

                {flows.length > 0 ? (
                    <div style={styles.cardContainer}>
                        {flows.map((flow) => (
                            <div
                                key={flow.id}
                                style={{
                                    ...styles.card,
                                    border:
                                        selectedFlowId === flow.id
                                            ? "2px solid #007bff"
                                            : "1px solid #e0e0e0",
                                    backgroundColor:
                                        selectedFlowId === flow.id ? "#f0f8ff" : "white",
                                }}
                                onClick={() => setSelectedFlowId(flow.id)}
                            >
                                <h3 style={{ marginTop: 0 }}>{flow.name}</h3>
                                <p style={{ color: "#666", fontSize: "13px" }}>
                                    Steps: {steps.filter((s) => s.flowId === flow.id).length}
                                </p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteFlow(flow.id);
                                    }}
                                    style={{
                                        ...styles.button,
                                        backgroundColor: "#dc3545",
                                        width: "100%",
                                    }}
                                >
                                    Delete Flow
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={styles.emptyState}>
                        <p>No process flows yet. Create one to get started!</p>
                    </div>
                )}
            </div>

            {/* Steps Section */}
            {selectedFlowId && (
                <div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "20px",
                        }}
                    >
                        <h2>Process Steps</h2>
                        <button
                            onClick={() => setShowStepForm(true)}
                            style={{
                                ...styles.button,
                                backgroundColor: "#007bff",
                            }}
                        >
                            + Add Step
                        </button>
                    </div>

                    {showStepForm && (
                        <div style={styles.form}>
                            <h3>{editingStepId ? "Edit Step" : "Add New Step"}</h3>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Step Name *</label>
                                <input
                                    type="text"
                                    value={stepFormData.stepName}
                                    onChange={(e) =>
                                        setStepFormData({ ...stepFormData, stepName: e.target.value })
                                    }
                                    placeholder="e.g., Material Loading"
                                    style={styles.input}
                                />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Order</label>
                                <input
                                    type="number"
                                    value={stepFormData.order}
                                    onChange={(e) =>
                                        setStepFormData({
                                            ...stepFormData,
                                            order: parseInt(e.target.value),
                                        })
                                    }
                                    style={styles.input}
                                    min="1"
                                />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Instructions</label>
                                <textarea
                                    value={stepFormData.instructions}
                                    onChange={(e) =>
                                        setStepFormData({
                                            ...stepFormData,
                                            instructions: e.target.value,
                                        })
                                    }
                                    placeholder="Step instructions..."
                                    style={styles.textarea}
                                />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Components</label>
                                {components.length > 0 ? (
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                                            gap: "10px",
                                            marginTop: "10px",
                                        }}
                                    >
                                        {components.map((component) => (
                                            <label
                                                key={component.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    cursor: "pointer",
                                                    padding: "10px",
                                                    border: "1px solid #ddd",
                                                    borderRadius: "6px",
                                                    backgroundColor: stepFormData.components.includes(
                                                        component.id
                                                    )
                                                        ? "#d4edda"
                                                        : "white",
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={stepFormData.components.includes(
                                                        component.id
                                                    )}
                                                    onChange={() => handleComponentToggle(component.id)}
                                                    style={{ marginRight: "8px" }}
                                                />
                                                {component.name}
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: "#999" }}>No components available</p>
                                )}
                            </div>

                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    onClick={handleAddStep}
                                    style={{
                                        ...styles.button,
                                        backgroundColor: "#28a745",
                                        flex: 1,
                                    }}
                                >
                                    {editingStepId ? "Update Step" : "Add Step"}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowStepForm(false);
                                        setEditingStepId(null);
                                        setStepFormData({
                                            stepName: "",
                                            order: steps.length + 1,
                                            components: [],
                                            instructions: "",
                                        });
                                    }}
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
                    )}

                    {steps.length > 0 ? (
                        <div>
                            {steps.map((step) => (
                                <div
                                    key={step.id}
                                    style={{
                                        ...styles.card,
                                        marginBottom: "20px",
                                        borderLeft: "4px solid #007bff",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "start",
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <span
                                                    style={{
                                                        ...styles.badge,
                                                        backgroundColor: "#007bff",
                                                        color: "white",
                                                        fontSize: "16px",
                                                        padding: "8px 12px",
                                                    }}
                                                >
                                                    Step {step.order}
                                                </span>
                                                <h3 style={{ margin: 0 }}>{step.stepName}</h3>
                                            </div>
                                            {step.instructions && (
                                                <p style={{ marginTop: "10px", color: "#666" }}>
                                                    <strong>Instructions:</strong> {step.instructions}
                                                </p>
                                            )}
                                            {step.components && step.components.length > 0 && (
                                                <div style={{ marginTop: "10px" }}>
                                                    <strong>Components:</strong>
                                                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "5px" }}>
                                                        {step.components.map((compId) => {
                                                            const comp = components.find((c) => c.id === compId);
                                                            return (
                                                                <span
                                                                    key={compId}
                                                                    style={{
                                                                        ...styles.badge,
                                                                        backgroundColor: "#e7f3ff",
                                                                        color: "#0056b3",
                                                                    }}
                                                                >
                                                                    {comp?.name || compId}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", gap: "5px" }}>
                                            <button
                                                onClick={() => handleEditStep(step)}
                                                style={{
                                                    ...styles.button,
                                                    backgroundColor: "#ffc107",
                                                    color: "black",
                                                    padding: "6px 12px",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStep(step.id)}
                                                style={{
                                                    ...styles.button,
                                                    backgroundColor: "#dc3545",
                                                    padding: "6px 12px",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={styles.emptyState}>
                            <p>No steps in this flow. Add a step to get started!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProcessFlowModule;
