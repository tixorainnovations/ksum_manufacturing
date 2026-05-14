import React, { createContext, useState, useContext } from "react";

const MachineContext = createContext();

export const MachineProvider = ({ children }) => {
    const [selectedMachineId, setSelectedMachineId] = useState(null);
    const [selectedMachine, setSelectedMachine] = useState(null);

    const selectMachine = (machineId, machineData) => {
        setSelectedMachineId(machineId);
        setSelectedMachine(machineData);
    };

    const clearSelectedMachine = () => {
        setSelectedMachineId(null);
        setSelectedMachine(null);
    };

    return (
        <MachineContext.Provider
            value={{
                selectedMachineId,
                selectedMachine,
                selectMachine,
                clearSelectedMachine,
            }}
        >
            {children}
        </MachineContext.Provider>
    );
};

export const useMachine = () => {
    const context = useContext(MachineContext);
    if (!context) {
        throw new Error("useMachine must be used within MachineProvider");
    }
    return context;
};
