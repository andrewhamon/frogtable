import { useEffect, useState } from "react";

export function TimeDistanceFromNow({ date }: { date: Date }) {
  const [_, rerender] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      rerender((prev) => !prev);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const diff = new Date().getTime() - date.getTime();
  const seconds = diff / 1000;
  const minutes = Math.floor(seconds / 60);

  const suffix = diff > 0 ? "ago" : "from now";

  if (minutes == 0) {
    return (
      <>
        {"<1m"} {suffix}
      </>
    );
  }

  return (
    <>
      {minutes}m {suffix}
    </>
  );
}
