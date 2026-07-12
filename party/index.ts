import type * as Party from 'partykit/server';

import type { MigrationJob, VideoWithMigrationStatus } from '@/utils/store';

type JobEvent = { id: string; type: string; data: any };

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}

  job: MigrationJob | undefined;

  // clients may connect after events have already been broadcast, so send them the accumulated state
  onConnect(conn: Party.Connection) {
    if (this.job) {
      conn.send(JSON.stringify({ id: this.job.id, type: 'job.state', data: this.job }));
    }
  }

  async onRequest(req: Party.Request) {
    if (req.method === 'POST') {
      // the initial POST from createJob only carries the id
      const job = (await req.json()) as Partial<MigrationJob> & { id: string };
      this.job = { id: job.id, status: 'pending', progress: job.progress ?? 0, videos: job.videos ?? {} };
    }

    if (req.method === 'PUT') {
      const payload = await req.json<JobEvent>();
      this.applyEvent(payload);
      this.room.broadcast(JSON.stringify(payload));
      return new Response('OK');
    }

    if (this.job) {
      return new Response(JSON.stringify(this.job), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  applyEvent(payload: JobEvent) {
    if (!this.job) {
      this.job = { id: payload.id, status: 'in-progress', progress: 0, videos: {} };
    }

    switch (payload.type) {
      case 'migration.videos.fetched':
        this.job.videos = { ...this.job.videos, ...payload.data.videos };
        break;
      case 'migration.video.progress': {
        const video = payload.data.video as VideoWithMigrationStatus;
        this.job.videos[video.id] = { ...this.job.videos[video.id], ...video };
        break;
      }
      default:
        break;
    }
  }
}

Server satisfies Party.Worker;
