import React, { useState, useEffect } from "react";
import { cn } from "../../lib/utils";

interface QueryTemplate {
    id: string;
    name: string;
    query: string;
    category: string;
}

interface QueryTemplatesProps {
    onSelectQuery: (query: string) => void;
    onAddTemplate?: (template: Omit<QueryTemplate, "id">) => void;
    onSetTemplateQuery?: (query: string) => void;
}

export const QueryTemplates: React.FC<QueryTemplatesProps> = ({
    onSelectQuery,
    onAddTemplate,
}) => {
    const [templates, setTemplates] = useState<QueryTemplate[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [newTemplate, setNewTemplate] = useState({
        name: "",
        query: "",
        category: "通用",
    });

    // 从本地存储加载模板
    useEffect(() => {
        const saved = localStorage.getItem("query-templates");
        if (saved) {
            try {
                const savedTemplates = JSON.parse(saved);
                setTemplates(savedTemplates);
            } catch (e) {
                console.error("Failed to parse saved templates:", e);
            }
        }
    }, []);

    // 保存模板到本地存储
    useEffect(() => {
        if (templates.length > 0) {
            localStorage.setItem("query-templates", JSON.stringify(templates));
        }
    }, [templates]);

    // 预设的常用查询模板
    const defaultTemplates: QueryTemplate[] = [
        {
            id: "1",
            name: "查询所有表",
            query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';",
            category: "信息查询",
        },
        {
            id: "2",
            name: "查询表结构",
            query: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'your_table';",
            category: "信息查询",
        },
        {
            id: "3",
            name: "查询前100条",
            query: "SELECT * FROM \"table_name\" LIMIT 100;",
            category: "常用",
        },
        {
            id: "4",
            name: "统计行数",
            query: "SELECT COUNT(*) FROM \"table_name\";",
            category: "常用",
        },
        {
            id: "5",
            name: "查询唯一值",
            query: "SELECT DISTINCT column_name FROM \"table_name\";",
            category: "常用",
        },
        {
            id: "6",
            name: "按条件排序",
            query: "SELECT * FROM \"table_name\" ORDER BY column_name DESC LIMIT 100;",
            category: "常用",
        },
    ];

    const handleAddTemplate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTemplate.name && newTemplate.query) {
            const template: QueryTemplate = {
                id: Date.now().toString(),
                name: newTemplate.name,
                query: newTemplate.query,
                category: newTemplate.category || "自定义",
            };
            setTemplates([...templates, template]);
            setNewTemplate({ name: "", query: "", category: "通用" });
            setShowForm(false);
        }
    };

    const handleDeleteTemplate = (id: string) => {
        setTemplates(templates.filter(t => t.id !== id));
    };

    const getCategories = () => {
        const allTemplates = [...defaultTemplates, ...templates];
        const categories = Array.from(new Set(allTemplates.map(t => t.category)));
        return categories;
    };

    const getTemplatesByCategory = (category: string) => {
        const allTemplates = [...defaultTemplates, ...templates];
        return allTemplates.filter(t => t.category === category);
    };

    return (
        <div className="space-y-2">
            {/* 头部 - 更紧凑的设计 */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg p-3 text-white shadow-md">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="font-semibold text-sm">查询模板</span>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors flex items-center gap-1 border border-white/20"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {showForm ? "关闭" : "添加"}
                </button>
            </div>

            {/* 添加模板表单 - 优化布局 */}
            {showForm && (
                <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
                    <form onSubmit={handleAddTemplate} className="space-y-2">
                        <div className="space-y-1">
                            <input
                                type="text"
                                placeholder="模板名称"
                                value={newTemplate.name}
                                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                            <textarea
                                placeholder="SQL查询语句"
                                value={newTemplate.query}
                                onChange={(e) => setNewTemplate({ ...newTemplate, query: e.target.value })}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none h-24 font-mono text-xs"
                                required
                            />
                            <input
                                type="text"
                                placeholder="分类（可选，默认：自定义）"
                                value={newTemplate.category}
                                onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded font-medium transition-colors shadow-sm"
                            >
                                保存
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-1.5 rounded font-medium transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 模板列表 - 优化分组显示 */}
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                {getCategories().map((category) => (
                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                        {/* 分类标题 - 更紧凑 */}
                        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 text-xs font-semibold text-gray-700 flex items-center justify-between hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                                // 可以在这里添加展开/折叠功能
                            }}>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                <span>{category}</span>
                            </div>
                            <span className="text-gray-400 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                                {getTemplatesByCategory(category).length}
                            </span>
                        </div>

                        {/* 模板项 - 更紧凑的列表 */}
                        <div className="divide-y divide-gray-100">
                            {getTemplatesByCategory(category).map((template) => (
                                <div
                                    key={template.id}
                                    className="group flex items-center justify-between px-3 py-2 hover:bg-blue-50 transition-colors cursor-pointer"
                                >
                                    <div
                                        className="flex-1 min-w-0"
                                        onClick={() => onSelectQuery(template.query)}
                                    >
                                        <div className="text-xs font-medium text-gray-800 truncate">{template.name}</div>
                                        <div className="text-[10px] text-gray-500 font-mono truncate mt-0.5 opacity-75">
                                            {template.query}
                                        </div>
                                    </div>
                                    {/* 删除按钮 - 只显示自定义模板 */}
                                    {templates.some(t => t.id === template.id) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTemplate(template.id);
                                            }}
                                            className="ml-2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-all"
                                            title="删除模板"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {templates.length === 0 && getCategories().length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-300 rounded-lg bg-gray-50">
                        <div className="text-2xl mb-2">📋</div>
                        暂无模板，点击"添加"创建常用查询
                    </div>
                )}
            </div>

            {/* 统计信息 - 更简洁的显示 */}
            <div className="flex items-center justify-between text-[10px] text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-200">
                <span>总计: <strong className="text-gray-700">{defaultTemplates.length + templates.length}</strong> 个</span>
                <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">预设: {defaultTemplates.length}</span>
                    <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">自定义: {templates.length}</span>
                </div>
            </div>
        </div>
    );
};
