import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

export function Paginator({
  page,
  pageSize,
  totalCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const firstRowNum = (page - 1) * pageSize + 1;
  const lastRowNum = Math.min(page * pageSize, totalCount);

  const hasPrevPage = page > 1;
  const hasNextPage = lastRowNum < totalCount;
  const prevPage = Math.max(page - 1, 1);
  const nextPage = Math.min(page + 1, Math.ceil(totalCount / pageSize));
  return (
    <div className="flex items-center justify-center space-x-2">
      <button
        className="size-6 rounded-md hover:bg-gray-200 hover:dark:bg-gray-800"
        onClick={() => {
          onPageChange(prevPage);
        }}
        disabled={!hasPrevPage}
      >
        <ChevronLeftIcon className="mx-auto size-4" />
      </button>
      <button className="w-48 rounded-md hover:bg-gray-200 disabled:cursor-not-allowed hover:dark:bg-gray-800">
        <span className="text-center text-xs">
          {firstRowNum} - {lastRowNum}
        </span>
      </button>
      <button
        className="size-6 rounded-md hover:bg-gray-200 disabled:cursor-not-allowed hover:dark:bg-gray-800"
        onClick={() => {
          onPageChange(nextPage);
        }}
        disabled={!hasNextPage}
      >
        <ChevronRightIcon className="mx-auto size-4" />
      </button>
    </div>
  );
}
