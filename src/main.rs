use open;
use tokio::time::{sleep, Duration};

mod api;
mod cli_config;
mod config;
mod db;
mod json;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let db = db::DB::new_from_cli_args().await?;

    let should_open = db.config.open;

    let app = api::new(db);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    if should_open {
        tokio::task::spawn(async move {
            // give a little time for the server to start
            sleep(Duration::from_millis(10)).await;
            let _ = open::that("http://localhost:3000");
        });
    }

    axum::serve(listener, app).await.unwrap();

    Ok(())
}
