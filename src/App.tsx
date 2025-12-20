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
        const savedConnections = JSON.parse(saved);
        setConnections(savedConnections);
      } catch (e) {
        console.error("Failed to parse saved connections:", e);
      }
    }
  }, []);

  // 保存连接配置到本地存储
  useEffect(() => {
    if (connections.length > 0) {
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

  // 连接到数据库 - 点击连接时获取所有数据库列表
  const handleConnect = async (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) return;

    setLoading(true);
    console.log("Connecting to:", connection);

    try {
      // 1. 连接PostgreSQL（使用配置中指定的数据库，或空字符串）
      const result = await invoke("connect_postgresql", {
        config: {
          host: connection.host,
          port: connection.port,
          username: connection.username,
          password: connection.password,
          database: connection.database || 'postgres', // 如果没有指定，使用postgres
        },
      });

      if (result) {
        // 2. 获取所有数据库列表
        const dbResult = await invoke<string>("list_databases");
        const parsed = JSON.parse(dbResult);
        const allDatabases = parsed.databases;

        console.log("All databases:", allDatabases);

        // 3. 为每个数据库获取表
        const databaseList: Database[] = [];
        for (const dbName of allDatabases) {
          try {
            const collectionsResult = await invoke<string>("list_collections", { database: dbName });
            const collections = JSON.parse(collectionsResult);
            databaseList.push({
              name: dbName,
              collections: collections.collections,
            });
          } catch (e) {
            console.error(`Failed to get tables for ${dbName}:`, e);
            // 即使某个数据库失败，也添加空列表
            databaseList.push({
              name: dbName,
              collections: [],
            });
          }
        }

        // 4. 更新连接状态 - 保留所有数据库
        setConnections(prev => prev.map(c =>
          c.id === connectionId
            ? {
              ...c,
              expanded: true,
              databases: databaseList
            }
            : { ...c, expanded: false } // 关闭其他连接
        ));

        setIsConnected(true);
        setCurrentConnection(connectionId);
        setQueryResult(null);

        // 默认选中配置的数据库或第一个数据库
        const defaultDB = connection.database || allDatabases[0];
        setSelectedDatabase(defaultDB);

        // 找到默认数据库的表并选中第一个
        const defaultDBData = databaseList.find(db => db.name === defaultDB);
        if (defaultDBData && defaultDBData.collections.length > 0) {
          setSelectedCollection(defaultDBData.collections[0]);
        } else {
          setSelectedCollection(undefined);
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

  // 点击数据库时 - 切换连接到该数据库，但保留所有库的显示
  const handleDatabaseClick = async (connectionId: string, databaseName: string) => {
    setLoading(true);
    console.log(`Switching to database: ${databaseName} on connection ${connectionId}`);

    try {
      const connection = connections.find((c) => c.id === connectionId);
      if (!connection) return;

      // 1. 断开当前连接
      await invoke("disconnect_postgresql");

      // 2. 使用新数据库名重新连接
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
        // 3. 获取新数据库的表
        const collectionsResult = await invoke<string>("list_collections", { database: databaseName });
        const collections = JSON.parse(collectionsResult);

        // 4. 更新当前数据库的表数据，但不改变数据库列表结构
        setConnections(prev => prev.map(c => {
          if (c.id === connectionId) {
            // 只更新被选中数据库的表列表，其他数据库保持不变
            const updatedDatabases = c.databases?.map(db =>
              db.name === databaseName
                ? { ...db, collections: collections.collections }
                : db
            ) || [];

            return {
              ...c,
              database: databaseName, // 更新默认数据库
              databases: updatedDatabases,
              expanded: true
            };
          }
          return c;
        }));

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
      console.log(result);
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
    <div className="h-full">
      {/* 主内容区域 */}
      <div className="max-w-7xl border flex flex-col h-full p-2">
        <div className="flex flex-1">
          {/* 连接管理 + 数据库浏览器 - 合并为树形结构 */}
          <div className="mb-6 border w-52 flex flex-col">
            <div className="glass-card p-4">
              <div className=" items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">我的连接</h2>
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

                      {/* 数据库列表 - 显示所有数据库 */}
                      {isExpanded && conn.databases && conn.databases.length > 0 && (
                        <div className="bg-gray-50 p-2 space-y-1">
                          {conn.databases.map((db) => {
                            const isDBSelected = selectedDatabase === db.name;

                            return (
                              <div key={db.name} className="border border-gray-200 rounded-md overflow-hidden bg-white">
                                {/* 数据库节点 */}
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

                                {/* 表列表 - 仅在选中时显示 */}
                                {isDBSelected && db.collections.length > 0 && (
                                  <div className="bg-gray-100 p-1 space-y-0.5">
                                    {db.collections.map((table) => {
                                      const isTableSelected = selectedCollection === table;

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
            <div className="flex-1 max-w-[calc(100%_-_var(--spacing)_*_52)]">
              <div className="px-2 ">
                <QueryEditor
                  onExecuteQuery={handleExecuteQuery}
                  loading={loading}
                  database={selectedDatabase}
                  collection={selectedCollection}
                />
                {queryResult && (
                  <QueryResultDisplay result={queryResult} />
                )}
              </div>


            </div>
          )}
        </div>


        {/* 底部信息栏 */}
        <div className="mb-8 text-center text-gray-500 text-sm">
          <p>PostgreSQL Manager v1.0 • Built with Tauri + React + Tailwind CSS</p>
          <p className="mt-1 text-xs">💡 提示：点击连接查看所有库，点击库名切换当前库</p>
        </div>
      </div>
    </div>
  );
}

export default App;
