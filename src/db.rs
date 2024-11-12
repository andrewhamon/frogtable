use clap::Parser;
use duckdb::{params, Connection};
use fallible_iterator::FallibleIterator;
use std::ffi::OsString;
use tokio::sync::broadcast;

use crate::config::{CliConfig, Config, QueryConfig, QuerySource, TableSource};
use crate::json;

#[derive(Clone)]
pub struct DB {
    pub conn: std::sync::Arc<std::sync::Mutex<Connection>>,
    pub tx: broadcast::Sender<DbBroadcastEvent>,
    pub configs: std::sync::Arc<[Config]>,
}

impl DB {
    pub async fn new_from_cli_args() -> anyhow::Result<Self> {
        let args: Vec<OsString> = std::env::args_os().collect();
        let prog_name = args[0].clone();
        let args_without_prog_name = &args[1..];

        // split args into arg groups using '--'
        let cli_configs = args_without_prog_name
            .split(|arg| arg == "--")
            .map(|args| {
                let mut args_vec = vec![prog_name.clone()];
                args_vec.extend(args.to_vec());
                CliConfig::parse_from(args_vec)
            })
            .collect::<Vec<_>>();

        let configs = cli_configs
            .iter()
            .map(|cli_config| cli_config.to_config())
            .collect::<anyhow::Result<Vec<Config>>>()?;

        let conn = Connection::open_in_memory()?;

        let (tx, _) = broadcast::channel::<DbBroadcastEvent>(16);

        let db = DB {
            conn: std::sync::Arc::new(conn.into()),
            configs: configs.into(),
            tx,
        };

        db.init()?;

        Ok(db)
    }

    pub fn init(&self) -> anyhow::Result<()> {
        self.refresh_sources("all")?;
        for config in self.configs.iter() {
            if let Config::Table(table) = config {
                validate_table_name(&table.name)?;
                let escaped_table_name = escape_table_name(&table.name);

                self.conn.lock().unwrap().execute(
                    &format!(
                        "CREATE OR REPLACE VIEW {} AS SELECT * FROM read_json('{}', ignore_errors = true, format = 'unstructured');",
                        escaped_table_name,
                        table.json_path().display()
                    ),
                    params![],
                )?;
            }
        }

        Ok(())
    }

    pub fn refresh_sources(&self, name: &str) -> anyhow::Result<()> {
        let sources = if name == "all" {
            self.configs.to_vec()
        } else {
            self.find_dependent_sources(name)?
        };
        for config in sources.iter() {
            if let Config::Table(table) = config {
                let source = table.clone().source;
                let source_name = table.name.clone();

                if let TableSource::ShellCommand(cmd) = source {
                    eprintln!("Refreshing source: {}", source_name);
                    let json_out = table.json_out();
                    std::fs::create_dir_all(json_out.parent().unwrap())?;
                    let output = std::process::Command::new("bash")
                        .arg("-c")
                        .arg(cmd.clone())
                        .output()?;

                    if !output.status.success() {
                        eprintln!("Error refreshing source: {}", source_name);
                        eprintln!("{}", String::from_utf8_lossy(&output.stderr));
                        return Err(anyhow::anyhow!(
                            "Error refreshing source `{}` ({}).\n\n$ {}\n{}",
                            source_name,
                            output.status,
                            cmd,
                            String::from_utf8_lossy(&output.stderr)
                        ));
                    }

                    std::fs::write(&json_out, &output.stdout)?;
                }
            }
        }

        Ok(())
    }

    pub fn exec_query(&self, name: &str) -> anyhow::Result<ExecQueryResult> {
        let config = self
            .configs
            .iter()
            .find(|config| match config {
                Config::Query(query) => query.name == name,
                _ => false,
            })
            .ok_or(anyhow::anyhow!("Query not found"))?;

        let query = match config {
            Config::Query(query) => query,
            _ => unreachable!(),
        };

        let sql = match &query.source {
            QuerySource::SqlFile { source: path } => std::fs::read_to_string(path)?,
            QuerySource::SqlString { contents: sql } => sql.clone(),
        };

        let conn = self.conn.lock().unwrap();

        // This is kind of a hack, but it is only possible to get a schema after
        // executing a query.
        let mut stmt: duckdb::Statement<'_> = conn.prepare(&sql)?;
        let rows = stmt.query([])?;
        let results = rows
            .map(|r| json::duckdb_row_to_json(r))
            .collect::<Vec<_>>()?;

        let schema: std::sync::Arc<duckdb::arrow::datatypes::Schema> = stmt.schema();

        let result = ExecQueryResult {
            data: results,
            schema: schema.as_ref().clone(),
        };

        Ok(result)
    }

    pub fn find_dependent_sources(&self, query_name: &str) -> anyhow::Result<Vec<Config>> {
        let query_config = self
            .configs
            .iter()
            .find(|config| match config {
                Config::Query(query) => query.name == query_name,
                _ => false,
            })
            .ok_or(anyhow::anyhow!("Query not found"))?;

        let mut dependent_sources = vec![];

        let sql_source = match &query_config {
            Config::Query(QueryConfig {
                source: QuerySource::SqlString { contents },
                ..
            }) => contents.to_owned(),
            Config::Query(QueryConfig {
                source: QuerySource::SqlFile { source },
                ..
            }) => std::fs::read_to_string(source)?,
            _ => "".to_owned(),
        };

        for config in self.configs.iter() {
            if let Config::Table(table) = config {
                if let TableSource::ShellCommand(_) = &table.source {
                    if sql_source.contains(&table.name) {
                        dependent_sources.push(config.clone());
                    }
                }
            }
        }

        Ok(dependent_sources)
    }

    pub fn list_queries(&self) -> anyhow::Result<Vec<QueryConfig>> {
        let queries = self
            .configs
            .iter()
            .filter_map(|config| match config {
                Config::Query(query) => Some(query.to_owned()),
                _ => None,
            })
            .collect::<Vec<_>>();

        Ok(queries)
    }
}

pub struct ExecQueryResult {
    pub data: Vec<Vec<serde_json::Value>>,
    pub schema: duckdb::arrow::datatypes::Schema,
}

#[derive(Debug, Clone)]
pub enum DbBroadcastEvent {
    Ping { data: String },
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
