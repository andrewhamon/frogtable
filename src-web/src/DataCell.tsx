import { useState, ReactNode } from "react";
import { JsonValue } from "./bindings/serde_json/JsonValue";
import classNames from "classnames";

import { Cell } from "@tanstack/react-table";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

export function DataCell({ cell }: { cell: Cell<JsonValue[], JsonValue[]> }) {
  const [copied, setCopied] = useState(false);

  const columnIndex = parseInt(cell.column.id);
  const nextColumnIndex = columnIndex + 1;
  let nextColumn = null;

  if (nextColumnIndex < cell.row.original.length) {
    nextColumn = cell.getContext().table.getColumn(nextColumnIndex.toString());
  }
  const nextColumnName = nextColumn?.columnDef.header;

  let extraClassNames = "";
  let columnHref = "";

  const [contextMenuActive, setContextMenuActive] = useState(false);
  const [contextMenuX, setContextMenuX] = useState(0);
  const [contextMenuY, setContextMenuY] = useState(0);

  function handleDismissContextMenu() {
    setContextMenuActive(false);
  }

  if (nextColumnName?.toString().startsWith("__style__")) {
    const nextCell = cell.row.original[nextColumnIndex];
    if (typeof nextCell === "object" && !Array.isArray(nextCell)) {
      if (nextCell?.class) {
        extraClassNames = nextCell.class as string;
      }
      if (nextCell?.href) {
        columnHref = nextCell.href as string;
      }
    }
  }

  let inner;
  if (columnHref !== "") {
    inner = (
      <a href={columnHref} target="_blank" onClick={(e) => e.stopPropagation()}>
        {renderValue(cell.getValue())}
      </a>
    );
  } else {
    inner = renderValue(cell.getValue());
  }

  return (
    <div
      className={`flex h-8 items-center border border-transparent px-1 hover:border-blue-500`}
      onClick={() => {
        navigator.clipboard.writeText(renderValueToString(cell.getValue()));
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
      onContextMenu={(event) => {
        const { clientX, clientY } = event;
        setContextMenuActive(true);
        setContextMenuX(clientX);
        setContextMenuY(clientY);
        event.preventDefault();
      }}
      style={{
        width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
      }}
    >
      <div
        className={classNames(
          "overflow-hidden text-ellipsis text-nowrap",
          {
            copied,
          },
          extraClassNames,
        )}
        // style={{
        //   width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
        // }}
      >
        {copied ? <em>Copied</em> : inner}
      </div>
      {contextMenuActive ? (
        <ContextMenu
          x={contextMenuX}
          y={contextMenuY}
          active={contextMenuActive}
          onDismiss={handleDismissContextMenu}
        >
          <ContextMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigator.clipboard.writeText(
                renderValueToString(cell.getValue()),
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 1000);
              handleDismissContextMenu();
            }}
          >
            Copy
          </ContextMenuItem>
          {columnHref !== "" ? (
            <ContextMenuItem
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(columnHref);
                setCopied(true);
                setTimeout(() => setCopied(false), 1000);
                handleDismissContextMenu();
              }}
            >
              Copy Link
            </ContextMenuItem>
          ) : null}
        </ContextMenu>
      ) : null}
    </div>
  );
}

function renderValue(value: JsonValue): ReactNode {
  if (value === null) {
    return <em>null</em>;
  }
  switch (typeof value) {
    case "string":
    case "number":
    case "bigint":
    case "boolean":
    case "symbol":
      return value.toString();
    case "undefined":
      return <em>undefined</em>;
    case "object":
      return JSON.stringify(value);
  }
}

function renderValueToString(value: JsonValue): string {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "string":
    case "number":
    case "bigint":
    case "boolean":
    case "symbol":
      return value.toString();
    case "undefined":
      return "undefined";
    case "object":
      return JSON.stringify(value);
  }
}
