import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import { ConnectionManager, ConnectionConfig } from "./components/connections/ConnectionManager";
import { QueryEditor, QueryResultDisplay } from "./components/query/QueryEditor";
import { cn } from "./lib/utils";

interface Database {
  name: string;
  collections: string[];
}

interface ConnectionWithDBs extends ConnectionConfig {
  databases?: Database[];
  expanded?: boolean;
}

function App() {
  // 状态管理
  const [connections, setConnections] = useState<ConnectionWithDBs[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentConnection, setCurrentConnection] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>();
  const [selectedCollection, setSelectedCollection] = useState<string | undefined>();
  const [queryResult, setQueryResult] = useState<any>(null);

  // 从本地存储加载连接配置
  useEffect(() => {
    const saved = localStorage.getItem("postgresql-connections");
    if (saved) {
      try {
        setConnections(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved connections:", e);
      }
    }
  }, []);

  // 保存连接配置到本地存储
  useEffect(() => {
    if (connections.length > 0) {
      // 移除databases和expanded字段后再保存
      const toSave = connections.map(conn => {
        const { databases, expanded, ...rest } = conn;
        return rest;
      });
      localStorage.setItem("postgresql-connections", JSON.stringify(toSave));
    }
  }, [connections]);

  // 添加新连接
  const handleAddConnection = (config: Omit<ConnectionConfig, "id">) => {
    const newConnection: ConnectionWithDBs = {
      ...config,
      id: Date.now().toString(),
      expanded: false,
      databases: [],
    };
    setConnections([...connections, newConnection]);
  };

  // 连接到数据库 - 点击连接时只查询当前库的表
  const handleConnect = async (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) return;

    setLoading(true);
    console.log("Connecting to:", connection);

    try {
      const result = await invoke("connect_postgresql", {
        config: {
          host: connection.host,
          port: connection.port,
          username: connection.username,
          password: connection.password,
          database: connection.database,
        },
      });
      if (result) {
        if (!connection.database) {
          console.log('查询库')
          try {
            const collectionsResult = await invoke<string>("get_database_name");
            const collections = JSON.parse(collectionsResult);
            console.log(collections, 'collections')
            setConnections(prev => {
              console.log(prev, 'prev')
              return prev.map(c =>
                c.id === connectionId
                  ? {
                    ...c,
                    expanded: true,
                    databases: [{
                      name: connection.database!,
                      collections: collections.collections
                    }]
                  }
                  : { ...c, expanded: false }
              )
            });

            setIsConnected(true);
            setCurrentConnection(connectionId);
            setQueryResult(null);
            setSelectedDatabase(connection.database);
            setSelectedCollection(collections.collections[0] || undefined);
          } catch (e) {
            console.error(`Failed to get tables for ${connection.database}:`, e);
            setQueryResult({
              data: [],
              error: e instanceof Error ? e.message : "获取表失败",
            });
          }
        } else {

          try {
            const collectionsResult = await invoke<string>("list_databases", { database: connection.database });
            const collections = JSON.parse(collectionsResult);
            console.log(collections, 'collections')
            setConnections(prev => prev.map(c =>
              c.id === connectionId
                ? {
                  ...c,
                  expanded: true,
                  databases: [{
                    name: connection.database!,
                    collections: collections.collections
                  }]
                }
                : { ...c, expanded: false }
            ));

            setIsConnected(true);
            setCurrentConnection(connectionId);
            setQueryResult(null);
            setSelectedDatabase(connection.database);
            // setSelectedCollection(collections.collections[0] || undefined);
          } catch (e) {
            console.error(`Failed to get tables for ${connection.database}:`, e);
            setQueryResult({
              data: [],
              error: e instanceof Error ? e.message : "获取表失败",
            });
          }
        }
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setQueryResult({
        data: [],
        error: error instanceof Error ? error.message : "连接失败",
      });
    } finally {
      setLoading(false);
    }
  };

  // 点击数据库时 - 新建立连接到该数据库
  const handleDatabaseClick = async (connectionId: string, databaseName: string) => {
    setLoading(true);
    console.log(`Switching to database: ${databaseName} on connection ${connectionId}`);

    try {
      const connection = connections.find((c) => c.id === connectionId);
      if (!connection) return;
      console.log(connection, '========')
      // 断开当前连接
      await invoke("disconnect_postgresql");

      // 使用相同的配置但不同的数据库名重新连接
      const result = await invoke("connect_postgresql", {
        config: {
          host: connection.host,
          port: connection.port,
          username: connection.username,
          password: connection.password,
          database: databaseName,
        },
      });

      if (result) {
        // 获取新数据库的表
        const collectionsResult = await invoke<string>("list_collections", { database: databaseName });
        const collections = JSON.parse(collectionsResult);

        // 更新连接配置和状态
        const updatedConnection = {
          ...connection,
          database: databaseName,
          databases: [{
            name: databaseName,
            collections: collections.collections
          }],
          expanded: true
        };

        setConnections(prev => prev.map(c =>
          c.id === connectionId ? updatedConnection : c
        ));

        setCurrentConnection(connectionId);
        setSelectedDatabase(databaseName);
        setSelectedCollection(collections.collections[0] || undefined);
        setQueryResult(null);
      }
    } catch (error) {
      console.error("Database switch failed:", error);
      setQueryResult({
        data: [],
        error: error instanceof Error ? error.message : `切换到数据库 ${databaseName} 失败`,
      });
    } finally {
      setLoading(false);
    }
  };

  // 断开连接
  const handleDisconnect = async () => {
    try {
      await invoke("disconnect_postgresql");
      setIsConnected(false);
      setCurrentConnection(undefined);
      setQueryResult(null);
    } catch (error) {
      console.error("Disconnect failed:", error);
    }
  };

  // 删除连接
  const handleDeleteConnection = (connectionId: string) => {
    if (isConnected && currentConnection === connectionId) {
      handleDisconnect();
    }
    setConnections(connections.filter((c) => c.id !== connectionId));
  };

  // 选择数据库和集合
  const handleCollectionSelect = (database: string, collection: string) => {
    setSelectedDatabase(database);
    setSelectedCollection(collection);
    setQueryResult(null);
  };

  // 执行查询
  const handleExecuteQuery = async (queryStr: string) => {
    if (!isConnected) {
      setQueryResult({
        data: [],
        error: "请先连接到数据库",
      });
      return;
    }

    setLoading(true);
    const startTime = Date.now();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("查询超时：请求处理时间超过30秒")), 30000);
    });

    try {
      const trimmedQuery = queryStr.trim().toUpperCase();
      let queryPayload;

      if (trimmedQuery.startsWith('SELECT') ||
        trimmedQuery.startsWith('INSERT') ||
        trimmedQuery.startsWith('UPDATE') ||
        trimmedQuery.startsWith('DELETE') ||
        trimmedQuery.startsWith('CREATE') ||
        trimmedQuery.startsWith('ALTER') ||
        trimmedQuery.startsWith('DROP')) {
        queryPayload = { sql: queryStr };
      } else {
        queryPayload = JSON.parse(queryStr);
      }

      const queryPromise = invoke<string>("execute_query", { query: queryPayload });
      const result = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as string;

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const parsed = JSON.parse(result);

      if (Array.isArray(parsed)) {
        setQueryResult(parsed.map(item => ({
          ...item,
          duration: duration
        })) as any);
      } else {
        setQueryResult({
          data: parsed.data || [],
          total: parsed.total,
          sql: parsed.sql,
          rows_affected: parsed.rows_affected,
          duration: duration,
        });
      }
    } catch (error) {
      console.error("Query execution failed:", error);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      setQueryResult({
        data: [],
        error: error instanceof Error ? error.message : "查询执行失败，请检查查询格式",
        duration: duration,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* 渐变背景头部 */}
      <div className="gradient-bg text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">PostgreSQL Manager</h1>
              <p className="text-white/80 mt-1">现代化的 PostgreSQL 数据库管理工具</p>
            </div>
            <div className="flex items-center gap-3">
              {/* 连接状态指示器 */}
              <div className={`status-badge ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
                {isConnected ? '🟢 已连接' : '🔴 未连接'}
              </div>
              {/* 当前连接信息 */}
              {isConnected && currentConnection && (
                <div className="bg-white/20 px-3 py-1 rounded-lg text-sm backdrop-blur-sm">
                  {connections.find(c => c.id === currentConnection)?.name}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="max-w-7xl mx-auto -mt-8 px-6">
        {/* 连接管理 + 数据库浏览器 - 合并为树形结构 */}
        <div className="mb-6">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">连接管理</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if ((window as any).showConnectionForm) {
                      (window as any).showConnectionForm();
                    }
                  }}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  + 新建连接
                </button>
                {isConnected && (
                  <button
                    onClick={handleDisconnect}
                    className="btn-danger text-xs px-3 py-1.5"
                  >
                    断开连接
                  </button>
                )}
              </div>
            </div>

            {/* 隐藏ConnectionManagerUI但保持功能 */}
            <div className="hidden">
              <ConnectionManager
                connections={connections}
                onAdd={handleAddConnection}
                onConnect={handleConnect}
                onDelete={handleDeleteConnection}
                onDisconnect={handleDisconnect}
                isConnected={isConnected}
                currentConnection={currentConnection}
              />
            </div>

            {/* 树形连接列表 */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {connections.length === 0 && (
                <div className="text-center py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                  <p className="text-gray-500 text-sm">暂无连接，请创建新连接</p>
                </div>
              )}

              {connections.map((conn) => {
                const isActive = currentConnection === conn.id;
                const isExpanded = conn.expanded && isActive;
                const hasDatabases = conn.databases && conn.databases.length > 0;

                return (
                  <div key={conn.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {/* 连接节点 */}
                    <div
                      className={cn(
                        "flex items-center justify-between p-3 cursor-pointer transition-colors",
                        isActive ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50",
                        isExpanded && "border-b border-gray-200"
                      )}
                      onClick={() => {
                        if (!isActive) {
                          handleConnect(conn.id);
                        } else {
                          setConnections(prev => prev.map(c =>
                            c.id === conn.id ? { ...c, expanded: !c.expanded } : c
                          ));
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className={cn("font-semibold", isActive ? "text-blue-700" : "text-gray-800")}>
                          {conn.name}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {conn.host}:{conn.port}
                        </span>
                        {conn.database && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {conn.database}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            {isExpanded ? '展开' : '连接中'}
                          </span>
                        )}
                        {hasDatabases && (
                          <span className="text-xs text-gray-400">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 数据库列表 */}
                    {isExpanded && conn.databases && conn.databases.length > 0 && (
                      <div className="bg-gray-50 p-2 space-y-1">
                        {conn.databases.map((db) => {
                          const isDBSelected = selectedDatabase === db.name;

                          return (
                            <div key={db.name} className="border border-gray-200 rounded-md overflow-hidden bg-white">
                              {/* 数据库节点 - 点击切换到该数据库 */}
                              <div
                                className={cn(
                                  "flex items-center justify-between p-2 cursor-pointer transition-colors text-sm",
                                  isDBSelected ? "bg-blue-100 text-blue-700" : "hover:bg-gray-50"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDatabaseClick(conn.id, db.name);
                                }}
                              >
                                <span className="font-medium">📁 {db.name}</span>
                                <span className="text-xs text-gray-400">({db.collections.length})</span>
                              </div>

                              {/* 表列表 - 点击表进行查询 */}
                              {db.collections.length > 0 && (
                                <div className="bg-gray-100 p-1 space-y-0.5">
                                  {db.collections.map((table) => {
                                    const isTableSelected = isDBSelected && selectedCollection === table;

                                    // 处理 schema.table 格式
                                    let displayTableName = table;
                                    let schemaPrefix = "";
                                    if (table.includes('.')) {
                                      const parts = table.split('.');
                                      schemaPrefix = parts[0];
                                      displayTableName = parts[1];
                                      if (schemaPrefix === 'public') {
                                        schemaPrefix = "";
                                      }
                                    }

                                    return (
                                      <div
                                        key={table}
                                        className={cn(
                                          "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-all",
                                          isTableSelected
                                            ? "bg-blue-200 text-blue-800 font-medium"
                                            : "hover:bg-gray-200 text-gray-700"
                                        )}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCollectionSelect(db.name, table);
                                        }}
                                      >
                                        <span className="text-gray-500">📄</span>
                                        <span className="flex-1">
                                          {displayTableName}
                                          {schemaPrefix && (
                                            <span className="ml-1 text-gray-500 opacity-75">({schemaPrefix})</span>
                                          )}
                                        </span>
                                        {isTableSelected && (
                                          <span className="text-blue-600">✓</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isExpanded && (!conn.databases || conn.databases.length === 0) && (
                      <div className="bg-gray-50 p-3 text-center text-xs text-gray-400">
                        {loading ? '加载中...' : '该连接下暂无数据库'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 加载状态 */}
            {loading && (
              <div className="mt-3 text-center text-sm text-blue-600 flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                <span>正在连接并获取数据...</span>
              </div>
            )}
          </div>
        </div>

        {/* 查询区域 - 仅当有选择表时显示 */}
        {(selectedDatabase && selectedCollection) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card p-4 lg:col-span-1">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">当前选择</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs text-gray-500">数据库</div>
                    <div className="text-sm font-semibold text-blue-700">{selectedDatabase}</div>
                    <div className="text-xs text-gray-500 mt-1">表</div>
                    <div className="text-sm font-semibold text-blue-700">
                      {selectedCollection.includes('.') ? selectedCollection.split('.').slice(-1)[0] : selectedCollection}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedDatabase(undefined);
                    setSelectedCollection(undefined);
                    setQueryResult(null);
                  }}
                  className="w-full btn-secondary text-xs"
                >
                  清空选择
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-4">
                <QueryEditor
                  onExecuteQuery={handleExecuteQuery}
                  loading={loading}
                  database={selectedDatabase}
                  collection={selectedCollection}
                />
              </div>

              {queryResult && (
                <div className="glass-card p-4">
                  <QueryResultDisplay result={queryResult} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 底部信息栏 */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>PostgreSQL Manager v1.0 • Built with Tauri + React + Tailwind CSS</p>
          <p className="mt-1 text-xs">💡 提示：点击连接查看当前库表，点击库名切换数据库</p>
        </div>
      </div>
    </div>
  );
}

export default App;
