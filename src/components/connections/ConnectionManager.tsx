import React, { useState } from "react";
import { DatabaseIcon, Trash2Icon } from "../ui/icons";
import { cn } from "../../lib/utils";

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
    connections,
    onAdd,
    onConnect,
    onDelete,
    onDisconnect,
    isConnected,
    currentConnection,
}) => {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        host: "localhost",
        port: 27017,
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
            port: 27017,
            username: "",
            password: "",
            database: "",
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">连接管理</h2>
                <div className="flex gap-2">
                    {isConnected && (
                        <button
                            onClick={onDisconnect}
                            className="btn-danger text-xs px-3 py-1.5"
                        >
                            断开
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={cn("btn-primary text-xs px-3 py-1.5", showForm && "hidden")}
                    >
                        {showForm ? '关闭' : '+ 新建'}
                    </button>
                </div>
            </div>

            {/* 新建连接表单 */}
            {showForm && (
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
            )}

            {/* 连接列表 */}
            <div className="space-y-2">
                {connections.map((conn) => {
                    const isActive = isConnected && currentConnection === conn.id;
                    return (
                        <div
                            key={conn.id}
                            className={cn(
                                "border rounded-lg p-3 transition-all cursor-pointer",
                                isActive
                                    ? "border-blue-500 bg-blue-50 shadow-sm"
                                    : "border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white"
                            )}
                            onClick={() => !isConnected && onConnect(conn.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn("font-semibold", isActive ? "text-blue-700" : "text-gray-800")}>
                                            {conn.name}
                                        </span>
                                        {isActive && (
                                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                                连接中
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{conn.host}:{conn.port}</span>
                                        {conn.database && <span>• {conn.database}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {!isActive && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(conn.id);
                                            }}
                                            className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                            title="删除连接"
                                        >
                                            <Trash2Icon className="w-4 h-4" />
                                        </button>
                                    )}
                                    {isActive && (
                                        <span className="text-xs text-blue-600 font-medium">当前连接</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {connections.length === 0 && !showForm && (
                    <div className="text-center py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                        <DatabaseIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p className="text-gray-500 text-sm">暂无连接，请创建新连接</p>
                    </div>
                )}
            </div>
        </div>
    );
};
