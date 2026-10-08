import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
async function handler(req: Request) {
  try {
    return await toNextJsHandler(auth())[req.method === "GET" ? "GET" : "POST"](
      req,
    );
  } catch (e) {
    console.error("auth", e instanceof Error ? e.message : "error");
    return Response.json(
      { error: "Authentication is unavailable. Contact the administrator." },
      { status: 503 },
    );
  }
}
export const GET = handler;
export const POST = handler;
