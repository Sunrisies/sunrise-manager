import React, { useState, useEffect } from "react";
import { DatabaseIcon, RefreshCwIcon } from "../ui/icons";
import { cn } from "../../lib/utils";

interface Database {
    name: string;
    collections: string[];
}

interface DatabaseBrowserProps {
    databases: Database[];
    loading: boolean;
    onRefresh: () => void;
    onCollectionSelect: (database: string, collection: string) => void;
    selectedDatabase?: string;
    selectedCollection?: string;
}

export const DatabaseBrowser: React.FC<DatabaseBrowserProps> = ({
    databases,
    loading,
    onRefresh,
    onCollectionSelect,
    selectedDatabase,
    selectedCollection,
}) => {
    const [expandedDBs, setExpandedDBs] = useState<Set<string>>(new Set());

    const toggleDatabase = (dbName: string) => {
        const newExpanded = new Set(expandedDBs);
        if (newExpanded.has(dbName)) {
            newExpanded.delete(dbName);
        } else {
            newExpanded.add(dbName);
        }
        setExpandedDBs(newExpanded);
    };

    useEffect(() => {
        // Auto-expand all databases on load
        if (databases.length > 0) {
            const allDBs = new Set(databases.map(db => db.name));
            setExpandedDBs(allDBs);
        }
    }, [databases]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-800">数据库浏览</h2>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className={cn("btn-secondary text-xs px-3 py-1.5", loading && "opacity-50 cursor-not-allowed")}
                >
                    <RefreshCwIcon className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
                    刷新
                </button>
            </div>

            {loading && (
                <div className="text-center py-6 text-gray-500 text-sm">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mb-2"></div>
                    <div>加载中...</div>
                </div>
            )}

            {!loading && databases.length === 0 && (
                <div className="text-center py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                    <DatabaseIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-500 text-sm">暂无数据库</p>
                </div>
            )}

            {!loading && databases.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {databases.map((db) => {
                        const isExpanded = expandedDBs.has(db.name);
                        const isSelected = selectedDatabase === db.name;

                        return (
                            <div key={db.name} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                <div
                                    className={cn(
                                        "flex items-center justify-between p-3 cursor-pointer transition-colors",
                                        isSelected ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50",
                                        isExpanded && "border-b border-gray-200"
                                    )}
                                    onClick={() => toggleDatabase(db.name)}
                                >
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className={cn("font-semibold text-sm", isSelected ? "text-blue-700" : "text-gray-800")}>
                                            {db.name}
                                        </span>
                                        <span className="text-xs text-gray-400">({db.collections.length})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isSelected && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                                                选中
                                            </span>
                                        )}
                                        <span className={cn("text-xs text-gray-400 transition-transform", isExpanded && "rotate-180")}>
                                            ▼
                                        </span>
                                    </div>
                                </div>

                                {isExpanded && db.collections.length > 0 && (
                                    <div className="bg-gray-50 p-1 space-y-1">
                                        {db.collections.map((collection) => {
                                            const isCollectionSelected = isSelected && selectedCollection === collection;

                                            // 处理 schema.table 格式
                                            // 如果是 public.users -> 显示 users
                                            // 如果是 sales.orders -> 显示 orders (sales)
                                            let displayTableName = collection;
                                            let schemaPrefix = "";

                                            if (collection.includes('.')) {
                                                const parts = collection.split('.');
                                                schemaPrefix = parts[0];
                                                displayTableName = parts[1];

                                                // 如果schema是public，不显示前缀
                                                if (schemaPrefix === 'public') {
                                                    schemaPrefix = "";
                                                }
                                            }

                                            return (
                                                <div
                                                    key={collection}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all text-sm",
                                                        isCollectionSelected
                                                            ? "bg-blue-100 text-blue-700 font-medium shadow-sm"
                                                            : "hover:bg-gray-100 text-gray-700"
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCollectionSelect(db.name, collection);
                                                    }}
                                                >
                                                    <span className="text-gray-400">📄</span>
                                                    <span className="flex-1">
                                                        {displayTableName}
                                                        {schemaPrefix && (
                                                            <span className="ml-1 text-xs text-gray-400">({schemaPrefix})</span>
                                                        )}
                                                    </span>
                                                    {isCollectionSelected && (
                                                        <span className="text-xs text-blue-600">✓</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {isExpanded && db.collections.length === 0 && (
                                    <div className="bg-gray-50 p-3 text-center text-xs text-gray-400">
                                        该数据库中没有集合
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
