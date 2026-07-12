import { defineEventHandler } from 'nitro/h3';

import type { PlatformCredentials, SourcePlatform } from '@/utils/store';
import { fetchPageFns } from '@/workflows/steps';

export default defineEventHandler(async ({ req }) => {
  const data = (await req.json()) as {
    platformId: SourcePlatform['id'];
    credentials: PlatformCredentials;
    page?: number;
    cursor?: string;
  };

  const fetchPage = fetchPageFns[data.platformId];
  if (!fetchPage || !data.credentials) {
    return Response.json({ error: 'Invalid platform provided' }, { status: 400 });
  }

  try {
    const result = await fetchPage(data.credentials, data.page ?? 1, data.cursor);
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return Response.json({ error: 'Error fetching videos from source platform' }, { status: 500 });
  }
});
