// netlify/functions/submit-request.ts

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { nanoid } from 'nanoid'

interface RequestBody {
  songId: string
  opNumber: string
  screenshot?: string
  name?: string
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  // Parse body
  let body: RequestBody
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON' }),
    }
  }

  // Validate required fields
  if (!body.songId || !body.opNumber) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'songId and opNumber are required' }),
    }
  }

  // Create request object
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
  const requestId = nanoid(8)
  const filename = `${dateStr}_${requestId}.json`

  const request = {
    songId: body.songId,
    opNumber: body.opNumber,
    screenshot: body.screenshot || null,
    name: body.name || null,
    timestamp: now.toISOString(),
  }

  // Commit to GitHub via API
  const githubToken = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO || 'yourusername/retrogroove-site'

  if (!githubToken) {
    console.error('GITHUB_TOKEN not configured')
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    }
  }

  const filePath = `content/requests/${filename}`
  const content = Buffer.from(JSON.stringify(request, null, 2)).toString('base64')

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `request: ${body.songId} from ${body.name || 'anonymous'}`,
          content,
          branch: 'main',
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('GitHub API error:', errorData)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to save request' }),
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, requestId }),
    }
  } catch (error) {
    console.error('Error saving request:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save request' }),
    }
  }
}

export { handler }
