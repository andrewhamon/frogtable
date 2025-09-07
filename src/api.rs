use axum::{
    extract,
    extract::State,
    response::sse::{Event, Sse},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use axum_embed::ServeEmbed;
use futures::stream::Stream;
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt as _;
use ts_rs::TS;

#[derive(RustEmbed, Clone)]
#[folder = "${FROGTABLE_WEB_DIST:-src-web/dist/}"]
struct Assets;

use crate::{
    config,
    db::{self, DbBroadcastEvent::Ping, Ordering},
};

pub fn new(db: db::DB) -> Router {
    let serve_assets = ServeEmbed::<Assets>::new();
    Router::new()
        .route("/rpc", post(rpc_handler))
        .route("/sse", get(sse_handler))
        .fallback_service(serve_assets)
        .with_state(db)
}

async fn rpc_handler(
    State(db): State<db::DB>,
    extract::Json(request): extract::Json<RpcRequest>,
) -> ApiResult<RpcResponse> {
    match request {
        RpcRequest::ExecQuery(ExecQueryRequest {
            name,
            page,
            page_size,
            order_by,
        }) => {
            let page = page.unwrap_or(1);
            let page_size = page_size.unwrap_or(100);
            let ordering = order_by.unwrap_or_default();
            db.refresh_sources(&name)?;
            let data = db.exec_query(&name, page, page_size, &ordering)?;
            Ok(Json(RpcResponse::ExecQuery(ExecQueryResponse {
                total_count: data.total_count,
                data: data.data,
                schema: serde_json::to_value(data.schema)?,
            })))
        }
        RpcRequest::ListQueries => {
            let queries = db.list_queries()?;
            Ok(Json(RpcResponse::ListQueries(ListQueriesResponse {
                queries,
            })))
        }
    }
}

async fn sse_handler(
    State(db): State<db::DB>,
) -> Sse<impl Stream<Item = Result<Event, anyhow::Error>>> {
    let rx = db.tx.subscribe();
    let stream = BroadcastStream::new(rx).map(|data| {
        let event = match data {
            Ok(event) => Event::default().data(serde_json::to_string(&event)?),
            Err(e) => Event::default().data(format!("Error: {}", e)),
        };
        Ok(event)
    });

    let _ = db.tx.send(Ping {
        data: "Hello from the server!".to_string(),
    });

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("keep-alive-text"),
    )
}

type ApiResult<T> = Result<Json<T>, AppError>;

#[derive(TS, Serialize, Deserialize)]
struct ListQueriesResponse {
    queries: Vec<config::Query>,
}

#[derive(TS, Serialize, Deserialize)]
struct ExecQueryRequest {
    name: String,
    page: Option<u32>,
    page_size: Option<u32>,
    order_by: Option<Vec<Ordering>>,
}

#[derive(TS, Serialize, Deserialize)]
struct ExecQueryResponse {
    total_count: u32,
    data: Vec<Vec<serde_json::Value>>,
    schema: serde_json::Value,
}

// Make our own error that wraps `anyhow::Error`.
struct AppError(anyhow::Error);

// Tell axum how to convert `AppError` into a response.
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("{}", self.0),
        )
            .into_response()
    }
}

// This enables using `?` on functions that return `Result<_, anyhow::Error>` to turn them into
// `Result<_, AppError>`. That way you don't need to do that manually.
impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

#[derive(TS, Serialize, Deserialize)]
pub struct ListQueriesRequest {}

#[derive(TS, Serialize, Deserialize)]
#[serde(tag = "rpcType")]
#[ts(export)]
enum RpcRequest {
    ListQueries,
    ExecQuery(ExecQueryRequest),
}

#[derive(TS, Serialize)]
#[serde(tag = "rpcType")]
#[ts(export)]
enum RpcResponse {
    ListQueries(ListQueriesResponse),
    ExecQuery(ExecQueryResponse),
}
