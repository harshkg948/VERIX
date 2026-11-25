import { GmailMessagePreview, TrackedApplication } from '../types';
import { FIREBASE_PROJECT_ID } from './workspaceAuth';

export class WorkspaceApiError extends Error {
  status: number;
  isChatConfigMissing?: boolean;
  consoleUrl?: string;

  constructor(message: string, status: number, extra?: { isChatConfigMissing?: boolean; consoleUrl?: string }) {
    super(message);
    this.status = status;
    this.isChatConfigMissing = extra?.isChatConfigMissing;
    this.consoleUrl = extra?.consoleUrl;
  }
}

function decodeBase64Url(input: string): string {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function extractPlainTextFromPayload(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const nested = extractPlainTextFromPayload(part);
      if (nested) return nested;
    }
  }
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

export async function fetchJobEmails(accessToken: string): Promise<GmailMessagePreview[]> {
  const query = encodeURIComponent('offer OR internship OR interview OR recruiter OR hiring');
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=8`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listRes.ok) {
    const errBody = await listRes.json().catch(() => ({}));
    throw new WorkspaceApiError(errBody?.error?.message || 'Failed to read Gmail messages.', listRes.status);
  }

  const listData = await listRes.json();
  const messageRefs: { id: string; threadId: string }[] = listData.messages || [];
  if (messageRefs.length === 0) return [];

  const details = await Promise.all(
    messageRefs.slice(0, 6).map(async (ref) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!msgRes.ok) return null;
      const msg = await msgRes.json();
      const headers: { name: string; value: string }[] = msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject') || '(No Subject)';
      const from = getHeader('From') || 'Unknown Sender';
      const date = getHeader('Date') || '';
      const plainBody = extractPlainTextFromPayload(msg.payload);

      return {
        id: msg.id,
        threadId: msg.threadId,
        subject,
        from,
        date,
        snippet: msg.snippet || '',
        bodyText: `From: ${from}\nSubject: ${subject}\nDate: ${date}\n\n${plainBody || msg.snippet || ''}`,
      } satisfies GmailMessagePreview;
    })
  );

  return details.filter(Boolean) as GmailMessagePreview[];
}

export async function exportTrackerToSheet(
  accessToken: string,
  applications: TrackedApplication[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: `VERIX Application Tracker (${today})` },
      sheets: [{ properties: { title: 'Applications' } }],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new WorkspaceApiError(err?.error?.message || 'Failed to create Google Sheet.', createRes.status);
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const spreadsheetUrl: string = created.spreadsheetUrl;
  const actualSheetTitle: string = created.sheets?.[0]?.properties?.title || 'Applications';

  const rows = [
    ['Company', 'Role', 'Platform Used', 'Applied Date', 'Safety Status', 'Stage', 'Notes'],
    ...applications.map((item) => [
      item.company,
      item.role,
      item.platform,
      item.appliedDate,
      item.safetyStatus,
      item.status,
      item.notes || '',
    ]),
  ];

  const range = encodeURIComponent(`${actualSheetTitle}!A1`);
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new WorkspaceApiError(err?.error?.message || 'Sheet created, but writing rows failed.', updateRes.status);
  }

  return { spreadsheetId, spreadsheetUrl };
}

export async function scheduleInterviewEvent(
  accessToken: string,
  payload: {
    company: string;
    role: string;
    date: string;
    time: string;
    durationMinutes: number;
    notes?: string;
  }
): Promise<{ htmlLink: string }> {
  const startLocal = new Date(`${payload.date}T${payload.time}:00`);
  const endLocal = new Date(startLocal.getTime() + payload.durationMinutes * 60000);

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: `Interview: ${payload.role} at ${payload.company}`,
      description: `Tracked via VERIX Safe Career Ecosystem.\n${payload.notes ? `Notes: ${payload.notes}` : ''}`,
      start: { dateTime: startLocal.toISOString() },
      end: { dateTime: endLocal.toISOString() },
      reminders: { useDefault: true },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new WorkspaceApiError(err?.error?.message || 'Failed to schedule Google Calendar event.', res.status);
  }

  const data = await res.json();
  return { htmlLink: data.htmlLink };
}

export async function exportToGoogleDoc(
  accessToken: string,
  title: string,
  bodyContent: string
): Promise<{ documentId: string; docUrl: string }> {
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new WorkspaceApiError(err?.error?.message || 'Failed to create Google Doc.', createRes.status);
  }

  const created = await createRes.json();
  const documentId: string = created.documentId;

  const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: bodyContent,
          },
        },
      ],
    }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new WorkspaceApiError(err?.error?.message || 'Created Google Doc, but failed to write content.', updateRes.status);
  }

  return {
    documentId,
    docUrl: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

export async function syncTasksToGoogleTasks(
  accessToken: string,
  listTitle: string,
  items: { title: string; notes?: string }[]
): Promise<{ createdCount: number; listTitle: string }> {
  let listId = '@default';
  const createListRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: listTitle }),
  });

  if (createListRes.ok) {
    const listData = await createListRes.json();
    listId = listData.id;
  }

  let createdCount = 0;
  for (const item of items) {
    const taskRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: item.title,
        notes: item.notes || '',
      }),
    });
    if (taskRes.ok) {
      createdCount += 1;
    }
  }

  if (createdCount === 0) {
    throw new WorkspaceApiError('Failed to create tasks in Google Tasks.', 500);
  }

  return { createdCount, listTitle };
}

export async function listChatSpaces(
  accessToken: string
): Promise<{ name: string; displayName: string; spaceType: string }[]> {
  const res = await fetch('https://chat.googleapis.com/v1/spaces', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || 'Failed to load Google Chat spaces.';
    const consoleUrl = `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${FIREBASE_PROJECT_ID}`;
    if (res.status === 404 || msg.toLowerCase().includes('chat app not found')) {
      throw new WorkspaceApiError(
        'Google Chat app not found. Configure the Chat app in Google Cloud Console and sign in with a Google Workspace Business/Enterprise account.',
        404,
        { isChatConfigMissing: true, consoleUrl }
      );
    }
    throw new WorkspaceApiError(msg, res.status, { consoleUrl });
  }

  const data = await res.json();
  return (data.spaces || []).map((s: any) => ({
    name: s.name,
    displayName: s.displayName || s.name,
    spaceType: s.spaceType || 'SPACE',
  }));
}

export async function postToChatSpace(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<void> {
  const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const consoleUrl = `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${FIREBASE_PROJECT_ID}`;
    throw new WorkspaceApiError(err?.error?.message || 'Failed to post message to Google Chat.', res.status, {
      consoleUrl,
    });
  }
}
