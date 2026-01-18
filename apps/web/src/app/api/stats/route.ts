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
    
    // Get user profile (without analyses initially)
    const userProfile = await prisma.userProfile.findUnique({
      where: { auth0Id: session.user.sub }
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

    // Fetch analyses separately with limit - more efficient for large datasets
    const [allAnalyses, recentAnalysesData] = await Promise.all([
      // Get all analyses for stats (only needed fields)
      prisma.analysisRecord.findMany({
        where: { userId: userProfile.id },
        select: {
          hasMisinformation: true,
          flaggedTags: true,
        }
      }),
      // Get recent 10 for display
      prisma.analysisRecord.findMany({
        where: { userId: userProfile.id },
        orderBy: { analyzedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          url: true,
          trustScore: true,
          hasMisinformation: true,
          bias: true,
          analyzedAt: true,
        }
      })
    ]);

    // Calculate statistics
    const totalAnalyses = allAnalyses.length;
    
    // Count total flagged tags across all analyses
    let totalMisinformationCount = 0;
    const tagFrequencies: Record<string, number> = {};
    
    allAnalyses.forEach(analysis => {
      try {
        const tags = JSON.parse(analysis.flaggedTags) as string[];
        totalMisinformationCount += tags.length; // Count each flagged tag
        tags.forEach(tag => {
          tagFrequencies[tag] = (tagFrequencies[tag] || 0) + 1;
        });
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Format recent analyses
    const recentAnalyses = recentAnalysesData.map(a => ({
      id: a.id,
      title: a.title,
      url: a.url,
      trustScore: a.trustScore,
      hasMisinformation: a.hasMisinformation,
      bias: a.bias || 'unknown',
      analyzedAt: a.analyzedAt.toISOString(),
    }));

    return NextResponse.json({
      joinedAt: userProfile.joinedAt.toISOString(),
      totalAnalyses,
      misinformationDetected: totalMisinformationCount,
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
