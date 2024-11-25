use clap::Parser;
use duckdb::{params, Config as DuckConfig, Connection};
use fallible_iterator::FallibleIterator;
use notify::{event::ModifyKind, Event, EventKind, RecursiveMode, Result, Watcher};
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::sync::mpsc;
use tokio::sync::broadcast;
use ts_rs::TS;

use crate::cli_config::CliConfig;
use crate::config;
use crate::json;

#[derive(Clone)]
pub struct DB {
    pub conn: std::sync::Arc<std::sync::Mutex<Connection>>,
    pub tx: broadcast::Sender<DbBroadcastEvent>,
    pub config: std::sync::Arc<config::RootConfig>,
    pub watcher: std::sync::Arc<std::sync::Mutex<notify::RecommendedWatcher>>,
}

//

impl DB {
    pub async fn new_from_cli_args() -> anyhow::Result<Self> {
        let args: Vec<OsString> = std::env::args_os().collect();
        let prog_name = args[0].clone();
        let args_without_prog_name = &args[1..];

        let mut root_config = config::RootConfig::new();

        // split args into arg groups using '--'
        let cli_configs = args_without_prog_name
            .split(|arg| arg == "--")
            .map(|args| {
                let mut args_vec = vec![prog_name.clone()];
                args_vec.extend(args.to_vec());
                CliConfig::parse_from(args_vec)
            })
            .collect::<Vec<_>>();

        for config in cli_configs.iter() {
            config.append_to_root_config(&mut root_config);
        }

        let conn = Connection::open_in_memory_with_flags(
            DuckConfig::default().allow_unsigned_extensions()?,
        )?;

        let (tx, _) = broadcast::channel::<DbBroadcastEvent>(16);

        let (file_watch_tx, file_watch_rx) = mpsc::channel::<Result<Event>>();

        let root_config_arc = std::sync::Arc::new(root_config);

        let mut watcher = notify::recommended_watcher(file_watch_tx)?;

        for query in root_config_arc.queries.iter() {
            if let Some(path) = query.source.path() {
                watcher.watch(&path, RecursiveMode::NonRecursive)?;
            }
        }

        spawn_file_watcher(file_watch_rx, tx.clone(), root_config_arc.clone());
        spawn_keepalives(tx.clone());

        let db = DB {
            conn: std::sync::Arc::new(conn.into()),
            config: root_config_arc,
            tx: tx,
            watcher: std::sync::Arc::new(std::sync::Mutex::new(watcher)),
        };

        db.init()?;

        Ok(db)
    }

    pub fn init(&self) -> anyhow::Result<()> {
        for config in self.config.initializers.iter() {
            self.conn
                .lock()
                .unwrap()
                .execute_batch(&config.source.sql()?)?;
        }
        self.refresh_sources("all")?;
        for config in self.config.sources.iter() {
            validate_table_name(&config.name)?;
            let escaped_table_name = escape_table_name(&config.name);

            self.conn.lock().unwrap().execute(
                    &format!(
                        "CREATE OR REPLACE VIEW {} AS SELECT * FROM read_json('{}', ignore_errors = true, format = 'unstructured');",
                        escaped_table_name,
                        config.path().display(),
                    ),
                    params![],
                )?;
        }

        Ok(())
    }

    pub fn refresh_sources(&self, query_name: &str) -> anyhow::Result<()> {
        let sources = if query_name == "all" {
            &self.config.sources
        } else {
            &self.find_dependent_sources(query_name)?
        };
        for config in sources.iter() {
            config.refresh()?;
        }

        Ok(())
    }

    pub fn exec_query(
        &self,
        name: &str,
        page: u32,
        per_page: u32,
        order_by: &[Ordering],
    ) -> anyhow::Result<ExecQueryResult> {
        let query = self
            .config
            .queries
            .iter()
            .find(|config| config.name == name)
            .ok_or(anyhow::anyhow!("Query not found"))?;

        validate_table_name(&query.name)?;
        let escaped_table_name = escape_table_name(&query.name);

        let sql = query.source.sql()?;

        self.conn.lock().unwrap().execute(
            &format!("CREATE OR REPLACE VIEW {} AS {}", escaped_table_name, sql,),
            params![],
        )?;

        let order_clause = if order_by.len() > 0 {
            let order_by_str = order_by
                .iter()
                .map(|ordering| ordering.to_sql())
                .collect::<Vec<_>>()
                .join(", ");
            format!("ORDER BY {}", order_by_str)
        } else {
            "".to_string()
        };

        eprint!("order_by: {:?}\n", order_by);

        let wrapped_sql = format!(
            "SELECT * FROM {} {} LIMIT {} OFFSET {};",
            escaped_table_name,
            order_clause,
            per_page,
            (page - 1) * per_page
        );

        let conn = self.conn.lock().unwrap();

        let mut count_stmt =
            conn.prepare(&format!("SELECT COUNT(*) FROM {};", escaped_table_name))?;

        let total_count: u32 = count_stmt.query([])?.next()?.unwrap().get(0)?;

        drop(count_stmt);

        // This is kind of a hack, but it is only possible to get a schema after
        // executing a query.
        let mut stmt: duckdb::Statement<'_> = conn.prepare(&wrapped_sql)?;
        let rows = stmt.query([])?;
        let results = rows
            .map(|r| json::duckdb_row_to_json(r))
            .collect::<Vec<_>>()?;

        let schema: std::sync::Arc<duckdb::arrow::datatypes::Schema> = stmt.schema();

        let result = ExecQueryResult {
            total_count: total_count,
            data: results,
            schema: schema.as_ref().clone(),
        };

        Ok(result)
    }

    pub fn find_dependent_sources(&self, query_name: &str) -> anyhow::Result<Vec<config::Data>> {
        let query = self
            .config
            .queries
            .iter()
            .find(|config| config.name == query_name)
            .ok_or(anyhow::anyhow!("Query not found"))?;

        let mut dependent_sources = vec![];

        let sql_source = query.source.sql()?;

        for data_source in self.config.sources.iter() {
            if sql_source.contains(&data_source.name) {
                dependent_sources.push(data_source.clone());
            }
        }

        Ok(dependent_sources)
    }

    pub fn list_queries(&self) -> anyhow::Result<Vec<config::Query>> {
        Ok(self.config.queries.clone())
    }
}

pub struct ExecQueryResult {
    pub total_count: u32,
    pub data: Vec<Vec<serde_json::Value>>,
    pub schema: duckdb::arrow::datatypes::Schema,
}

#[derive(TS, Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "eventType")]
#[ts(export)]
pub enum DbBroadcastEvent {
    Ping { data: String },
    QueryUpdated { name: String },
}

// I tried format_sql_query crate but it does not add quotes if hyphens are
// present.
fn escape_table_name(name: &str) -> String {
    return format!("\"{}\"", name);
}

fn validate_table_name(name: &str) -> anyhow::Result<()> {
    // name should only contain a-zA-Z0-9-_
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(anyhow::anyhow!("Invalid table name: {}", name));
    }
    Ok(())
}

#[derive(TS, Serialize, Deserialize, Debug)]
pub struct Ordering {
    column: String,
    direction: Direction,
}

impl Ordering {
    pub fn to_sql(&self) -> String {
        format!(
            "\"{}\" {}",
            self.column,
            match self.direction {
                Direction::Asc => "ASC",
                Direction::Desc => "DESC",
            }
        )
    }
}

#[derive(TS, Serialize, Deserialize, Debug)]
pub enum Direction {
    Asc,
    Desc,
}

fn spawn_keepalives(tx: broadcast::Sender<DbBroadcastEvent>) {
    tokio::spawn(async move {
        loop {
            let _ = tx.send(DbBroadcastEvent::Ping {
                data: "keepalive".to_string(),
            });
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    });
}

fn spawn_file_watcher(
    rx: mpsc::Receiver<Result<Event>>,
    tx: broadcast::Sender<DbBroadcastEvent>,
    config: std::sync::Arc<config::RootConfig>,
) {
    eprintln!("Spawning file watcher");
    tokio::task::spawn_blocking(move || {
        eprintln!("Inside spaw blocking");
        for res in rx {
            eprint!("Got file watch event: {:?}\n", res);
            handle_file_watch_event(res, &config, tx.clone());
        }
    });
}

fn handle_file_watch_event(
    event: Result<Event>,
    config: &config::RootConfig,
    tx: broadcast::Sender<DbBroadcastEvent>,
) {
    let queries_to_watch = config
        .queries
        .clone()
        .iter()
        .filter(|q| q.source.path().is_some())
        .map(|q| q.clone())
        .collect::<Vec<_>>();

    tokio::spawn(async move {
        match event {
            Ok(Event {
                kind: EventKind::Modify(ModifyKind::Data(_)),
                paths,
                ..
            }) => {
                for path in paths {
                    for query in queries_to_watch.iter() {
                        eprintln!(
                            "Checking path: {:?} matches {:?}: {}",
                            path,
                            query.source.path().unwrap(),
                            path == query.source.path().unwrap()
                        );
                        if query.source.path().is_some()
                            && query.source.path().unwrap().canonicalize()?
                                == path.canonicalize()?
                        {
                            let result = tx.send(DbBroadcastEvent::QueryUpdated {
                                name: query.name.clone(),
                            });

                            eprintln!("send result: {:?}", result)
                        }
                    }
                }
            }
            Ok(_) => {}
            Err(e) => eprintln!("watch error: {:?}", e),
        };

        Ok::<(), anyhow::Error>(())
    });

    ()
}
