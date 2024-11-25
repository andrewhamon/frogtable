import React, { useContext, useEffect, useMemo, useState } from "react";
import { JsonValue } from "./bindings/serde_json/JsonValue";
import { ClockIcon, Bars3BottomLeftIcon } from "@heroicons/react/24/solid";

type JsonObject = {
  [key: string]: JsonValue | undefined;
};

import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  createColumnHelper,
  Table,
  SortingState,
} from "@tanstack/react-table";

// needed for table body level scope DnD setup
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

import { DraggableTableHeader } from "./DraggableTableHeader";
import { DataCell } from "./DataCell";
import { ContextMenuContext } from "./ContextMenu";

function makeColumns(
  schema: JsonObject[],
): ColumnDef<JsonValue[], JsonValue[]>[] {
  const columnHelper = createColumnHelper<JsonValue[]>();
  return schema.map((f, idx) => {
    const field = f as { name: string };
    return columnHelper.accessor((row) => row[idx], {
      header: field.name,
      id: idx.toString(),
      size: 150,
    });
  });
}

function defaultColumnVisibility(schema: JsonObject[]) {
  const columnVisibility: { [key: string]: boolean } = {};
  schema.forEach((f, idx) => {
    const field = f as { name: string };
    if (field.name.startsWith("__")) {
      columnVisibility[idx.toString()] = false;
    } else {
      columnVisibility[idx.toString()] = true;
    }
  });

  return columnVisibility;
}

function DataTable({
  data,
  schema,
  queryName,
  duration,
}: {
  data: JsonValue[][];
  schema: JsonObject[];
  queryName: string;
  duration: number;
}) {
  const columns = useMemo(() => makeColumns(schema), [schema]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<{ [key: string]: number }>(
    () => {
      const sizing = loadColumnSizingFromLocalStorage(queryName, columns);
      return sizing;
    },
  );

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const res = loadColumnOrderFromLocalStorage(queryName, columns);
    return res;
  });

  useEffect(() => {
    saveColumnOrderToLocalStorage(queryName, columnOrder);
  }, [columnOrder, queryName]);

  useEffect(() => {
    saveColumnSizingToLocalStorage(queryName, columnSizing);
  }, [columnSizing, queryName]);

  const columnVisibility = useMemo(
    () => defaultColumnVisibility(schema),
    [schema],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      columnOrder,
      sorting,
      columnVisibility,
      columnSizing,
    },
    defaultColumn: {
      minSize: 24,
    },
    columnResizeMode: "onChange",
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    debugTable: true,
    debugHeaders: true,
    debugColumns: true,
  });

  // reorder columns after drag & drop
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((columnOrder) => {
        const oldIndex = columnOrder.indexOf(active.id as string);
        const newIndex = columnOrder.indexOf(over.id as string);
        return arrayMove(columnOrder, oldIndex, newIndex); //this is just a splice util
      });
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  const columnSizeVars = (() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    let totalWidth = 0;
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
      totalWidth += header.getSize();
    }
    // Allow for overscrolling to the right - makes it less annoying to resize
    // the rightmost column
    const overScrollAmount = 800;
    colSizes["--col-total-width"] = totalWidth + overScrollAmount;
    return colSizes;
  })();

  const contextMenuContext = useContext(ContextMenuContext);

  return (
    <div
      className={`col-span-10 flex select-none flex-col overscroll-none rounded-lg border-2 border-gray-500 dark:border-gray-700 ${
        contextMenuContext.active ? "overflow-hidden" : "overflow-scroll"
      }`}
      style={{
        ...columnSizeVars,
        scrollbarWidth: "none",
      }}
    >
      <div
        className="relative grow cursor-crosshair"
        style={{ minWidth: `calc(var(--col-total-width) * 1px)` }}
      >
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <div className="sticky top-0 border-b-2 border-gray-500 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
            {table.getHeaderGroups().map((headerGroup) => (
              <div key={headerGroup.id} className="flex">
                <SortableContext
                  items={columnOrder}
                  strategy={horizontalListSortingStrategy}
                >
                  {headerGroup.headers.map((header) => (
                    <DraggableTableHeader key={header.id} header={header} />
                  ))}
                  {/* <div className="w-32 relative">a</div> */}
                </SortableContext>
              </div>
            ))}
          </div>
          {table.getState().columnSizingInfo.isResizingColumn ? (
            <MemoizedTableBody table={table} />
          ) : (
            <TableBody table={table} />
          )}
        </DndContext>
      </div>
      <div className="sticky bottom-0 left-0 flex justify-between border-t-2 border-gray-500 bg-gray-50 px-2 py-0.5 dark:border-gray-700 dark:bg-gray-950">
        <div>
          {/* Left */}
          <Bars3BottomLeftIcon className="inline-block size-4" />
          <em className="pl-1 pr-2 text-xs">
            {data.length} row{data.length !== 1 ? "s" : ""}
          </em>
          <ClockIcon className="inline-block size-4" />
          <em className="pl-1 pr-2 text-xs">{duration.toFixed(0)}ms</em>
        </div>
        <div>{/* Center */}</div>
        <div>{/* Right */}</div>
      </div>
    </div>
  );
}

function TableBody({ table }: { table: Table<JsonValue[]> }) {
  return (
    <div className="shadow-inner">
      {table.getRowModel().rows.map((row) => (
        <div
          key={row.id}
          className="flex odd:bg-gray-200 even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-950"
        >
          {row.getVisibleCells().map((cell) => {
            return <DataCell key={cell.id} cell={cell} />;
          })}
        </div>
      ))}
    </div>
  );
}

export const MemoizedTableBody = React.memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data,
) as typeof TableBody;

export default DataTable;

function loadColumnOrderFromLocalStorage(
  queryName: string,
  columnDefs: ColumnDef<JsonValue[], JsonValue[]>[],
) {
  const validColumnIds = columnDefs.map((c) => c.id);
  const storedColumnIds = getColumnOrderFromLocalStorage(queryName)?.filter(
    (c) => validColumnIds.includes(c),
  );
  const missingColumnIds = validColumnIds.filter(
    (c) => typeof c === "string" && !storedColumnIds.includes(c),
  ) as string[];

  return [...missingColumnIds, ...storedColumnIds];
}

function getColumnOrderFromLocalStorage(queryName: string) {
  try {
    const storedColumnOrder = localStorage.getItem(`columnOrder-${queryName}`);
    if (storedColumnOrder) {
      const columnOrder = JSON.parse(storedColumnOrder);
      // ensure it is an array of strings
      if (
        Array.isArray(columnOrder) &&
        columnOrder.every((c) => typeof c === "string")
      ) {
        return columnOrder;
      } else {
        console.error("Invalid column order in local storage", columnOrder);
        localStorage.removeItem(`columnOrder-${queryName}`);
      }
    }
  } catch (e) {
    console.error("Failed to parse column order from local storage", e);
    localStorage.removeItem(`columnOrder-${queryName}`);
  }

  return [];
}

function saveColumnOrderToLocalStorage(
  queryName: string,
  columnOrder: string[],
) {
  localStorage.setItem(`columnOrder-${queryName}`, JSON.stringify(columnOrder));
}

function loadColumnSizingFromLocalStorage(
  queryName: string,
  columnDefs: ColumnDef<JsonValue[], JsonValue[]>[],
) {
  const columnSizes = getColumnSizingFromLocalStorage(queryName);
  const validColumnIds = columnDefs.map((c) => c.id);
  const validColumnSizes: { [key: string]: number } = {};
  for (const [key, value] of Object.entries(columnSizes)) {
    if (validColumnIds.includes(key)) {
      validColumnSizes[key] = value as number;
    }
  }

  return validColumnSizes;
}

function getColumnSizingFromLocalStorage(queryName: string) {
  try {
    const storedColumnSizing = localStorage.getItem(
      `columnSizing-${queryName}`,
    );
    if (storedColumnSizing) {
      const columnSizing = JSON.parse(storedColumnSizing);
      // ensure it is an object of strings
      if (
        typeof columnSizing === "object" &&
        Object.values(columnSizing).every((c) => typeof c === "number")
      ) {
        return columnSizing;
      } else {
        console.error("Invalid column sizing in local storage", columnSizing);
        localStorage.removeItem(`columnSizing-${queryName}`);
      }
    }
  } catch (e) {
    console.error("Failed to parse column sizing from local storage", e);
    localStorage.removeItem(`columnSizing-${queryName}`);
  }

  return {};
}

function saveColumnSizingToLocalStorage(
  queryName: string,
  columnSizing: { [key: string]: number },
) {
  localStorage.setItem(
    `columnSizing-${queryName}`,
    JSON.stringify(columnSizing),
  );
}
