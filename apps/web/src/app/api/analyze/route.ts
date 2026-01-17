import { auth0 } from '@/lib/auth0';
import { NextResponse } from 'next/server';

interface AnalyzeRequest {
  text: string;
  title?: string;
  url?: string;
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

    const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

    const response = await fetch(`${backendUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: body.text,
        title: body.title || '',
        url: body.url || ''
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

    // Return the analysis results
    return NextResponse.json({
      score: data.score ?? data.trust_score ?? 50,
      bias: data.bias || 'unknown',
      flagged_indices: data.flagged_indices || data.flagged_snippets || []
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
