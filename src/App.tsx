import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import { ConnectionManager, ConnectionConfig } from "./components/connections/ConnectionManager";
import { DatabaseBrowser } from "./components/database/DatabaseBrowser";
import { QueryEditor, QueryResultDisplay } from "./components/query/QueryEditor";

interface Database {
  name: string;
  collections: string[];
}

function App() {
  // 状态管理
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentConnection, setCurrentConnection] = useState<string | undefined>();
  const [databases, setDatabases] = useState<Database[]>([]);
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
      localStorage.setItem("postgresql-connections", JSON.stringify(connections));
    }
  }, [connections]);

  // 添加新连接
  const handleAddConnection = (config: Omit<ConnectionConfig, "id">) => {
    const newConnection: ConnectionConfig = {
      ...config,
      id: Date.now().toString(),
    };
    setConnections([...connections, newConnection]);
  };

  // 连接到数据库
  const handleConnect = async (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) return;

    setLoading(true);
    console.log("Connecting to:", connection)
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
      console.log(result, 'result')
      if (result) {
        setIsConnected(true);
        setCurrentConnection(connectionId);
        setQueryResult(null);

        // 获取数据库列表
        await handleRefresh();
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

  // 断开连接
  const handleDisconnect = async () => {
    try {
      await invoke("disconnect_postgresql");
      setIsConnected(false);
      setCurrentConnection(undefined);
      setDatabases([]);
      setSelectedDatabase(undefined);
      setSelectedCollection(undefined);
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

  // 刷新数据库列表
  const handleRefresh = async () => {
    if (!isConnected) return;

    setLoading(true);
    try {
      const result = await invoke<string>("list_databases");
      const parsed = JSON.parse(result);

      const dbList: Database[] = [];
      for (const dbName of parsed.databases) {
        const collectionsResult = await invoke<string>("list_collections", { database: dbName });
        const collections = JSON.parse(collectionsResult);
        dbList.push({
          name: dbName,
          collections: collections.collections,
        });
      }

      setDatabases(dbList);
    } catch (error) {
      console.error("Failed to refresh databases:", error);
      setQueryResult({
        data: [],
        error: error instanceof Error ? error.message : "获取数据库列表失败",
      });
    } finally {
      setLoading(false);
    }
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
    const startTime = Date.now(); // 开始计时

    // 创建超时Promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("查询超时：请求处理时间超过30秒")), 30000);
    });

    try {
      // 检查是否是SQL语句（以SELECT/INSERT/UPDATE/DELETE/CREATE/ALTER/DROP开头）
      const trimmedQuery = queryStr.trim().toUpperCase();
      let queryPayload;

      if (trimmedQuery.startsWith('SELECT') ||
        trimmedQuery.startsWith('INSERT') ||
        trimmedQuery.startsWith('UPDATE') ||
        trimmedQuery.startsWith('DELETE') ||
        trimmedQuery.startsWith('CREATE') ||
        trimmedQuery.startsWith('ALTER') ||
        trimmedQuery.startsWith('DROP')) {
        // SQL查询
        queryPayload = { sql: queryStr };
      } else {
        // JSON查询
        queryPayload = JSON.parse(queryStr);
      }

      // 执行查询，同时设置超时
      const queryPromise = invoke<string>("execute_query", { query: queryPayload });
      const result = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as string;

      const endTime = Date.now(); // 结束计时
      const duration = (endTime - startTime) / 1000; // 耗时（秒）

      const parsed = JSON.parse(result);

      // 检查是否是多语句结果数组
      if (Array.isArray(parsed)) {
        // 多语句结果，添加耗时信息
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
          duration: duration, // 添加耗时信息
        });
      }
    } catch (error) {
      console.error("Query execution failed:", error);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      setQueryResult({
        data: [],
        error: error instanceof Error ? error.message : "查询执行失败，请检查查询格式",
        duration: duration, // 即使失败也显示耗时
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
        {/* 连接管理区域 - 总是显示 */}
        <div className="mb-6">
          <div className="glass-card p-4">
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
        </div>

        {/* 其他功能区域 - 仅在连接后显示 */}
        {isConnected ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 中间：数据库浏览器 */}
            <div className="glass-card p-4">
              <DatabaseBrowser
                databases={databases}
                loading={loading}
                onRefresh={handleRefresh}
                onCollectionSelect={handleCollectionSelect}
                selectedDatabase={selectedDatabase}
                selectedCollection={selectedCollection}
              />
            </div>

            {/* 右侧：查询和结果 */}
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
        ) : (
          <div className="glass-card p-8 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🗄️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">欢迎使用 PostgreSQL Manager</h2>
              <p className="text-gray-600 mb-6">创建连接并连接到 PostgreSQL 数据库开始管理数据</p>

              <div className="space-y-3">
                <div className="text-sm text-gray-500">
                  💡 提示：在上方连接管理区域创建新连接，然后点击连接
                </div>
                {connections.length > 0 && (
                  <button
                    onClick={() => {
                      const firstConn = connections[0];
                      if (firstConn) handleConnect(firstConn.id);
                    }}
                    className="btn-primary w-full"
                  >
                    快速连接第一个可用连接
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 底部信息栏 */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>PostgreSQL Manager v1.0 • Built with Tauri + React + Tailwind CSS</p>
        </div>
      </div>
    </div>
  );
}

export default App;
