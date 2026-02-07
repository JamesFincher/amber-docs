import { httpRouter } from "convex/server";
import { adminRpc } from "./admin_http";

const http = httpRouter();

http.route({
  path: "/admin/rpc",
  method: "POST",
  handler: adminRpc,
});

export default http;

