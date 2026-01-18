/**
 * SSE (Server-Sent Events) Parser Utility
 *
 * Parses SSE format streams from the backend streaming API.
 * SSE format: "data: {json}\n\n"
 */

export interface SSEEvent {
  type: 'status' | 'partial' | 'snippet' | 'complete' | 'error';
  [key: string]: any;
}

/**
 * Parse a chunk of SSE data and extract events
 * @param chunk Raw SSE data chunk (may contain multiple events)
 * @returns Array of parsed events
 */
export function parseSSE(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];

  // Split by double newline to separate events
  const lines = chunk.split('\n');

  for (const line of lines) {
    // SSE events start with "data: "
    if (line.startsWith('data: ')) {
      try {
        const jsonStr = line.slice(6); // Remove "data: " prefix
        const event = JSON.parse(jsonStr) as SSEEvent;
        events.push(event);
      } catch (error) {
        console.warn('[SSE Parser] Failed to parse event:', line, error);
        // Continue processing other events even if one fails
      }
    }
  }

  return events;
}

/**
 * Create a streaming reader that parses SSE events
 * @param reader ReadableStreamDefaultReader from fetch response
 * @param onEvent Callback for each parsed event
 * @param onComplete Callback when stream completes
 * @param onError Callback for errors
 */
export async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const events = parseSSE(buffer);
          events.forEach(onEvent);
        }
        onComplete?.();
        break;
      }

      // Decode chunk and add to buffer
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Process complete events (ending with \n\n)
      const parts = buffer.split('\n\n');

      // Last part might be incomplete, keep it in buffer
      buffer = parts.pop() || '';

      // Process complete parts
      for (const part of parts) {
        if (part.trim()) {
          const events = parseSSE(part);
          events.forEach(onEvent);
        }
      }
    }
  } catch (error) {
    console.error('[SSE Stream] Error:', error);
    onError?.(error as Error);
  }
}

/**
 * Helper to determine if an event is a specific type
 */
export function isEventType<T extends SSEEvent['type']>(
  event: SSEEvent,
  type: T
): boolean {
  return event.type === type;
}
