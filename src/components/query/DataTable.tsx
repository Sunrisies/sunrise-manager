import React from "react";

interface DataTableProps {
    data: any[];
    className?: string;
}

export const DataTable: React.FC<DataTableProps> = ({ data, className = "" }) => {
    if (!data || data.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-gray-500 text-sm">没有数据</p>
            </div>
        );
    }

    // 获取所有唯一的列名
    const columns = Array.from(
        new Set(data.flatMap(item => Object.keys(item)))
    ).filter(col => col !== "__debug"); // 排除调试字段

    // 获取调试信息（如果存在）
    const debugInfo = data[0]?.__debug;

    return (
        <div className={`w-full ${className}`}>
            {/* 调试信息提示 */}
            {debugInfo && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                    <div className="text-xs text-yellow-800 font-medium mb-1">
                        💡 调试信息
                    </div>
                    <div className="text-xs text-yellow-700 font-mono">
                        数据包含原始类型信息，可通过浏览器开发者工具查看完整结构
                    </div>
                </div>
            )}

            {/* 表格容器 - 支持滚动 */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="max-h-96 overflow-auto">
                    <table className="w-full text-left text-sm min-w-max">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col}
                                        className="px-4 py-3 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap"
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map((row, rowIndex) => (
                                <tr
                                    key={rowIndex}
                                    className="hover:bg-gray-50 transition-colors"
                                >
                                    {columns.map((col) => {
                                        const value = row[col];
                                        const displayValue = value === null ? 'null' :
                                            typeof value === 'object' ? JSON.stringify(value) : String(value);

                                        return (
                                            <td
                                                key={`${rowIndex}-${col}`}
                                                className="px-4 py-3 text-gray-700 font-mono text-xs whitespace-nowrap max-w-xs overflow-hidden text-ellipsis"
                                                title={displayValue}
                                            >
                                                {value === null ? (
                                                    <span className="text-gray-400 italic">null</span>
                                                ) : typeof value === 'object' ? (
                                                    <span className="text-gray-500">{JSON.stringify(value)}</span>
                                                ) : (
                                                    displayValue
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 数据统计 */}
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
                <span>📊 共 {data.length} 行数据</span>
                <span>📋 {columns.length} 列</span>
            </div>
        </div>
    );
};

// 多语句查询结果表格
export const MultiQueryDataTable: React.FC<{ results: any[] }> = ({ results }) => {
    return (
        <div className="space-y-4">
            {results.map((result, index) => (
                <div key={index} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-gray-800">
                                查询 {index + 1}
                            </h4>
                            {result.rows_affected !== undefined && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    {result.rows_affected} 行
                                </span>
                            )}
                        </div>
                        {result.sql && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-mono">
                                {result.sql.substring(0, 30)}{result.sql.length > 30 ? '...' : ''}
                            </span>
                        )}
                    </div>
                    {result.sql && (
                        <div className="bg-gray-100 px-4 py-1 border-b border-gray-200">
                            <pre className="text-xs text-gray-600 font-mono overflow-x-auto">
                                {result.sql}
                            </pre>
                        </div>
                    )}
                    <div className="p-4">
                        {result.data && result.data.length > 0 ? (
                            <DataTable data={result.data} />
                        ) : (
                            <div className="text-center py-6 text-gray-500 text-sm">
                                无数据返回
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
