import { auth0 } from '@/lib/auth0';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { text } = await req.json();
    
    // Mock Gemini implementation
    // In production, use Google Generative AI SDK here
    
    const mockAnalysis = {
      analysis: "This text contains potential bias in paragraph 2...",
      corrections: [
        { original: "Earth is flat", correction: "Earth is an oblate spheroid" }
      ],
      searchQueries: ["Earth shape scientific consensus", "Geodesy basics"]
    };

    return NextResponse.json(mockAnalysis);
  } catch (error) {
    console.error('Deep dive error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
