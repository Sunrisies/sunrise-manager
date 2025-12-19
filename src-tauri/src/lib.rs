use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use tokio_postgres::{types::Type, Client, Config, NoTls, Row};

struct PostgreSQLConnection {
    client: Option<Client>,
}

struct AppState {
    connection: Arc<Mutex<PostgreSQLConnection>>,
}

#[derive(Deserialize)]
struct ConnectConfig {
    host: String,
    port: u16,
    username: String,
    password: String,
    database: String,
}

#[derive(Serialize)]
struct QueryResult {
    data: Vec<serde_json::Value>,
    total: Option<i64>,
}
// 查询库名
#[tauri::command]
async fn get_database_name(state: State<'_, AppState>) -> Result<String, String> {
    //     let mut app_connection = state.connection.lock().await;

    //     // 构建PostgreSQL连接配置
    //     let mut pg_config = Config::new();
    //     pg_config.host(&config.host);
    //     pg_config.port(config.port);
    //     pg_config.user(&config.username);
    //     pg_config.password(&config.password);
    //     pg_config.dbname(&config.database);

    //     // 连接到PostgreSQL
    //     let (client, connection) = pg_config
    //         .connect(NoTls)
    //         .await
    //         .map_err(|e| format!("连接失败: {}", e))?;

    //     // 后台运行连接
    //     tokio::spawn(async move {
    //         if let Err(e) = connection.await {
    //             eprintln!("PostgreSQL连接错误: {}", e);
    //         }
    //     });

    //     // 测试连接
    //     client
    //         .query_one(
    //             " SELECT datname
    //  FROM pg_database
    // WHERE datistemplate = false
    // ORDER BY datname;",
    //             &[],
    //         )
    //         .await
    //         .map_err(|e| format!("连接验证失败: {}", e))?;

    //     println!("PostgreSQL连接成功! 查询库名称: {:?}", client);

    //     app_connection.client = Some(client);

    //     Ok(true)
    let app_connection = state.connection.lock().await;
    let current_client = app_connection.client.as_ref().ok_or("未连接到数据库")?;

    // 获取当前连接的数据库
    let current_db = current_client
        .query_one("SELECT current_database()", &[])
        .await
        .map(|row| row.get::<_, String>(0))
        .unwrap_or_else(|_| "".to_string());

    // 如果数据库与当前连接的数据库相同，直接使用当前连接
    let rows = current_client
        .query(
            " SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
            &[],
        )
        .await
        .map_err(|e| format!("获取表列表失败: {}", e))?;
    for row in &rows {
        let db_name: &str = row.get(0); // 获取第一列的值
        println!("{}", db_name);
    }
    // 使用try_get避免panic
    let collections: Vec<String> = rows
        .iter()
        .filter_map(|row| row.try_get(0).unwrap_or(None))
        .collect();

    let result = serde_json::json!({
        "collections": collections
    });

    return Ok(result.to_string());
}

#[tauri::command]
async fn connect_postgresql(
    config: ConnectConfig,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let mut app_connection = state.connection.lock().await;

    // 构建PostgreSQL连接配置
    let mut pg_config = Config::new();
    pg_config.host(&config.host);
    pg_config.port(config.port);
    pg_config.user(&config.username);
    pg_config.password(&config.password);
    pg_config.dbname(&config.database);

    // 连接到PostgreSQL
    let (client, connection) = pg_config
        .connect(NoTls)
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    // 后台运行连接
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("PostgreSQL连接错误: {}", e);
        }
    });

    // 测试连接
    client
        .query_one("SELECT 1", &[])
        .await
        .map_err(|e| format!("连接验证失败: {}", e))?;

    println!("PostgreSQL连接成功! 数据库: {}", config.database);

    app_connection.client = Some(client);

    Ok(true)
}

#[tauri::command]
async fn disconnect_postgresql(state: State<'_, AppState>) -> Result<(), String> {
    let mut app_connection = state.connection.lock().await;
    app_connection.client = None;
    Ok(())
}

#[tauri::command]
async fn list_databases(state: State<'_, AppState>) -> Result<String, String> {
    let app_connection = state.connection.lock().await;
    let client = app_connection.client.as_ref().ok_or("未连接到数据库")?;

    // 查询所有数据库
    let rows = client
        .query(
            "SELECT datname FROM pg_database WHERE datistemplate = false",
            &[],
        )
        .await
        .map_err(|e| format!("获取数据库列表失败: {}", e))?;

    // 使用try_get避免panic
    let databases: Vec<String> = rows
        .iter()
        .filter_map(|row| row.try_get("datname").unwrap_or(None))
        .collect();

    let result = serde_json::json!({
        "databases": databases
    });

    Ok(result.to_string())
}

#[tauri::command]
async fn execute_query(
    query: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let connection = state.connection.lock().await;
    let client = connection.client.as_ref().ok_or("未连接到数据库")?;

    // 检查查询类型
    if let Some(sql_str) = query.get("sql").and_then(|v| v.as_str()) {
        // 支持直接SQL查询
        return execute_sql(client, sql_str).await;
    }

    // 原有的JSON格式查询
    let table = query
        .get("table")
        .and_then(|v| v.as_str())
        .ok_or("查询必须包含 table 字段或 sql 字段")?;

    let operation = query
        .get("operation")
        .and_then(|v| v.as_str())
        .ok_or("查询必须包含 operation 字段")?;

    // 克隆query以避免所有权问题
    execute_query_internal(&client, operation, table, query.clone()).await
}

// 执行原始SQL查询
async fn execute_sql(client: &Client, sql: &str) -> Result<String, String> {
    // 支持多条SQL语句，按分号分割
    let statements: Vec<&str> = sql
        .split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if statements.is_empty() {
        return Err("没有有效的SQL语句".to_string());
    }

    let mut all_results = Vec::new();

    for statement in statements {
        // 判断SQL类型
        let upper_stmt = statement.to_uppercase();

        if upper_stmt.starts_with("SELECT") {
            // 查询操作
            let rows = client
                .query(statement, &[])
                .await
                .map_err(|e| format!("查询失败: {}", e))?;

            let data = rows_to_json(&rows);
            all_results.push(serde_json::json!({
                "type": "select",
                "sql": statement,
                "data": data,
                "rows_affected": data.len()
            }));
        } else if upper_stmt.starts_with("INSERT")
            || upper_stmt.starts_with("UPDATE")
            || upper_stmt.starts_with("DELETE")
        {
            // 写操作
            let result = client
                .execute(statement, &[])
                .await
                .map_err(|e| format!("执行失败: {}", e))?;

            all_results.push(serde_json::json!({
                "type": "write",
                "sql": statement,
                "rows_affected": result
            }));
        } else {
            // 其他操作（CREATE, ALTER, DROP等）
            let result = client
                .execute(statement, &[])
                .await
                .map_err(|e| format!("执行失败: {}", e))?;

            all_results.push(serde_json::json!({
                "type": "ddl",
                "sql": statement,
                "rows_affected": result
            }));
        }
    }

    // 如果只有一条结果，直接返回；否则返回数组
    if all_results.len() == 1 {
        Ok(serde_json::to_string(&all_results[0]).map_err(|e| format!("序列化失败: {}", e))?)
    } else {
        Ok(serde_json::to_string(&all_results).map_err(|e| format!("序列化失败: {}", e))?)
    }
}

#[tauri::command]
async fn list_collections(database: String, state: State<'_, AppState>) -> Result<String, String> {
    let app_connection = state.connection.lock().await;
    let current_client = app_connection.client.as_ref().ok_or("未连接到数据库")?;

    // 获取当前连接的数据库
    let current_db = current_client
        .query_one("SELECT current_database()", &[])
        .await
        .map(|row| row.get::<_, String>(0))
        .unwrap_or_else(|_| "".to_string());

    // 如果数据库与当前连接的数据库相同，直接使用当前连接
    if current_db == database {
        let rows = current_client
            .query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
                &[]
            )
            .await
            .map_err(|e| format!("获取表列表失败: {}", e))?;

        // 使用try_get避免panic
        let collections: Vec<String> = rows
            .iter()
            .filter_map(|row| row.try_get("table_name").unwrap_or(None))
            .collect();

        let result = serde_json::json!({
            "collections": collections
        });

        return Ok(result.to_string());
    }

    // 尝试多种方法
    let queries = vec![
        // 方法1：标准跨库查询
        format!(
            "SELECT table_name 
             FROM information_schema.tables 
             WHERE table_catalog = '{}' 
             AND table_schema = 'public' 
             AND table_type = 'BASE TABLE'",
            database
        ),
        // 方法2：使用数据库名作为schema前缀
        format!(
            "SELECT table_name 
             FROM {}.information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_type = 'BASE TABLE'",
            database
        ),
        // 方法3：使用全限定名
        format!(
            "SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = '{}'",
            database
        ),
    ];

    // 尝试所有方法，返回第一个成功的
    for query in queries {
        match current_client.query(&query, &[]).await {
            Ok(rows) => {
                let collections: Vec<String> = rows
                    .iter()
                    .filter_map(|row| row.try_get("table_name").unwrap_or(None))
                    .collect();

                if !collections.is_empty() {
                    let result = serde_json::json!({
                        "collections": collections
                    });
                    return Ok(result.to_string());
                }
            }
            Err(_) => continue,
        }
    }

    // 如果所有方法都失败，返回空数组
    Ok(serde_json::json!({ "collections": [] }).to_string())
}

async fn execute_query_internal(
    client: &Client,
    operation: &str,
    table: &str,
    query: serde_json::Value,
) -> Result<String, String> {
    match operation {
        "find" => {
            let filter = query
                .get("filter")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_else(|| serde_json::Map::new());
            let where_clause = build_where_clause(&filter);
            let sql = format!("SELECT * FROM {}{}", table, where_clause);

            let rows = client
                .query(&sql, &[])
                .await
                .map_err(|e| format!("查询失败: {}", e))?;

            let data = rows_to_json(&rows);
            let result = QueryResult { data, total: None };
            Ok(serde_json::to_string(&result).map_err(|e| format!("序列化失败: {}", e))?)
        }
        "findOne" => {
            let filter = query
                .get("filter")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_else(|| serde_json::Map::new());
            let where_clause = build_where_clause(&filter);
            let sql = format!("SELECT * FROM {}{} LIMIT 1", table, where_clause);

            let row = client
                .query_opt(&sql, &[])
                .await
                .map_err(|e| format!("查询失败: {}", e))?;

            let data = match row {
                Some(row) => vec![row_to_json(&row)],
                None => vec![],
            };

            let result = QueryResult { data, total: None };
            Ok(serde_json::to_string(&result).map_err(|e| format!("序列化失败: {}", e))?)
        }
        "count" => {
            let filter = query
                .get("filter")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_else(|| serde_json::Map::new());
            let where_clause = build_where_clause(&filter);
            let sql = format!("SELECT COUNT(*) as count FROM {}{}", table, where_clause);

            let row = client
                .query_one(&sql, &[])
                .await
                .map_err(|e| format!("计数失败: {}", e))?;

            let count: i64 = row.get("count");
            let result = QueryResult {
                data: vec![],
                total: Some(count),
            };
            Ok(serde_json::to_string(&result).map_err(|e| format!("序列化失败: {}", e))?)
        }
        _ => Err(format!("不支持的操作: {}", operation)),
    }
}

fn build_where_clause(filter: &serde_json::Map<String, serde_json::Value>) -> String {
    if filter.is_empty() {
        return String::new();
    }

    let conditions: Vec<String> = filter
        .iter()
        .map(|(key, value)| {
            match value {
                serde_json::Value::String(s) => format!("{} = '{}'", key, s),
                serde_json::Value::Number(n) => format!("{} = {}", key, n),
                serde_json::Value::Bool(b) => format!("{} = {}", key, b),
                serde_json::Value::Object(obj) => {
                    // 处理操作符，如 $gt, $lt 等
                    if let Some(gt) = obj.get("$gt") {
                        return format!("{} > {}", key, json_value_to_sql(gt));
                    }
                    if let Some(gte) = obj.get("$gte") {
                        return format!("{} >= {}", key, json_value_to_sql(gte));
                    }
                    if let Some(lt) = obj.get("$lt") {
                        return format!("{} < {}", key, json_value_to_sql(lt));
                    }
                    if let Some(lte) = obj.get("$lte") {
                        return format!("{} <= {}", key, json_value_to_sql(lte));
                    }
                    if let Some(ne) = obj.get("$ne") {
                        return format!("{} != {}", key, json_value_to_sql(ne));
                    }
                    if let Some(_in) = obj.get("$in") {
                        // 处理 $in 操作符
                        if let Some(arr) = _in.as_array() {
                            let values: Vec<String> =
                                arr.iter().map(|v| json_value_to_sql(v)).collect();
                            return format!("{} IN ({})", key, values.join(", "));
                        }
                    }
                    format!("{} = '{}'", key, value)
                }
                _ => format!("{} = '{}'", key, value),
            }
        })
        .collect();

    if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    }
}

fn json_value_to_sql(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => format!("'{}'", s),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        _ => format!("'{}'", value),
    }
}

fn rows_to_json(rows: &[Row]) -> Vec<serde_json::Value> {
    rows.iter().map(|row| row_to_json(row)).collect()
}

fn row_to_json(row: &Row) -> serde_json::Value {
    let mut map = serde_json::Map::new();

    // 添加调试信息：显示所有列的类型和原始值
    let mut debug_info = serde_json::Map::new();

    for (i, column) in row.columns().iter().enumerate() {
        let name = column.name();
        let column_type = column.type_();

        // 尝试直接获取原始字符串值作为备用方案（不移动所有权）
        let raw_value = row.try_get::<_, Option<String>>(i).unwrap_or(None);

        // 根据类型尝试获取值
        let value = match column_type {
            &Type::INT4 => {
                match row.try_get::<_, Option<i32>>(i) {
                    Ok(Some(v)) => serde_json::Value::Number(serde_json::Number::from(v)),
                    Ok(None) => serde_json::Value::Null,
                    Err(_) => {
                        // 如果类型获取失败，尝试字符串
                        match &raw_value {
                            Some(s) => serde_json::Value::String(s.clone()),
                            None => serde_json::Value::Null,
                        }
                    }
                }
            }
            &Type::INT8 => match row.try_get::<_, Option<i64>>(i) {
                Ok(Some(v)) => serde_json::Value::Number(serde_json::Number::from(v)),
                Ok(None) => serde_json::Value::Null,
                Err(_) => match &raw_value {
                    Some(s) => serde_json::Value::String(s.clone()),
                    None => serde_json::Value::Null,
                },
            },
            &Type::FLOAT4 => match row.try_get::<_, Option<f32>>(i) {
                Ok(Some(v)) => serde_json::Value::Number(
                    serde_json::Number::from_f64(v as f64)
                        .unwrap_or_else(|| serde_json::Number::from(0)),
                ),
                Ok(None) => serde_json::Value::Null,
                Err(_) => match &raw_value {
                    Some(s) => serde_json::Value::String(s.clone()),
                    None => serde_json::Value::Null,
                },
            },
            &Type::FLOAT8 => match row.try_get::<_, Option<f64>>(i) {
                Ok(Some(v)) => serde_json::Value::Number(
                    serde_json::Number::from_f64(v).unwrap_or_else(|| serde_json::Number::from(0)),
                ),
                Ok(None) => serde_json::Value::Null,
                Err(_) => match &raw_value {
                    Some(s) => serde_json::Value::String(s.clone()),
                    None => serde_json::Value::Null,
                },
            },
            &Type::BOOL => {
                match row.try_get::<_, Option<bool>>(i) {
                    Ok(Some(v)) => serde_json::Value::Bool(v),
                    Ok(None) => serde_json::Value::Null,
                    Err(_) => {
                        match &raw_value {
                            Some(s) => {
                                // 尝试解析布尔字符串
                                if s.to_lowercase() == "t" || s.to_lowercase() == "true" || s == "1"
                                {
                                    serde_json::Value::Bool(true)
                                } else if s.to_lowercase() == "f"
                                    || s.to_lowercase() == "false"
                                    || s == "0"
                                {
                                    serde_json::Value::Bool(false)
                                } else {
                                    serde_json::Value::String(s.clone())
                                }
                            }
                            None => serde_json::Value::Null,
                        }
                    }
                }
            }
            &Type::TEXT | &Type::VARCHAR | &Type::NAME | &Type::CHAR | &Type::UUID => {
                match row.try_get::<_, Option<String>>(i) {
                    Ok(Some(v)) => serde_json::Value::String(v),
                    _ => serde_json::Value::Null,
                }
            }
            &Type::TIMESTAMP | &Type::TIMESTAMPTZ | &Type::DATE | &Type::TIME => {
                match row.try_get::<_, Option<String>>(i) {
                    Ok(Some(v)) => serde_json::Value::String(v),
                    _ => serde_json::Value::Null,
                }
            }
            &Type::JSON | &Type::JSONB => {
                match row.try_get::<_, Option<String>>(i) {
                    Ok(Some(v)) => serde_json::Value::String(v), // 保持JSON字符串
                    _ => serde_json::Value::Null,
                }
            }
            &Type::NUMERIC => match row.try_get::<_, Option<String>>(i) {
                Ok(Some(v)) => serde_json::Value::String(v),
                _ => serde_json::Value::Null,
            },
            _ => {
                // 对于未知类型，总是尝试原始字符串
                match &raw_value {
                    Some(v) => serde_json::Value::String(v.clone()),
                    None => serde_json::Value::Null,
                }
            }
        };

        // 记录调试信息
        debug_info.insert(
            name.to_string(),
            serde_json::json!({
                "type": format!("{:?}", column_type),
                "value": value.clone(),
                "raw": raw_value
            }),
        );

        map.insert(name.to_string(), value);
    }

    // 在结果中包含调试信息（生产环境中可以移除）
    map.insert("__debug".to_string(), serde_json::Value::Object(debug_info));

    serde_json::Value::Object(map)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            connection: Arc::new(Mutex::new(PostgreSQLConnection { client: None })),
        })
        .invoke_handler(tauri::generate_handler![
            connect_postgresql,
            disconnect_postgresql,
            list_databases,
            list_collections,
            execute_query,
            get_database_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
