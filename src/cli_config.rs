use clap::{Args, Parser};
use std::path::PathBuf;

use crate::config;

#[derive(Parser, Debug, Clone)]
#[command(version, about, long_about = None)]
pub struct CliConfig {
    #[command(flatten)]
    pub source: CliSource,

    #[arg(long, required = false)]
    pub name: Option<String>,

    #[arg(long, required = false)]
    pub open: bool,
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
    #[arg(long)]
    pub setup_sql: Option<String>,
}

fn name_from_path(path: &PathBuf) -> Option<String> {
    path.file_stem().map(|s| s.to_string_lossy().to_string())
}

impl CliConfig {
    pub fn append_to_root_config(&self, root_config: &mut config::RootConfig) {
        if self.open {
            root_config.open = true;
        }

        match &self.source {
            CliSource {
                json_file: Some(path),
                json_cmd: None,
                sql_file: None,
                sql: None,
                setup_sql: None,
            } => root_config.sources.push(config::Data {
                name: self.name.clone().or(name_from_path(path)).unwrap(),
                source: config::DataSource::JsonFile(path.clone()),
            }),
            CliSource {
                json_file: None,
                json_cmd: Some(command),
                sql_file: None,
                sql: None,
                setup_sql: None,
            } => root_config.sources.push(config::Data {
                name: self.name.clone().unwrap(),
                source: config::DataSource::JsonCmd(command.clone()),
            }),
            CliSource {
                json_file: None,
                json_cmd: None,
                sql_file: Some(path),
                sql: None,
                setup_sql: None,
            } => root_config.queries.push(config::Query {
                name: self.name.clone().or(name_from_path(path)).unwrap(),
                source: config::QuerySource::SqlFile(path.clone()),
            }),
            CliSource {
                json_file: None,
                json_cmd: None,
                sql_file: None,
                sql: Some(sql),
                setup_sql: None,
            } => root_config.queries.push(config::Query {
                name: self.name.clone().unwrap(),
                source: config::QuerySource::SqlString(sql.clone()),
            }),
            CliSource {
                json_file: None,
                json_cmd: None,
                sql_file: None,
                sql: None,
                setup_sql: Some(sql),
            } => root_config.initializers.push(config::Initializer {
                source: config::QuerySource::SqlString(sql.clone()),
            }),
            _ => panic!("Invalid config"),
        }
    }
}
