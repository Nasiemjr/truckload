import { FatalError, getWorkflowMetadata, sleep } from 'workflow';

import type { AssetFilter, DestinationPlatform, SourcePlatform, Video, VideoWithMigrationStatus } from '@/utils/store';

import {
  checkCloudflareStatusStep,
  checkMuxAssetStatusStep,
  fetchPageStep,
  fetchVideoStep,
  startProcessVideoWorkflow,
  transferVideoStep,
  updateJobStatusStep,
} from './steps';

export async function processVideo(
  jobId: string,
  sourcePlatform: SourcePlatform,
  destinationPlatform: DestinationPlatform,
  videoData: Video
) {
  'use workflow';

  let video = await fetchVideoStep(sourcePlatform.id, sourcePlatform.credentials!, videoData);

  if (!video) {
    // report the failure so the status UI doesn't show this video as pending forever
    await updateJobStatusStep(jobId, 'migration.video.progress', {
      video: { id: videoData.id, status: 'failed', progress: 0 },
    });
    throw new FatalError(`Failed to fetch video with ID: ${videoData.id}`);
  }

  // Handle Cloudflare Stream polling case
  if (video.needsPolling) {
    let status = { ready: false, url: '' };
    while (!status.ready) {
      await sleep('5s');
      status = await checkCloudflareStatusStep(sourcePlatform.credentials!, videoData);
    }
    video = { id: videoData.id, url: status.url };
  }

  const transfer = await transferVideoStep(jobId, video, sourcePlatform, destinationPlatform);
  const assetId = transfer.result.id;

  // Poll Mux until asset is ready (replaces webhook/ngrok approach)
  let assetStatus = { ready: false, errored: false };
  while (!assetStatus.ready && !assetStatus.errored) {
    await sleep('5s');
    assetStatus = await checkMuxAssetStatusStep(destinationPlatform.credentials!, assetId);
  }

  await updateJobStatusStep(jobId, 'migration.video.progress', {
    video: {
      id: videoData.id,
      status: assetStatus.ready ? 'completed' : 'failed',
      progress: 100,
    },
  });

  return { status: assetStatus.ready ? 'success' : 'failed', transfer };
}

export async function initiateMigration(data: {
  sourcePlatform: SourcePlatform;
  destinationPlatform: DestinationPlatform;
  assetFilter: AssetFilter[] | null;
}) {
  'use workflow';

  const { workflowRunId: jobId } = getWorkflowMetadata();

  // an empty filter means "move everything"; a non-empty one limits the migration to those videos
  const selectedIds = data.assetFilter?.length ? new Set(data.assetFilter.map((filter) => filter.id)) : null;

  let hasMorePages = true;
  let page = 1;
  let cursor: string | undefined;
  let videoList: Video[] = [];

  while (hasMorePages && data.sourcePlatform.credentials) {
    const result = await fetchPageStep(data.sourcePlatform.id, data.sourcePlatform.credentials, page, cursor);
    const { isTruncated, videos } = result;
    cursor = result.cursor ?? undefined;

    videoList = videoList.concat(selectedIds ? videos.filter((video) => selectedIds.has(video.id)) : videos);

    await updateJobStatusStep(jobId, 'migration.videos.fetched', {
      pageNumber: page,
      videos: videoList.reduce<Record<string, VideoWithMigrationStatus>>((acc, video) => {
        acc[video.id] = { ...video, status: 'pending', progress: 0 };
        return acc;
      }, {}),
      hasMorePages: isTruncated,
    });

    if (!isTruncated || (selectedIds && videoList.length >= selectedIds.size)) {
      hasMorePages = false;
    } else {
      page++;
    }
  }

  // Start a processVideo workflow for each video
  for (const video of videoList) {
    await startProcessVideoWorkflow(jobId, data.sourcePlatform, data.destinationPlatform, video);
  }

  return { message: 'migration initiated', videosMigrated: videoList.length };
}
