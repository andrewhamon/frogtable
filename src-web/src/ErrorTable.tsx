import { CodeBlock } from "react-code-block";
import { RpcError } from "./rpc";

export function ErrorTable({ error }: { error: Error }) {
  let statusCode: number | null = null;
  let statusText: string | null = null;
  let requestMethod: string | null = null;
  let requestUrl: string | null = null;

  if (error instanceof RpcError) {
    statusCode = error.response.status;
    statusText = error.response.statusText;
    requestMethod = error.request.method;
    requestUrl = error.request.url;
  }

  return (
    <div
      className={`col-span-10 flex flex-col overflow-scroll overscroll-none rounded-lg border-2 border-gray-500 dark:border-gray-700`}
      style={{
        scrollbarWidth: "none",
      }}
    >
      <div className="sticky top-0 border-b-2 border-gray-500 px-2 py-1 font-bold dark:border-gray-700">
        {error.name} {requestMethod ? "- " : " "}
        {requestMethod} {requestUrl}{" "}
        {statusCode ? `(${statusCode} ${statusText})` : null}
      </div>

      {error.message ? (
        <CodeBlock code={error.message} language="none">
          <CodeBlock.Code className="bg-red-700 p-6 text-white shadow-lg dark:bg-red-900">
            <div className="table-row">
              <CodeBlock.LineNumber className="table-cell select-none pr-4 text-right text-sm text-gray-400 dark:text-gray-500" />

              <CodeBlock.LineContent className="table-cell">
                <CodeBlock.Token className="text-gray-300 dark:text-gray-300" />
              </CodeBlock.LineContent>
            </div>
          </CodeBlock.Code>
        </CodeBlock>
      ) : (
        <p className="bg-red-700 p-2 text-gray-300 dark:bg-red-900 dark:text-gray-300">
          <em>No message</em>
        </p>
      )}
    </div>
  );
}
