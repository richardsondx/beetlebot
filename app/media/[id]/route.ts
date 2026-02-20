import { readCachedMedia } from "@/lib/media/cache";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const media = await readCachedMedia(id);
  if (!media) {
    return new Response("Not found", { status: 404 });
  }

  const body = new Uint8Array(media.bytes);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": media.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

