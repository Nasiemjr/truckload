import { defineEventHandler } from 'nitro/h3';

export default defineEventHandler(() => {
  return new Response('Hello, World!', { status: 200 });
});
