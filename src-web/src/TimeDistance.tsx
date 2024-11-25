import { useEffect, useState } from "react";

export function TimeDistanceFromNow({ date }: { date: Date }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [date, currentTime]);

  const diff = currentTime.getTime() - date.getTime();
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
