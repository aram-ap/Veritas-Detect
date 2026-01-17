import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function DELETE() {
  // Verify user is authenticated
  const session = await auth0.getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { auth0Id: session.user.sub }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Delete all analysis records for this user
    const result = await prisma.analysisRecord.deleteMany({
      where: {
        userId: userProfile.id
      }
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Cleared ${result.count} analysis records`
    });
  } catch (error) {
    console.error('Clear history error:', error);
    return NextResponse.json(
      { error: 'Failed to clear history' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
