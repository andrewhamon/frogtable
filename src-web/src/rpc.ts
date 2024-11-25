import { RpcRequest } from "./bindings/RpcRequest";
import { RpcResponse } from "./bindings/RpcResponse";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type RpcName = RpcRequest["rpcType"];
type RpcRequestVal<T extends RpcName> = Omit<
  Extract<RpcRequest, { rpcType: T }>,
  "rpcType"
>;
type RpcResponseVal<T extends RpcName> = Prettify<
  Omit<Extract<RpcResponse, { rpcType: T }>, "rpcType">
>;

export class RpcError extends Error {
  body: string;
  request: Request;
  response: Response;
  constructor(body: string, request: Request, response: Response) {
    super(body);
    this.name = "RpcError";
    this.body = body;
    this.request = request;
    this.response = response;
  }
}

export function rpc<T extends RpcName>(
  rpcType: T,
  req: RpcRequestVal<T>,
): Promise<RpcResponseVal<T>> {
  const taggedReq = { rpcType: rpcType, ...req };
  const request = new Request(`/rpc?rpcType=${rpcType}`, {
    body: JSON.stringify(taggedReq),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return fetch(request).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new RpcError(text, request, response);
    }

    return await response.json();
  });
}
