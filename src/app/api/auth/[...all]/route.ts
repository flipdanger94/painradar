import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
async function handler(req: Request) {
  try {
    if (
      !process.env.DATABASE_URL ||
      !process.env.BETTER_AUTH_SECRET ||
      !process.env.BETTER_AUTH_URL
    )
      return Response.json(
        {
          code: "AUTH_UNAVAILABLE",
          message: "Sign-in is not configured yet. Contact the administrator.",
        },
        { status: 503 },
      );
    const emailRoutes = [
      "/sign-up/email",
      "/request-password-reset",
      "/send-verification-email",
    ];
    if (
      req.method === "POST" &&
      emailRoutes.some((path) => new URL(req.url).pathname.endsWith(path)) &&
      (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    )
      return Response.json(
        {
          code: "EMAIL_UNAVAILABLE",
          message:
            "Email delivery is not configured yet. Registration and password recovery are temporarily unavailable.",
        },
        { status: 503 },
      );
    return await toNextJsHandler(auth())[req.method === "GET" ? "GET" : "POST"](
      req,
    );
  } catch (e) {
    console.error("auth", e instanceof Error ? e.message : "error");
    return Response.json(
      {
        code: "AUTH_UNAVAILABLE",
        message:
          "Authentication is unavailable. Please try again or contact the administrator.",
      },
      { status: 503 },
    );
  }
}
export const GET = handler;
export const POST = handler;
