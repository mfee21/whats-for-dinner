import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

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
- instructions: numbered steps joined by newlines. Each step should contain one primary action. If the source text combines multiple actions into one step, split them into separate steps. Never merge distinct actions into one step.
- notes: useful extra information only — empty string if nothing notable
- Return ONLY the JSON object. No markdown fences, no explanation, no preamble.`

function extractOgImage(html: string): string | null {
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  return match?.[1] ?? null
}

function extractJsonLd(html: string): string | null {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of matches) {
    try {
      const data: unknown = JSON.parse(match[1])
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        const typed = item as Record<string, unknown>
        if (typed['@type'] === 'Recipe') return JSON.stringify(typed)
        const graph = typed['@graph']
        if (Array.isArray(graph)) {
          const recipe = graph.find((g: Record<string, unknown>) => g['@type'] === 'Recipe')
          if (recipe) return JSON.stringify(recipe)
        }
      }
    } catch {
      // skip malformed JSON-LD blocks
    }
  }
  return null
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' })
  }

  const body = req.body as { type?: 'text' | 'url'; content?: string }

  if (!body.content?.trim()) {
    return res.status(400).json({ error: 'Content is required.' })
  }

  let recipeText = body.content

  let imageUrl: string | null = null

  if (body.type === 'url') {
    const scraperApiKey = process.env.SCRAPERAPI_KEY
    if (!scraperApiKey) {
      return res.status(500).json({ error: 'ScraperAPI key not configured on server.' })
    }
    try {
      const scrapeUrl = `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(body.content)}`
      const pageRes = await fetch(scrapeUrl)
      if (!pageRes.ok) {
        const scraperError = await pageRes.text().catch(() => '')
        console.error(`ScraperAPI ${pageRes.status}:`, scraperError)
        return res.status(400).json({
          error: `Could not fetch that URL (HTTP ${pageRes.status}). Try pasting the recipe text instead.`,
        })
      }
      const html = await pageRes.text()
      imageUrl = extractOgImage(html)
      recipeText = extractJsonLd(html) ?? stripHtml(html).slice(0, 15000)
    } catch {
      return res.status(400).json({
        error: 'Could not reach that URL. Try pasting the recipe text instead.',
      })
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
    const errMessage = err instanceof Anthropic.APIError ? err.message : 'AI extraction failed.'
    return res.status(502).json({ error: errMessage })
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
    return res.status(200).json({ ...parsed, imageUrl })
  } catch {
    return res.status(422).json({
      error: "Couldn't extract a recipe from that content. Try pasting the text directly.",
    })
  }
}
