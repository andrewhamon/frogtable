use std::{io, path::PathBuf};

use serde::{Deserialize, Serialize};

static SCRATCH_DIR: std::sync::LazyLock<PathBuf> =
    std::sync::LazyLock::new(|| dirs::cache_dir().unwrap().join("frogtable").join("debug"));

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
pub struct RootConfig {
    pub initializers: Vec<Initializer>,
    pub sources: Vec<Data>,
    pub queries: Vec<Query>,
    pub open: bool,
}

impl RootConfig {
    pub fn new() -> Self {
        Self {
            initializers: vec![],
            sources: vec![],
            queries: vec![],
            open: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]

pub struct Initializer {
    pub source: QuerySource,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
pub struct Data {
    pub name: String,
    pub source: DataSource,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
pub enum DataSource {
    JsonFile(PathBuf),
    JsonCmd(String),
}

impl Data {
    fn out_path_extension(&self) -> String {
        match &self.source {
            DataSource::JsonFile(_) => "json",
            DataSource::JsonCmd(_) => "json",
        }
        .to_owned()
    }

    fn out_path(&self) -> PathBuf {
        SCRATCH_DIR
            .join("sources")
            .join(&self.name)
            .with_extension(self.out_path_extension())
    }

    pub fn path(&self) -> PathBuf {
        match &self.source {
            DataSource::JsonFile(path) => path.clone(),
            DataSource::JsonCmd(_) => self.out_path(),
        }
    }

    pub fn refresh(&self) -> anyhow::Result<()> {
        if let DataSource::JsonCmd(cmd) = &self.source {
            let out_path = self.out_path();
            std::fs::create_dir_all(out_path.parent().unwrap())?;
            let output = std::process::Command::new("bash")
                .arg("-c")
                .arg(cmd.clone())
                .output()?;

            if !output.status.success() {
                eprintln!("Error refreshing source: {}", self.name);
                eprintln!("{}", String::from_utf8_lossy(&output.stderr));
                return Err(anyhow::anyhow!(
                    "Error refreshing source `{}` ({}).\n\n$ {}\n{}",
                    self.name,
                    output.status,
                    cmd,
                    String::from_utf8_lossy(&output.stderr)
                ));
            }

            std::fs::write(&out_path, &output.stdout)?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
pub struct Query {
    pub name: String,
    pub source: QuerySource,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
pub enum QuerySource {
    SqlFile(PathBuf),
    SqlString(String),
}

impl QuerySource {
    pub fn path(&self) -> Option<PathBuf> {
        match &self {
            QuerySource::SqlFile(path) => Some(path.clone()),
            QuerySource::SqlString(_) => None,
        }
    }

    pub fn sql(&self) -> io::Result<String> {
        match &self {
            QuerySource::SqlFile(path) => std::fs::read_to_string(path),
            QuerySource::SqlString(sql) => Ok(sql.clone()),
        }
    }
}
