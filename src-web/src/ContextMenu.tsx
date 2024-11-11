import {
  useEffect,
  useRef,
  createContext,
  useState,
  useContext,
  useMemo,
} from "react";

export const ContextMenuContext = createContext<{
  active: boolean;
  setActive: (active: boolean) => void;
}>({
  active: false,
  setActive: () => {},
});

export function ContextMenuProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(false);
  const value = useMemo(() => ({ active, setActive }), [active, setActive]);
  return (
    <ContextMenuContext.Provider value={value}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function ContextMenu({
  x,
  y,
  active,
  onDismiss,
  children = null,
}: {
  x: number;
  y: number;
  active: boolean;
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  const leftOffset = x;
  const rightOffset = windowWidth - x;
  const topOffset = y;
  const bottomOffset = windowHeight - y;

  const xDirection = leftOffset > rightOffset ? "right" : "left";
  const yDirection = topOffset > bottomOffset ? "bottom" : "top";
  const xAmount = xDirection === "left" ? leftOffset : rightOffset;
  const yAmount = yDirection === "top" ? topOffset : bottomOffset;

  const ref = useRef<HTMLDivElement>(null);

  const contextMenuContext = useContext(ContextMenuContext);

  useEffect(() => {
    contextMenuContext.setActive(true);
    return () => {
      contextMenuContext.setActive(false);
    };
  }, [contextMenuContext]);

  useEffect(() => {
    /**
     * Alert if clicked on outside of element
     */
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        onDismiss();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, onDismiss]);

  if (!active) {
    return null;
  }

  return (
    <div
      className="bg-gray-50/50 dark:bg-gray-950/50 backdrop-blur-md drop-shadow w-64 fixed z-10 border-2 rounded-lg border-gray-500 dark:border-gray-700"
      style={{
        [xDirection]: `${xAmount}px`,
        [yDirection]: `${yAmount}px`,
      }}
      ref={ref}
    >
      {children}
    </div>
  );
}

export function ContextMenuItem({
  onClick,
  children,
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="w-full text-left text-nowrap text-ellipsis overflow-hidden px-2 cursor-default rounded-md hover:bg-blue-500 border-2 border-transparent hover:border-blue-500 hover:text-white"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
