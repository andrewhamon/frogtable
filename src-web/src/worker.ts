const bc = new BroadcastChannel("sse");
const eventSource = new EventSource("/sse");
eventSource.onmessage = (event) => {
  bc.postMessage(event.data);
};
