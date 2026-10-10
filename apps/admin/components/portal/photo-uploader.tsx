'use client';

import { useId, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, ImagePlus, RotateCcw, Trash2, UploadCloud } from 'lucide-react';
import { usePhotoUploads } from '@/hooks/use-photo-uploads';
import type { UploadItem } from '@/lib/evidence';
import { cn } from '@/lib/cn';
import { Button } from '../ui';

const STATUS_TEXT: Record<UploadItem['status'], string> = {
  preparing: 'Checking photo…',
  uploading: 'Uploading',
  finalizing: 'Verifying…',
  done: 'Uploaded',
  error: 'Failed',
};

function PhotoRow({
  item,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const pct = Math.round(item.progress * 100);
  const failed = item.status === 'error';
  return (
    <li className="flex items-center gap-3 rounded-md border border-line bg-surface p-2">
      {/* local preview of the file the user just picked */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.previewUrl}
        alt={`Preview of ${item.name}`}
        className="h-14 w-14 shrink-0 rounded-sm border border-line bg-surface-muted object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p
          className={cn(
            'flex items-center gap-1 text-xs',
            failed ? 'text-danger' : item.status === 'done' ? 'text-success' : 'text-muted',
          )}
        >
          {item.status === 'done' && <CheckCircle2 aria-hidden size={14} strokeWidth={1.75} />}
          {failed && <AlertCircle aria-hidden size={14} strokeWidth={1.75} />}
          {STATUS_TEXT[item.status]}
          {item.status === 'uploading' && <span className="tabular"> {pct}%</span>}
        </p>
        {failed && item.error && <p className="text-xs text-danger">{item.error}</p>}
        {item.status === 'uploading' && (
          <div
            role="progressbar"
            aria-label={`Uploading ${item.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted"
          >
            <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      {failed && (
        <div className="flex shrink-0 gap-1">
          {item.prepared && (
            <Button size="md" onClick={onRetry} icon={<RotateCcw aria-hidden size={16} strokeWidth={1.75} />}>
              Retry
            </Button>
          )}
          <Button variant="ghost" aria-label={`Remove ${item.name}`} onClick={onRemove} className="!px-2">
            <Trash2 aria-hidden size={16} strokeWidth={1.75} />
          </Button>
        </div>
      )}
    </li>
  );
}

/** Pick or capture photos, drop files onto the zone, watch each upload, retry failures. */
export function PhotoUploader({
  requestId,
  disabled,
  onUploaded,
}: {
  requestId: string;
  disabled?: boolean;
  onUploaded: () => void;
}) {
  const uploads = usePhotoUploads(requestId, onUploaded);
  const [over, setOver] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const hintId = useId();

  const take = (list: FileList | null) => {
    if (list && list.length > 0) uploads.add(Array.from(list));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) take(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors duration-150',
          over ? 'border-primary bg-primary-soft' : 'border-line-strong bg-surface-muted',
          disabled && 'opacity-60',
        )}
      >
        <UploadCloud aria-hidden size={28} strokeWidth={1.5} className="text-subtle" />
        <p className="text-sm font-medium">Drop photos here, or add them below</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="primary"
            size="lg"
            disabled={disabled}
            onClick={() => camera.current?.click()}
            icon={<Camera aria-hidden size={18} strokeWidth={1.75} />}
          >
            Take a photo
          </Button>
          <Button
            size="lg"
            disabled={disabled}
            onClick={() => gallery.current?.click()}
            icon={<ImagePlus aria-hidden size={18} strokeWidth={1.75} />}
          >
            Choose photos
          </Button>
        </div>
        <p id={hintId} className="text-xs text-muted">
          JPEG or PNG, up to 5 MB each.
        </p>
        <input
          ref={camera}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          hidden
          aria-label="Take a photo"
          aria-describedby={hintId}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = ''; // allow picking the same file again after a failure
          }}
        />
        <input
          ref={gallery}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          aria-label="Choose photos"
          aria-describedby={hintId}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {uploads.items.length > 0 && (
        <ul aria-label="Photos in this upload" className="space-y-2">
          {uploads.items.map((i) => (
            <PhotoRow
              key={i.id}
              item={i}
              onRetry={() => uploads.retry(i.id)}
              onRemove={() => uploads.remove(i.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
