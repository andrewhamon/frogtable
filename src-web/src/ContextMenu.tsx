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
      className="fixed z-10 w-64 rounded-lg border-2 border-gray-500 bg-gray-50/50 drop-shadow backdrop-blur-md dark:border-gray-700 dark:bg-gray-950/50"
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
      className="w-full cursor-default overflow-hidden text-ellipsis text-nowrap rounded-md border-2 border-transparent px-2 text-left hover:border-blue-500 hover:bg-blue-500 hover:text-white"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
