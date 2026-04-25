// netlify/functions/requests.ts

import type { Handler, HandlerEvent } from '@netlify/functions'

interface Request {
  songId: string
  opNumber: string
  screenshot?: string
  name?: string
  timestamp: string
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const date = event.queryStringParameters?.date
  if (!date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'date parameter required' }),
    }
  }

  const githubToken = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO || 'yourusername/retrogroove-site'

  if (!githubToken) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    }
  }

  try {
    // List files in content/requests/
    const listRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/content/requests`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!listRes.ok) {
      if (listRes.status === 404) {
        return {
          statusCode: 200,
          body: JSON.stringify([]),
        }
      }
      throw new Error('Failed to list requests')
    }

    const files = await listRes.json()

    // Filter files by date prefix
    const dateFiles = files.filter((f: { name: string }) =>
      f.name.startsWith(date) && f.name.endsWith('.json')
    )

    // Fetch each file's content
    const requests: Request[] = []
    for (const file of dateFiles) {
      const contentRes = await fetch(file.download_url)
      if (contentRes.ok) {
        const content = await contentRes.json()
        requests.push(content)
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(requests),
    }
  } catch (error) {
    console.error('Error fetching requests:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch requests' }),
    }
  }
}

export { handler }
