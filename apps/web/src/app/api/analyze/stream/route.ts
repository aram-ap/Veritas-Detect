import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface AnalyzeRequest {
  text: string;
  title?: string;
  url?: string;
  forceRefresh?: boolean;
}

interface SSEEvent {
  type: 'status' | 'partial' | 'snippet' | 'complete' | 'error';
  [key: string]: any;
}

export async function POST(req: Request) {
  // Verify user is authenticated BEFORE streaming starts
  const session = await auth0.getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: AnalyzeRequest = await req.json();

    if (!body.text || body.text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Text content is too short to analyze' },
        { status: 400 }
      );
    }

    // Get or create user profile
    let userProfile = await prisma.userProfile.findUnique({
      where: { auth0Id: session.user.sub }
    });

    if (!userProfile) {
      userProfile = await prisma.userProfile.create({
        data: {
          auth0Id: session.user.sub,
          email: session.user.email,
          name: session.user.name,
        }
      });
    }

    // Check if we need to reset daily counter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastReset = new Date(userProfile.lastResetDate);
    lastReset.setHours(0, 0, 0, 0);

    if (lastReset < today) {
      // Reset daily counter
      userProfile = await prisma.userProfile.update({
        where: { id: userProfile.id },
        data: {
          todayAnalysisCount: 0,
          lastResetDate: new Date(),
        }
      });
    }

    // Special handling for unlimited user
    const isUnlimitedUser = session.user.email?.toLowerCase() === 'yoitsaram' ||
                            session.user.name?.toLowerCase() === 'yoitsaram' ||
                            userProfile.email?.toLowerCase() === 'yoitsaram' ||
                            userProfile.name?.toLowerCase() === 'yoitsaram';

    // Check rate limits BEFORE streaming (unless unlimited user)
    if (!isUnlimitedUser) {
      // Check if beta subscription has expired
      if (userProfile.subscriptionTier === 'beta' && userProfile.subscriptionEndsAt) {
        if (new Date() > new Date(userProfile.subscriptionEndsAt)) {
          // Beta expired, revert to free tier
          userProfile = await prisma.userProfile.update({
            where: { id: userProfile.id },
            data: {
              subscriptionTier: 'free',
              dailyAnalysisLimit: 5,
            }
          });
        }
      }

      if (userProfile.todayAnalysisCount >= userProfile.dailyAnalysisLimit) {
        return NextResponse.json(
          {
            error: 'Daily limit reached',
            limit: userProfile.dailyAnalysisLimit,
            used: userProfile.todayAnalysisCount,
            tier: userProfile.subscriptionTier,
            message: `You've reached your daily limit of ${userProfile.dailyAnalysisLimit} analyses. Upgrade to Pro for more!`
          },
          { status: 429 }
        );
      }
    }

    const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

    console.log(`[Next.js] Starting streaming analysis to ${backendUrl}/predict/stream`);

    // Create AbortController for timeout and cancellation
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 120000); // 2 minute timeout

    // Handle client disconnect
    req.signal.addEventListener('abort', () => {
      console.log('[Stream] Client disconnected, aborting backend request');
      abortController.abort();
    });

    try {
      // Call Python backend streaming endpoint
      const backendResponse = await fetch(`${backendUrl}/predict/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: body.text,
          title: body.title || '',
          url: body.url || '',
          force_refresh: body.forceRefresh || false
        }),
        signal: abortController.signal,
      });

      if (!backendResponse.ok) {
        clearTimeout(timeoutId);
        console.error('ML Backend streaming error:', backendResponse.status);
        return NextResponse.json(
          { error: 'Analysis service unavailable' },
          { status: 502 }
        );
      }

      // Variables to track completion state
      let completeData: any = null;
      let wasCompleted = false;

      // Create streaming response
      const stream = new ReadableStream({
        async start(controller) {
          const reader = backendResponse.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            controller.close();
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const eventData = JSON.parse(line.slice(6));

                    // Track completion event for post-processing
                    if (eventData.type === 'complete') {
                      completeData = eventData;
                      wasCompleted = true;
                    }

                    // Forward the event to client
                    controller.enqueue(new TextEncoder().encode(line + '\n\n'));
                  } catch (e) {
                    console.error('[Stream] Failed to parse SSE event:', e);
                  }
                }
              }
            }
          } catch (error: any) {
            if (error.name === 'AbortError') {
              console.log('[Stream] Request aborted');
            } else {
              console.error('[Stream] Error reading from backend:', error);
              // Send error event to client
              const errorEvent = `data: ${JSON.stringify({
                type: 'error',
                message: 'Stream error occurred'
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(errorEvent));
            }
          } finally {
            clearTimeout(timeoutId);
            reader.releaseLock();
            controller.close();

            // Post-stream processing: increment usage and save to DB
            if (wasCompleted && completeData) {
              await handleCompletion(
                userProfile.id,
                isUnlimitedUser,
                completeData,
                body.url,
                body.title
              );
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });

    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError' || req.signal.aborted) {
        console.log('[Stream] Analysis cancelled by client or timeout');
        return new NextResponse(null, { status: 499 });
      }

      throw error;
    }

  } catch (error: any) {
    console.error('Streaming analyze error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Handle post-completion tasks: increment usage counter and save to database
 */
async function handleCompletion(
  userProfileId: string,
  isUnlimitedUser: boolean,
  completeData: any,
  url?: string,
  title?: string
) {
  try {
    // Increment usage counter if not unlimited user
    if (!isUnlimitedUser) {
      await prisma.userProfile.update({
        where: { id: userProfileId },
        data: {
          todayAnalysisCount: { increment: 1 },
        }
      });
      console.log('[Stream] Usage count incremented');
    }

    // Extract analysis results from complete event
    const result = completeData.result || {};
    const score = result.score ?? result.trust_score ?? 50;
    const flaggedSnippets = result.flagged_snippets || [];
    const hasMisinformation = score < 70 || flaggedSnippets.length > 0;
    const bias = result.bias || 'unknown';

    // Extract all types from flagged snippets (each snippet has a 'type' field)
    // Store all types, not just unique ones, to count every instance of flagged content
    const tags: string[] = [];
    flaggedSnippets.forEach((snippet: any) => {
      if (snippet.type) {
        tags.push(snippet.type);
      }
    });

    // Save to database
    if (url) {
      // If URL is provided, update existing record or create new one
      const existingRecord = await prisma.analysisRecord.findFirst({
        where: {
          userId: userProfileId,
          url: url
        }
      });

      if (existingRecord) {
        await prisma.analysisRecord.update({
          where: { id: existingRecord.id },
          data: {
            title: title || existingRecord.title,
            trustScore: score,
            hasMisinformation,
            flaggedTags: JSON.stringify(tags),
            bias: bias,
            analyzedAt: new Date(),
          }
        });
      } else {
        await prisma.analysisRecord.create({
          data: {
            userId: userProfileId,
            url: url,
            title: title || null,
            trustScore: score,
            hasMisinformation,
            flaggedTags: JSON.stringify(tags),
            bias: bias,
          }
        });
      }
    } else {
      // No URL, always create new record
      await prisma.analysisRecord.create({
        data: {
          userId: userProfileId,
          url: null,
          title: title || null,
          trustScore: score,
          hasMisinformation,
          flaggedTags: JSON.stringify(tags),
          bias: bias,
        }
      });
    }

    console.log('[Stream] Analysis saved to database');
  } catch (error) {
    console.error('[Stream] Error in post-completion handling:', error);
    // Don't throw - we don't want to break the stream for the user
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
