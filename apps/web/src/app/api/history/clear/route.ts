import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function DELETE(req: Request) {
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

    // Check if a specific URL is provided
    let url: string | null = null;
    try {
      const body = await req.json();
      url = body.url || null;
    } catch {
      // No body or invalid JSON, clear all records
    }

    // Delete analysis records for this user
    const result = await prisma.analysisRecord.deleteMany({
      where: {
        userId: userProfile.id,
        ...(url ? { url } : {}) // Only filter by URL if provided
      }
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: url 
        ? `Cleared ${result.count} analysis record(s) for ${url}`
        : `Cleared ${result.count} analysis records`
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
