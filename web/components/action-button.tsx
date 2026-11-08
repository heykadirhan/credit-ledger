'use client';

import { useRef, useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/types';

interface Props {
  label: string;
  action: (idempotencyKey: string) => Promise<ActionResult>;
}

export function ActionButton({ label, action }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  // Refs: read synchronously in the handler, and no re-render on change.
  const inFlight = useRef(false);
  const pendingKey = useRef<string | null>(null);

  function handleClick() {
    // A second click can land before React re-renders the button as disabled.
    if (inFlight.current) return;
    inFlight.current = true;

    // Keep the key until the server answers, so a retry can't run twice.
    pendingKey.current ??= crypto.randomUUID();
    const key = pendingKey.current;

    startTransition(async () => {
      try {
        const res = await action(key);
        pendingKey.current = null;
        setResult(res);
      } catch {
        setResult({ ok: false, message: 'Request failed. Click again to retry safely.' });
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <div className="action">
      <button type="button" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Working…' : label}
      </button>
      {result && (
        <p role="status" className={result.ok ? 'result ok' : 'result error'}>
          {result.message}
        </p>
      )}
    </div>
  );
}
