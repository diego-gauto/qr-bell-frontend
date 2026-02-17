import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  // Vercel sets these env vars automatically; they change on each deployment.
  const version =
    process.env['VERCEL_DEPLOYMENT_ID'] ??
    process.env['VERCEL_GIT_COMMIT_SHA'] ??
    process.env['VERCEL_GIT_COMMIT_MESSAGE'] ??
    'local';

  return NextResponse.json(
    { version },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
}

