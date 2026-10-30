'use client';
import { useEffect, useRef, useState } from 'react';
import { call } from '@/shared/client';
import type { Action, ActionInput, ActionOutput } from '@/shared/contracts';

export function friendlyError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'SIGN_IN_REQUIRED') return 'Your session has expired. Sign in again to continue.';
  if (code === 'ACCESS_DENIED')
    return 'This action is not available with your current workspace permissions or entitlements.';
  if (code === 'REVISION_CONFLICT')
    return 'This record changed. Refresh the view before trying again.';
  if (code === 'INVALID_OPERATION')
    return 'This action could not be completed. Check the record’s current status and your permissions.';
  return 'We couldn’t complete the request. Check your connection and try again.';
}

export function usePortalQuery<A extends Action>(
  action: A,
  workspaceId: string,
  payload: ActionInput<A>,
) {
  const serialized = JSON.stringify(payload),
    key = `${workspaceId}/${action}/${serialized}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    data?: ActionOutput[A];
    error?: string;
  } | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true,
      sequence = 0;
    async function load() {
      const request = ++sequence;
      // Keep unchanged records mounted during visible refreshes so partially
      // completed reports and evidence selections survive. Changed query keys
      // are already hidden by the return guard; hidden tabs clear immediately.
      if (document.visibilityState === 'hidden') {
        setSnapshot(null);
        return;
      }
      try {
        const data = await call(action, workspaceId, JSON.parse(serialized));
        if (active && sequence === request) setSnapshot({ key, data });
      } catch (error) {
        if (active && sequence === request) setSnapshot({ key, error: friendlyError(error) });
      }
    }
    void load();
    const timer = setInterval(() => void load(), 30000);
    const visibility = () => void load();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false;
      sequence++;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [action, workspaceId, serialized, key, version]);
  return {
    data: snapshot?.key === key ? snapshot.data : undefined,
    error: snapshot?.key === key ? snapshot.error : undefined,
    refresh: () => setVersion((v) => v + 1),
  };
}

// Preserve a mutation key when the same operation is retried after an uncertain network response.
export function usePortalMutation(workspaceId: string) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [failed, setFailed] = useState(false);
  const keys = useRef(new Map<string, string>()),
    lock = useRef(false);
  async function mutate<A extends Action>(
    action: A,
    payload: Omit<ActionInput<A>, 'requestId'>,
    success: string,
    after?: () => void,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    setFailed(false);
    const signature = JSON.stringify({ action, payload });
    const requestId = keys.current.get(signature) || crypto.randomUUID();
    keys.current.set(signature, requestId);
    try {
      await call(action, workspaceId, { ...payload, requestId } as ActionInput<A>);
      keys.current.delete(signature);
      setMessage(success);
      after?.();
    } catch (error) {
      setFailed(true);
      setMessage(friendlyError(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, message, failed, mutate };
}
