import type { APIRoute } from "astro";
import { apiRequest, readServerEnv } from "../../server/api";

export const GET: APIRoute = async ({ request }) => {
  const env = readServerEnv();
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const path = params.size
    ? `/api/admin/contacts/export.csv?${params}`
    : "/api/admin/contacts/export.csv";
  const response = await apiRequest(env, path);
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "content-disposition":
        response.headers.get("content-disposition") ?? 'attachment; filename="contacts.csv"',
    },
  });
};
