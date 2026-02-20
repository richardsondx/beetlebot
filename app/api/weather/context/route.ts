import { NextResponse } from "next/server";
import { getWeatherContext } from "@/lib/weather/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const location = url.searchParams.get("location") ?? undefined;
  const data = await getWeatherContext({ location });
  return NextResponse.json(data);
}

