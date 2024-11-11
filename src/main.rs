mod api;
mod config;
mod db;
mod json;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let db = db::DB::new_from_cli_args().await?;

    let app = api::new(db);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
