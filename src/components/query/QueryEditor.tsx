import React, { useState } from "react";
import { PlayIcon } from "../ui/icons";
import { cn } from "../../lib/utils";

interface QueryEditorProps {
    onExecuteQuery: (query: string) => void;
    loading: boolean;
    database?: string;
    collection?: string;
}

export const QueryEditor: React.FC<QueryEditorProps> = ({
    onExecuteQuery,
    loading,
    database,
    collection,
}) => {
    const [query, setQuery] = useState("");

    const handleExecute = () => {
        if (query.trim()) {
            onExecuteQuery(query.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleExecute();
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-800">查询编辑器</h2>
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {database && collection ? (
                        <span className="font-mono">
                            {/* 显示更简洁的格式：数据库.表名（去掉public.前缀） */}
                            {database}.{collection.includes('.') ? collection.split('.').slice(-1)[0] : collection}
                        </span>
                    ) : (
                        <span className="italic">未选择表</span>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setQuery('SELECT * FROM "public"."post_tags" LIMIT 1000 OFFSET 0;');
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                SQL示例
                            </button>
                            <button
                                onClick={() => {
                                    setQuery(JSON.stringify({
                                        table: "users",
                                        operation: "find",
                                        filter: { age: { "$gt": 18 } }
                                    }, null, 2));
                                }}
                                className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                            >
                                JSON示例
                            </button>
                        </div>
                        <span className="text-xs text-gray-400">Ctrl/Cmd + Enter 执行</span>
                    </div>
                </div>

                <div className="p-4">
                    <textarea
                        className="query-editor w-full h-48 resize-none"
                        placeholder={`-- 支持SQL查询，例如：
SELECT * FROM "public"."post_tags" LIMIT 1000 OFFSET 0;

-- 多语句查询，用分号分隔：
SELECT * FROM users WHERE age > 18;
SELECT COUNT(*) FROM users;

-- 或者JSON格式查询：
{
  "table": "users",
  "operation": "find",
  "filter": { "age": { "$gt": 18 } }
}`}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading}
                    />

                    <div className="flex justify-end mt-3 gap-2">
                        <button
                            onClick={handleExecute}
                            disabled={loading || !query.trim()}
                            className={cn("btn-primary", loading && "opacity-70 cursor-not-allowed")}
                        >
                            <PlayIcon className="w-4 h-4 mr-1.5" />
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin">⟳</span>
                                    执行中...
                                </span>
                            ) : (
                                "执行查询"
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* 快速示例卡片 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-blue-800 mb-2">常用查询示例:</div>
                <div className="space-y-1 text-xs text-blue-700 font-mono">
                    <div className="cursor-pointer hover:bg-blue-100 p-1 rounded" onClick={() => setQuery(JSON.stringify({
                        table: "users",
                        operation: "find",
                        filter: {}
                    }, null, 2))}>
                        • 查询所有用户
                    </div>
                    <div className="cursor-pointer hover:bg-blue-100 p-1 rounded" onClick={() => setQuery(JSON.stringify({
                        table: "users",
                        operation: "count",
                        filter: { age: { "$gt": 18 } }
                    }, null, 2))}>
                        • 统计成年用户
                    </div>
                    <div className="cursor-pointer hover:bg-blue-100 p-1 rounded" onClick={() => setQuery(JSON.stringify({
                        table: "users",
                        operation: "findOne",
                        filter: { name: "John" }
                    }, null, 2))}>
                        • 查找单个用户
                    </div>
                </div>
            </div>
        </div>
    );
};

export interface QueryResult {
    data: any[];
    total?: number;
    error?: string;
    sql?: string;
    rows_affected?: number;
    type?: string;
    duration?: number;
}

// 支持多语句结果
export type QueryResultOrArray = QueryResult | QueryResult[] | (any[] & { error?: string }) | null;

interface QueryResultProps {
    result: QueryResultOrArray;
}

export const QueryResultDisplay: React.FC<QueryResultProps> = ({ result }) => {
    if (!result) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <div className="text-4xl mb-2">📊</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">准备就绪</h3>
                <p className="text-sm text-gray-500">执行查询后，结果将显示在这里</p>
            </div>
        );
    }

    // 检查是否是错误对象
    if (!Array.isArray(result) && result.error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                <div className="bg-red-100 px-4 py-2 border-b border-red-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
                        <span>⚠️</span> 查询错误
                    </h3>
                    {result.duration !== undefined && (
                        <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded font-medium">
                            {result.duration.toFixed(2)}s
                        </span>
                    )}
                </div>
                <div className="p-4">
                    <pre className="text-sm text-red-700 font-mono bg-red-100 p-3 rounded-lg overflow-x-auto">
                        {result.error}
                    </pre>
                </div>
            </div>
        );
    }

    // 检查是否是多语句结果（数组格式）
    if (Array.isArray(result)) {
        // 计算总耗时
        const totalDuration = result.reduce((sum, item) => sum + (item.duration || 0), 0);

        return (
            <div className="space-y-3">
                {/* 总耗时统计 */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-amber-800">
                        多语句查询完成
                    </span>
                    <span className="text-xs bg-amber-200 text-amber-900 px-2 py-1 rounded font-medium">
                        ⏱️ 总计: {totalDuration.toFixed(2)}s
                    </span>
                </div>

                {result.map((item, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-gray-800">
                                    查询 {index + 1}: {item.type === 'select' ? 'SELECT' : item.type === 'write' ? '写操作' : 'DDL'}
                                </h3>
                                {item.rows_affected !== undefined && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                        {item.rows_affected} 行
                                    </span>
                                )}
                            </div>
                            {item.duration !== undefined && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                    {item.duration.toFixed(2)}s
                                </span>
                            )}
                        </div>
                        <div className="p-2 bg-gray-100 border-b border-gray-200">
                            <pre className="text-xs text-gray-600 font-mono overflow-x-auto">{item.sql}</pre>
                        </div>
                        {item.data && (
                            <div className="max-h-64 overflow-auto bg-gray-900">
                                <div className="p-2 bg-yellow-900 text-yellow-200 text-xs mb-2 rounded">
                                    💡 调试提示：如果值显示为null，请查看__debug字段获取原始数据
                                </div>
                                <pre className="result-pre text-left leading-relaxed text-xs">
                                    {JSON.stringify(item.data, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    // 单个结果处理
    const hasData = result.data && result.data.length > 0;
    const totalDisplay = result.total !== undefined ? `${result.total} 条` : (hasData ? `${result.data.length} 条` : '0 条');

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                    {result.sql ? `SQL查询结果` : '查询结果'}
                </h3>
                <div className="flex items-center gap-3">
                    {result.sql && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-mono">
                            {result.sql.substring(0, 50)}{result.sql.length > 50 ? '...' : ''}
                        </span>
                    )}
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        {totalDisplay}
                    </span>
                    {result.duration !== undefined && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                            ⏱️ {result.duration.toFixed(2)}s
                        </span>
                    )}
                </div>
            </div>

            {result.sql && (
                <div className="p-2 bg-gray-100 border-b border-gray-200">
                    <pre className="text-xs text-gray-600 font-mono overflow-x-auto">{result.sql}</pre>
                </div>
            )}

            <div className="p-0">
                {!hasData ? (
                    <div className="text-center py-8">
                        <div className="text-3xl mb-2">📭</div>
                        <p className="text-gray-500 text-sm">没有数据返回</p>
                        {result.rows_affected !== undefined && (
                            <p className="text-xs text-gray-400 mt-1">影响行数: {result.rows_affected}</p>
                        )}
                    </div>
                ) : (
                    <div className="max-h-96 overflow-auto bg-gray-900">
                        <div className="p-2 bg-yellow-900 text-yellow-200 text-xs mb-2 rounded">
                            💡 调试提示：如果值显示为null，请查看__debug字段获取原始数据
                        </div>
                        <pre className="result-pre text-left leading-relaxed">
                            {JSON.stringify(result.data, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            {/* 结果提示 */}
            {hasData && (
                <div className="bg-blue-50 px-4 py-2 border-t border-blue-100 text-xs text-blue-700">
                    💡 提示：结果以 JSON 格式显示，支持滚动查看完整数据
                </div>
            )}
        </div>
    );
};
