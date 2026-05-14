import React from "react";
import { styles } from "../utils/styles";

const Sidebar = ({ activeTab, setActiveTab }) => {
    const menuItems = [
        { id: "components", label: "📦 Components", icon: "📦" },
        { id: "processes", label: "🔄 Process Flows", icon: "🔄" },
        { id: "quality", label: "✅ Quality Checks", icon: "✅" },
    ];

    return (
        <div style={styles.sidebar}>
            <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Dashboard</h3>
            <nav>
                <ul style={styles.sidebarNav}>
                    {menuItems.map((item) => (
                        <li
                            key={item.id}
                            style={{
                                ...styles.sidebarNavItem,
                                ...(activeTab === item.id ? styles.sidebarNavItemActive : {}),
                            }}
                            onClick={() => setActiveTab(item.id)}
                        >
                            {item.label}
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
};

export default Sidebar;
