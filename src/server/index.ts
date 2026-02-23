// Server entry point — implemented in task 2.1
import { serve } from "bun";
import index from "../index.html";

const PORT = Number(process.env["PORT"] ?? 3000);

const server = serve({
  port: PORT,
  routes: {
    "/*": index,
  },
  development: process.env["NODE_ENV"] !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
