import classNames from "classnames";

function QueryList({
  queries,
  selectedQuery,
  onQuerySelected,
}: {
  queries: string[];
  selectedQuery: string | null;
  onQuerySelected: (query: string) => void;
}) {
  return (
    <div className="col-span-2 border-2 rounded-lg border-gray-500 dark:border-gray-700">
      <h2 className="font-bold py-1 px-2 border-b-2 border-gray-500 dark:border-gray-700">
        Queries
      </h2>
      {queries.map((query) => (
        <button
          className={classNames(
            "block cursor-pointer h-8 px-2 py-0.5 w-full text-left border border-transparent hover:border-blue-500",
            {
              "bg-blue-500 text-white hover:border-blue-800":
                query === selectedQuery,
            }
          )}
          key={query}
          onClick={() => onQuerySelected(query)}
        >
          {query}
        </button>
      ))}
    </div>
  );
}

export default QueryList;
