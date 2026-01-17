import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  // Verify user is authenticated
  const session = await auth0.getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Stats] Fetching user profile for:', session.user.sub);
    
    // Get user profile with timeout protection
    const userProfile = await prisma.userProfile.findUnique({
      where: { auth0Id: session.user.sub },
      include: {
        analyses: {
          orderBy: { analyzedAt: 'desc' }
        }
      }
    });

    if (!userProfile) {
      // Return empty stats if user hasn't analyzed anything yet
      return NextResponse.json({
        joinedAt: new Date().toISOString(),
        totalAnalyses: 0,
        misinformationDetected: 0,
        tagFrequencies: {},
        recentAnalyses: []
      });
    }

    // Calculate statistics
    const totalAnalyses = userProfile.analyses.length;
    const misinformationDetected = userProfile.analyses.filter(a => a.hasMisinformation).length;

    // Aggregate tag frequencies
    const tagFrequencies: Record<string, number> = {};
    userProfile.analyses.forEach(analysis => {
      try {
        const tags = JSON.parse(analysis.flaggedTags) as string[];
        tags.forEach(tag => {
          tagFrequencies[tag] = (tagFrequencies[tag] || 0) + 1;
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Get recent analyses (last 10)
    const recentAnalyses = userProfile.analyses.slice(0, 10).map(a => ({
      id: a.id,
      title: a.title,
      url: a.url,
      trustScore: a.trustScore,
      hasMisinformation: a.hasMisinformation,
      analyzedAt: a.analyzedAt.toISOString(),
    }));

    return NextResponse.json({
      joinedAt: userProfile.joinedAt.toISOString(),
      totalAnalyses,
      misinformationDetected,
      tagFrequencies,
      recentAnalyses
    });
  } catch (error) {
    console.error('[Stats] Error fetching statistics:', error);
    
    // Check for specific Prisma timeout error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P1008') {
      console.error('[Stats] Database connection timeout - check DATABASE_URL and connection pool settings');
      return NextResponse.json(
        { error: 'Database connection timeout. Please try again.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
