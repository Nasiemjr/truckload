import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import useMigrationStore, { type Video } from '@/utils/store';

import Heading from '../heading';

type PageResult = {
  isTruncated: boolean | undefined;
  videos: Video[];
  cursor: string | null | undefined;
};

export default function VideoSelection() {
  const sourcePlatform = useMigrationStore((state) => state.sourcePlatform);
  const setAssetFilter = useMigrationStore((state) => state.setAssetFilter);
  const setCurrentStep = useMigrationStore((state) => state.setCurrentStep);

  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef({ page: 1, cursor: undefined as string | undefined });
  const [hasMorePages, setHasMorePages] = useState(false);
  const didInitialFetch = useRef(false);

  const loadPage = useCallback(async () => {
    if (!sourcePlatform?.credentials) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/videos', {
        method: 'POST',
        body: JSON.stringify({
          platformId: sourcePlatform.id,
          credentials: sourcePlatform.credentials,
          page: pageRef.current.page,
          cursor: pageRef.current.cursor,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const result: PageResult = await response.json();
      setVideos((existing) => {
        const known = new Set(existing.map((video) => video.id));
        return existing.concat(result.videos.filter((video) => !known.has(video.id)));
      });
      setHasMorePages(!!result.isTruncated);
      pageRef.current = { page: pageRef.current.page + 1, cursor: result.cursor ?? undefined };
    } catch {
      setError('Unable to fetch videos from your source platform. Check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [sourcePlatform]);

  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    loadPage();
  }, [loadPage]);

  const toggleVideo = (id: string) => {
    setSelectedIds((existing) => {
      const next = new Set(existing);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected = videos.length > 0 && selectedIds.size === videos.length;

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(videos.map((video) => video.id)));
  };

  const onContinue = () => {
    const selection = videos.filter((video) => selectedIds.has(video.id)).map(({ id, title }) => ({ id, title }));

    if (selection.length === 0) {
      toast.error('Select at least one video to continue');
      return;
    }

    setAssetFilter(selection);
    setCurrentStep('select-destination');
  };

  return (
    <div>
      <div className="mb-4">
        <Heading>Select your videos</Heading>
        <p className="text-xs">
          Pick the videos you want to transfer from {sourcePlatform?.name}. {selectedIds.size} of {videos.length}{' '}
          selected.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {videos.length > 0 && (
        <div className="mb-4">
          <button className="text-sm text-primary underline" onClick={toggleAll}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2 mb-6 max-w-xl">
        {videos.map((video) => (
          <li key={video.id}>
            <label className="flex items-center gap-3 p-3 border-2 rounded border-slate-200 hover:border-slate-300 cursor-pointer text-sm text-slate-600">
              <input
                type="checkbox"
                className="rounded text-primary focus:ring-primary"
                checked={selectedIds.has(video.id)}
                onChange={() => toggleVideo(video.id)}
              />
              {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="w-16 h-9 object-cover rounded" />}
              <span className="break-all">{video.title || video.id}</span>
            </label>
          </li>
        ))}
      </ul>

      {isLoading && <p className="text-sm text-slate-500 mb-4">Loading videos…</p>}

      {!isLoading && !error && videos.length === 0 && (
        <p className="text-sm text-slate-500 mb-4">No videos found on your source platform.</p>
      )}

      <div className="flex gap-4">
        {hasMorePages && (
          <button
            className="font-sans uppercase rounded text-base border-2 border-primary text-primary py-3 px-6 font-semibold disabled:opacity-50"
            disabled={isLoading}
            onClick={loadPage}
          >
            Load more
          </button>
        )}

        <button
          className="font-sans uppercase rounded text-base bg-primary hover:bg-primary-dark focus-visible:bg-primary-dark text-white py-3 px-6 font-semibold disabled:bg-gray-300"
          disabled={selectedIds.size === 0}
          onClick={onContinue}
        >
          Continue with {selectedIds.size} video{selectedIds.size === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}
