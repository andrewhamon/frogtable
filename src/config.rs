use clap::{Args, Parser};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

static SCRATCH_DIR: std::sync::LazyLock<PathBuf> =
    std::sync::LazyLock::new(|| dirs::cache_dir().unwrap().join("frogtable").join("debug"));

#[derive(Parser, Debug, Clone)]
#[command(version, about, long_about = None)]
pub struct CliConfig {
    #[command(flatten)]
    pub source: CliSource,

    #[arg(long, required = false)]
    pub name: Option<String>,

    #[arg(long, required = false)]
    pub no_open: bool,
}

#[derive(Args, Debug, Clone)]
#[group(required = true, multiple = false)]
pub struct CliSource {
    #[arg(long)]
    pub json_file: Option<PathBuf>,
    #[arg(long)]
    pub json_cmd: Option<String>,
    #[arg(long)]
    pub sql_file: Option<PathBuf>,
    #[arg(long, requires = "name")]
    pub sql: Option<String>,
}

impl CliConfig {
    pub fn to_config(&self) -> anyhow::Result<Config> {
        match &self.source {
            CliSource {
                json_file: Some(path),
                json_cmd: None,
                sql_file: None,
                sql: None,
            } => Config::from_json_file(self.name.as_deref(), path),
            CliSource {
                json_file: None,
                json_cmd: Some(command),
                sql_file: None,
                sql: None,
            } => Config::from_json_cmd(self.name.as_deref(), command),
            CliSource {
                json_file: None,
                json_cmd: None,
                sql_file: Some(path),
                sql: None,
            } => Config::from_sql_file(self.name.as_deref(), path),
            CliSource {
                json_file: None,
                json_cmd: None,
                sql_file: None,
                sql: Some(sql),
            } => Config::from_sql_string(self.name.as_deref(), sql),
            _ => panic!("Invalid config"),
        }
    }
}

#[derive(Debug, Clone)]

pub struct TableConfig {
    pub name: String,
    pub source: TableSource,
}

impl TableConfig {
    pub fn json_out(&self) -> PathBuf {
        SCRATCH_DIR
            .join("sources")
            .join(&self.name)
            .with_extension("json")
    }

    pub fn json_path(&self) -> PathBuf {
        match &self.source {
            TableSource::JsonFile(path) => path.clone(),
            TableSource::ShellCommand(_) => self.json_out(),
        }
    }
}

#[derive(Debug, Clone)]

pub enum TableSource {
    JsonFile(PathBuf),
    ShellCommand(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]

pub struct QueryConfig {
    pub name: String,
    pub source: QuerySource,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[serde(tag = "type")]

pub enum QuerySource {
    SqlFile { source: PathBuf },
    SqlString { contents: String },
}

#[derive(Debug, Clone)]
pub enum Config {
    Table(TableConfig),
    Query(QueryConfig),
}

impl Config {
    pub fn from_json_file(name: Option<&str>, path: &PathBuf) -> anyhow::Result<Self> {
        let optname = name.or_else(|| path.file_stem().and_then(|s| s.to_str()));

        let name = optname.ok_or(anyhow::anyhow!(
            "Name not provided, and also could not infer name from path {}. Please supply a name using --name.",
            path.display()
        ))?;

        Ok(Config::Table(TableConfig {
            name: name.to_string(),
            source: TableSource::JsonFile(path.clone()),
        }))
    }

    pub fn from_json_cmd(name: Option<&str>, command: &str) -> anyhow::Result<Self> {
        let name = name.ok_or(anyhow::anyhow!(
            "--name must be provided when using --json-cmd",
        ))?;

        Ok(Config::Table(TableConfig {
            name: name.to_string(),
            source: TableSource::ShellCommand(command.to_string()),
        }))
    }

    pub fn from_sql_file(name: Option<&str>, path: &PathBuf) -> anyhow::Result<Self> {
        let optname = name.or_else(|| path.file_stem().and_then(|s| s.to_str()));

        let name = optname.ok_or(anyhow::anyhow!(
            "Name not provided, and also could not infer name from path {}. Please supply a name using --name.",
            path.display()
        ))?;

        Ok(Config::Query(QueryConfig {
            name: name.to_string(),
            source: QuerySource::SqlFile {
                source: path.clone(),
            },
        }))
    }

    pub fn from_sql_string(name: Option<&str>, sql: &str) -> anyhow::Result<Self> {
        let name = name.ok_or(anyhow::anyhow!("--name must be provided when using --sql",))?;

        Ok(Config::Query(QueryConfig {
            name: name.to_string(),
            source: QuerySource::SqlString {
                contents: sql.to_string(),
            },
        }))
    }
}
