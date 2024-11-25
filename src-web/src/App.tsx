import { useEffect, useState } from "react";
import { rpc } from "./rpc";
import { JsonValue } from "./bindings/serde_json/JsonValue";

import { ContextMenuProvider } from "./ContextMenu";

import { ErrorTable } from "./ErrorTable";

import DataTable from "./DataTable";
import QueryList from "./QueryList";
import { Ordering } from "./bindings/Ordering";

function fetchQuery(
  name: string,
  page: number,
  pageSize: number,
  ordering: Ordering[],
) {
  return rpc("ExecQuery", {
    name,
    page,
    page_size: pageSize,
    order_by: ordering,
  });
}

function fetchQueryList() {
  return rpc("ListQueries", {});
}

type JsonObject = {
  [key: string]: JsonValue | undefined;
};

function App() {
  const [queries, setQueries] = useState<string[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sortBy, setSortBy] = useState<Ordering[]>([]);
  const [data, setData] = useState<JsonValue[][] | null>(null);
  const [dataFetchedAt, setDataFetchedAt] = useState<Date>(new Date());
  const [totalCount, setTotalCount] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [schema, setSchema] = useState<JsonObject[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  if (!selectedQuery && queries.length > 0) {
    setSelectedQuery(queries[0]);
  }

  useEffect(() => {
    if (!selectedQuery) {
      return;
    }
    setData([]);
    const startTime = performance.now();
    setDataFetchedAt(new Date());
    fetchQuery(selectedQuery, page, pageSize, sortBy)
      .then((data) => {
        const duration = performance.now() - startTime;
        setDuration(duration);
        setData(data.data);
        setTotalCount(data.total_count);
        setError(null);
        if (typeof data.schema == "object" && !Array.isArray(data.schema)) {
          if (Array.isArray(data.schema.fields)) {
            setSchema(data.schema.fields as JsonObject[]);
          }
        }
      })
      .catch((e) => {
        console.error(e);
        if (e instanceof Error) {
          setError(e);
        }
      });
  }, [selectedQuery, page, pageSize, sortBy]);

  useEffect(() => {
    const bc = new BroadcastChannel("sse");
    bc.onmessage = (event) => {
      console.log(event);
    };

    return () => {
      bc.close();
    };
  }, []);

  useEffect(() => {
    fetchQueryList().then((data) => {
      setQueries(data.queries.map((query) => query.name));
    });
  }, []);

  function handleQuerySelected(query: string) {
    if (query !== selectedQuery) {
      setData(null);
      setSchema(null);
      setTotalCount(0);
      setPage(1);

      if (sortBy.length > 0) {
        setSortBy([]);
      }
    }
    setSelectedQuery(query);
  }

  function handleSortChange(sort: Ordering[]) {
    setSortBy(sort);
    setPage(1);
  }

  return (
    <ContextMenuProvider>
      <div className="grid h-full grid-cols-12 gap-2 bg-gray-50 p-2 font-mono dark:bg-gray-950 dark:text-white">
        <QueryList
          queries={queries}
          selectedQuery={selectedQuery}
          onQuerySelected={handleQuerySelected}
        />

        {data && schema && selectedQuery && error === null ? (
          <DataTable
            key={selectedQuery}
            data={data}
            schema={schema}
            queryName={selectedQuery}
            duration={duration}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={(page) => setPage(page)}
            onPageSizeChange={(pageSize) => setPageSize(pageSize)}
            onSortChange={handleSortChange}
            dataFetchedAt={dataFetchedAt}
          />
        ) : (
          ""
        )}

        {error ? <ErrorTable error={error} /> : ""}
      </div>
    </ContextMenuProvider>
  );
}

export default App;
