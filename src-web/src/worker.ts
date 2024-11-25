import { DbBroadcastEvent } from "./bindings/DbBroadcastEvent";

const bc = new BroadcastChannel("sse");

function handleEvent(event: MessageEvent) {
  lastMessageReceivedAt = new Date();
  const data = JSON.parse(event.data) as DbBroadcastEvent;
  if (data.eventType === "Ping") {
    return;
  }
  bc.postMessage(data);
}

function handleError(event: Event) {
  console.error(event);
}

let eventSource: EventSource | null = null;

function connect() {
  eventSource = new EventSource("/sse");
  eventSource.onmessage = handleEvent;
  eventSource.onerror = handleError;
}

connect();

let lastMessageReceivedAt = new Date();

setInterval(() => {
  const now = new Date();
  if (now.getTime() - lastMessageReceivedAt.getTime() > 10000) {
    eventSource?.close();
    connect();
  }
}, 5000);
