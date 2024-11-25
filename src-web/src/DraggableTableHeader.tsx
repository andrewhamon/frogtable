import { CSSProperties, useState } from "react";
import { JsonValue } from "./bindings/serde_json/JsonValue";

import { Header, flexRender } from "@tanstack/react-table";

// needed for row & cell level scope DnD setup
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const CLICK_DURATION = 200;

export function DraggableTableHeader({
  header,
}: {
  header: Header<JsonValue[], unknown>;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.column.id,
    });

  const dragAttrs = { ...attributes, ...listeners };

  // Major hack - react drag and drop conflicts with the onClick event, which
  // we want to use for sorting. To workaround that, we we will change the
  // column sort on mouse up if the mouse down and up events are within a
  // short duration (CLICK_DURATION). This is not ideal, but it works, and gives
  // the desired experience.
  const [mouseDownAt, setMouseDownAt] = useState<number | null>(null);

  function onMouseDownHandler(event: unknown) {
    setMouseDownAt(Date.now());
    const dndMouseDown = listeners && listeners["onMouseDown"];
    if (dndMouseDown) {
      dndMouseDown(event);
    }
  }

  function onMouseUpHandler(event: unknown) {
    if (mouseDownAt && Date.now() - mouseDownAt < CLICK_DURATION) {
      const handler = header.column.getToggleSortingHandler();
      if (handler) {
        handler(event);
      }
    }

    setMouseDownAt(null);

    const dndMouseUp = listeners && listeners["onMouseUp"];
    if (dndMouseUp) {
      dndMouseUp();
    }
  }

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
    transition: "width transform 0.2s ease-in-out",
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div className="group relative" ref={setNodeRef} style={style}>
      <div
        className="group w-full cursor-pointer overflow-hidden text-ellipsis text-nowrap px-1 py-1 font-bold"
        style={{
          width: `calc(var(--header-${header.id}-size) * 1px)`,
        }}
        title={
          header.column.getCanSort()
            ? header.column.getNextSortingOrder() === "asc"
              ? `${header.column.columnDef.header}\n\nClick to sort ascending`
              : header.column.getNextSortingOrder() === "desc"
                ? `${header.column.columnDef.header}\n\nClick to sort descending`
                : `${header.column.columnDef.header}\n\nClick to clear sort`
            : undefined
        }
        {...dragAttrs}
        onMouseDown={onMouseDownHandler}
        onMouseUp={onMouseUpHandler}
      >
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        <span>
          {{
            asc: ArrowLongUp(),
            desc: ArrowLongDown(),
          }[header.column.getIsSorted() as string] ?? null}
        </span>
      </div>
      <div
        className="group-hover:dark:bg-grey-700 absolute right-0 top-0 h-full w-2 cursor-col-resize group-hover:bg-gray-400"
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
      />
    </div>
  );
}

function ArrowLongDown() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="inline size-4"
    >
      <path
        fillRule="evenodd"
        d="M12 2.25a.75.75 0 0 1 .75.75v16.19l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 1 1 1.06-1.06l2.47 2.47V3a.75.75 0 0 1 .75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowLongUp() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="inline size-4"
    >
      <path
        fillRule="evenodd"
        d="M11.47 2.47a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 0 1-1.06 1.06l-2.47-2.47V21a.75.75 0 0 1-1.5 0V4.81L8.78 7.28a.75.75 0 0 1-1.06-1.06l3.75-3.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
