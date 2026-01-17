import { auth0 } from '@/lib/auth0';
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

    // Return the analysis results
    return NextResponse.json({
      score: data.score ?? data.trust_score ?? 50,
      bias: data.bias || 'unknown',
      flagged_snippets: data.flagged_snippets || [],
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
