import React, { useState } from "react";
import { cn } from "../../lib/utils";
import { ConnectionConfig } from "./ConnectionManager";

interface ConnectionFormProps {
    onSubmit: (config: Omit<ConnectionConfig, "id">) => void;
    onCancel: () => void;
    loading?: boolean;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
    onSubmit,
    onCancel,
    loading = false,
}) => {
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
        if (formData.name && formData.host && formData.username) {
            onSubmit(formData);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "number" ? Number(value) : value,
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* 头部 */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        新建数据库连接
                    </h3>
                </div>

                {/* 表单内容 */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* 连接名称 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            连接名称
                        </label>
                        <input
                            type="text"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="例如：生产数据库"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* 主机和端口 */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                主机
                            </label>
                            <input
                                type="text"
                                name="host"
                                required
                                value={formData.host}
                                onChange={handleChange}
                                placeholder="localhost"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div className="w-24">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                端口
                            </label>
                            <input
                                type="number"
                                name="port"
                                required
                                value={formData.port}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    {/* 数据库名称 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            数据库名称
                            <span className="ml-2 text-xs text-gray-500 font-normal">(可选，默认使用 postgres)</span>
                        </label>
                        <input
                            type="text"
                            name="database"
                            value={formData.database}
                            onChange={handleChange}
                            placeholder="postgres"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* 用户名 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            用户名
                        </label>
                        <input
                            type="text"
                            name="username"
                            required
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="postgres"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* 密码 */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            密码
                        </label>
                        <input
                            type="password"
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="输入密码"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* 按钮组 */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                "flex-1 px-4 py-2 font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2",
                                loading
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
                            )}
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin">⟳</span>
                                    保存中...
                                </>
                            ) : (
                                "保存连接"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
