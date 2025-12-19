import React, { useState } from "react";

export interface ConnectionConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    database?: string;
}

interface ConnectionManagerProps {
    connections: ConnectionConfig[];
    onAdd: (config: Omit<ConnectionConfig, "id">) => void;
    onConnect: (id: string) => void;
    onDelete: (id: string) => void;
    onDisconnect: () => void;
    isConnected: boolean;
    currentConnection?: string;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
    onAdd,
    // Other props are unused in this component but required by interface
    connections: _connections,
    onConnect: _onConnect,
    onDelete: _onDelete,
    onDisconnect: _onDisconnect,
    isConnected: _isConnected,
    currentConnection: _currentConnection,
}) => {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        host: "localhost",
        port: 5432,
        username: "",
        password: "",
        database: "",
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd(formData);
        setShowForm(false);
        setFormData({
            name: "",
            host: "localhost",
            port: 5432,
            username: "",
            password: "",
            database: "",
        });
    };

    // 暴露方法给父组件使用
    React.useEffect(() => {
        (window as any).showConnectionForm = () => setShowForm(true);
    }, []);

    return (
        <div className="space-y-4">
            {/* 表单直接显示，但由父组件的按钮控制 */}
            <div className={showForm ? "block" : "hidden"}>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-3">创建新连接</h3>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <input
                            type="text"
                            placeholder="连接名称（如：本地开发）"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className="input-field"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="text"
                                placeholder="主机地址"
                                value={formData.host}
                                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                required
                                className="input-field"
                            />
                            <input
                                type="number"
                                placeholder="端口"
                                value={formData.port}
                                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                                required
                                className="input-field"
                            />
                        </div>
                        <input
                            type="text"
                            placeholder="用户名（可选）"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="input-field"
                        />
                        <input
                            type="password"
                            placeholder="密码（可选）"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="input-field"
                        />
                        <input
                            type="text"
                            placeholder="默认数据库（可选）"
                            value={formData.database}
                            onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                            className="input-field"
                        />
                        <div className="flex gap-2 pt-2">
                            <button type="submit" className="btn-primary flex-1">
                                创建连接
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="btn-secondary"
                            >
                                取消
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* 隐藏的元素，用于全局方法 */}
            <div className="hidden">
                <button
                    className="connection-manager-add-btn"
                    onClick={() => setShowForm(true)}
                />
            </div>
        </div>
    );
};
