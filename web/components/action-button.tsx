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
  const inFlight = useRef(false);
  const keyAwaitingAnswer = useRef<string | null>(null);

  function handleClick() {
    // `disabled` only applies after a re-render, and a fast second click can land before that.
    if (inFlight.current) return;
    inFlight.current = true;

    keyAwaitingAnswer.current ??= crypto.randomUUID();
    const key = keyAwaitingAnswer.current;

    startTransition(async () => {
      try {
        const res = await action(key);
        keyAwaitingAnswer.current = null;
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
