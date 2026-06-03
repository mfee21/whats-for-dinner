import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Extract structured recipe data from the provided text.

Return ONLY a valid JSON object with these exact fields:
{
  "name": "recipe name",
  "ingredients": ["ingredient 1 with amount and unit", "ingredient 2", ...],
  "instructions": "Step 1: ...\nStep 2: ...\nStep 3: ...",
  "notes": "cooking tips, substitutions, or storage info (empty string if none)"
}

Rules:
- ingredients: one string per ingredient, include quantities and units (e.g. "2 cups flour", "1 tbsp olive oil")
- instructions: numbered steps joined by newlines
- notes: useful extra information only — empty string if nothing notable
- Return ONLY the JSON object. No markdown fences, no explanation, no preamble.`

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { type: 'text' | 'url'; content: string }
  try {
    body = await req.json() as { type: 'text' | 'url'; content: string }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.content?.trim()) {
    return new Response(JSON.stringify({ error: 'Content is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let recipeText = body.content

  if (body.type === 'url') {
    try {
      const pageRes = await fetch(body.content, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-parser/1.0)' },
      })
      if (!pageRes.ok) {
        return new Response(
          JSON.stringify({ error: `Could not fetch that URL (HTTP ${pageRes.status}). Try pasting the recipe text instead.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      const html = await pageRes.text()
      recipeText = stripHtml(html).slice(0, 15000)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Could not reach that URL. Try pasting the recipe text instead.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  const client = new Anthropic({ apiKey })

  let message: Anthropic.Message
  try {
    message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: recipeText }],
    })
  } catch (err) {
    const message = err instanceof Anthropic.APIError ? err.message : 'AI extraction failed.'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(jsonText) as {
      name: string
      ingredients: string[]
      instructions: string
      notes: string
    }
    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(
      JSON.stringify({ error: "Couldn't extract a recipe from that content. Try pasting the text directly." }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
