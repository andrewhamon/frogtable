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
    <div className="col-span-2 rounded-lg border-2 border-gray-500 dark:border-gray-700">
      <h2 className="border-b-2 border-gray-500 px-2 py-1 font-bold dark:border-gray-700">
        Queries
      </h2>
      {queries.map((query) => (
        <button
          className={classNames(
            "block h-8 w-full cursor-pointer border border-transparent px-2 py-0.5 text-left hover:border-blue-500",
            {
              "bg-blue-500 text-white hover:border-blue-800":
                query === selectedQuery,
            },
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
