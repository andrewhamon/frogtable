import { useEffect, useState } from "react";
import { rpc } from "./rpc";
import { JsonValue } from "./bindings/serde_json/JsonValue";

import { ContextMenuProvider } from "./ContextMenu";

import { ErrorTable } from "./ErrorTable";

import DataTable from "./DataTable";
import QueryList from "./QueryList";

function fetchQuery(name: string) {
  return rpc("ExecQuery", { name });
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
  const [data, setData] = useState<JsonValue[][] | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [schema, setSchema] = useState<JsonObject[] | null>(null);
  const [forceRefetchData, setForceRefetchData] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  if (!selectedQuery && queries.length > 0) {
    setSelectedQuery(queries[0]);
  }

  useEffect(() => {
    if (!selectedQuery) {
      return;
    }
    const startTime = performance.now();
    fetchQuery(selectedQuery)
      .then((data) => {
        const duration = performance.now() - startTime;
        setDuration(duration);
        setData(data.data);
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
  }, [selectedQuery, forceRefetchData]);

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
    }
    setSelectedQuery(query);
    setForceRefetchData(Math.random());
  }

  return (
    <ContextMenuProvider>
      <div className="grid grid-cols-12 gap-2 p-2 h-full font-mono bg-gray-50 dark:bg-gray-950 dark:text-white">
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
