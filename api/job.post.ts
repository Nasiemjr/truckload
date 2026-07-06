import { defineEventHandler } from 'nitro/h3';
import { start } from 'workflow/api';

import { createJob } from '@/utils/job';
import { initiateMigration } from '@/workflows/migration';

export default defineEventHandler(async ({ req }) => {
  const body = await req.json();

  const run = await start(initiateMigration, [body]);
  const jobId = run.runId;

  await createJob(jobId);

  return new Response(JSON.stringify({ id: jobId }), { status: 201 });
});
