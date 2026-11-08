import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActionResult } from '@/lib/types';
import { ActionButton } from './action-button';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('ActionButton', () => {
  it('sends one request for a double click and stays disabled until it finishes', async () => {
    const request = deferred<ActionResult>();
    const action = vi.fn((_key: string) => request.promise);
    render(<ActionButton label="Render" action={action} />);
    const button = screen.getByRole('button', { name: 'Render' });

    await userEvent.dblClick(button);

    expect(action).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    request.resolve({ ok: true, message: 'Started' });

    expect(await screen.findByText('Started')).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('ignores a second click that lands before React re-renders the button', async () => {
    const request = deferred<ActionResult>();
    const action = vi.fn((_key: string) => request.promise);
    render(<ActionButton label="Render" action={action} />);
    const button = screen.getByRole('button', { name: 'Render' });

    act(() => {
      button.click();
      button.click();
    });

    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => request.resolve({ ok: true, message: 'Started' }));
  });

  it('retries with the same key when a request fails without an answer', async () => {
    const action = vi
      .fn<(key: string) => Promise<ActionResult>>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, message: 'Started' });
    render(<ActionButton label="Render" action={action} />);

    await userEvent.click(screen.getByRole('button', { name: 'Render' }));
    await screen.findByText(/Request failed/);
    await userEvent.click(screen.getByRole('button', { name: 'Render' }));
    await screen.findByText('Started');

    const [first, second] = action.mock.calls.map(([key]) => key);
    expect(second).toBe(first);
  });

  it('uses a new key once the server has answered', async () => {
    const action = vi.fn(async (_key: string): Promise<ActionResult> => ({ ok: true, message: 'Started' }));
    render(<ActionButton label="Render" action={action} />);
    const button = screen.getByRole('button', { name: 'Render' });

    await userEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));

    const [first, second] = action.mock.calls.map(([key]) => key);
    expect(second).not.toBe(first);
  });

  it('shows the server refusing the action', async () => {
    const action = vi.fn(async (): Promise<ActionResult> => ({ ok: false, message: 'Not enough credits' }));
    render(<ActionButton label="Render" action={action} />);

    await userEvent.click(screen.getByRole('button', { name: 'Render' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Not enough credits');
  });
});
