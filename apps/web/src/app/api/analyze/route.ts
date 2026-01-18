import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface AnalyzeRequest {
  text: string;
  title?: string;
  url?: string;
  forceRefresh?: boolean;
}

export async function POST(req: Request) {
  // Verify user is authenticated
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

    // Check rate limits (unless unlimited user)
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

      // Increment usage counter
      userProfile = await prisma.userProfile.update({
        where: { id: userProfile.id },
        data: {
          todayAnalysisCount: userProfile.todayAnalysisCount + 1,
        }
      });
    }

    const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

    console.log(`[Next.js] Calling Python backend at ${backendUrl}/predict`);
    
    const response = await fetch(`${backendUrl}/predict`, {
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
    });

    if (!response.ok) {
      console.error('ML Backend error:', response.status, await response.text());
      return NextResponse.json(
        { error: 'Analysis service unavailable' },
        { status: 502 }
      );
    }

    const data = await response.json();
    console.log('[Next.js] Python response data:', JSON.stringify(data).substring(0, 200) + '...');

    const score = data.score ?? data.trust_score ?? 50;
    const flaggedSnippets = data.flagged_snippets || [];
    const hasMisinformation = score < 70 || flaggedSnippets.length > 0;
    const bias = data.bias || 'unknown';
    
    // Extract unique tags from flagged snippets
    const tags = new Set<string>();
    flaggedSnippets.forEach((snippet: any) => {
      if (snippet.tags && Array.isArray(snippet.tags)) {
        snippet.tags.forEach((tag: string) => tags.add(tag));
      }
    });

    // Track the analysis in the database
    try {
      // Record the analysis (upsert if URL exists to avoid duplicates)
      if (body.url) {
        // If URL is provided, update existing record or create new one
        const existingRecord = await prisma.analysisRecord.findFirst({
          where: {
            userId: userProfile.id,
            url: body.url
          }
        });

        if (existingRecord) {
          // Update existing record
          await prisma.analysisRecord.update({
            where: { id: existingRecord.id },
            data: {
              title: body.title || existingRecord.title,
              trustScore: score,
              hasMisinformation,
              flaggedTags: JSON.stringify(Array.from(tags)),
              bias: bias,
              analyzedAt: new Date(), // Update timestamp
            }
          });
        } else {
          // Create new record
          await prisma.analysisRecord.create({
            data: {
              userId: userProfile.id,
              url: body.url,
              title: body.title || null,
              trustScore: score,
              hasMisinformation,
              flaggedTags: JSON.stringify(Array.from(tags)),
              bias: bias,
            }
          });
        }
      } else {
        // No URL, always create new record
        await prisma.analysisRecord.create({
          data: {
            userId: userProfile.id,
            url: null,
            title: body.title || null,
            trustScore: score,
            hasMisinformation,
            flaggedTags: JSON.stringify(Array.from(tags)),
            bias: bias,
          }
        });
      }
    } catch (dbError) {
      console.error('Failed to record analysis in database:', dbError);
      // Continue even if database tracking fails
    }

    // Return the analysis results
    return NextResponse.json({
      score,
      bias: data.bias || 'unknown',
      flagged_snippets: flaggedSnippets,
      summary: data.explanation?.summary || data.summary || undefined,
      metadata: data.metadata || undefined
    });
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
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
