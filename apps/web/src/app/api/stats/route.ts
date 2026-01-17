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
    // Get user profile
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
    console.error('Stats fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
