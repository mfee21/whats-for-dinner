export type ParsedRecipeDraft = {
  name: string
  ingredients: string[]
  instructions: string
  warnings: string[]
}

const INGREDIENT_HEADERS = ['ingredients', 'ingredient']
const INSTRUCTION_HEADERS = ['instructions', 'directions', 'method', 'steps']

export function sanitizeRecipeTextLine(value: string): string {
  return value
    .replace(/[\u00a0\u200b-\u200d\ufeff]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function sanitizeRecipeListLine(value: string): string {
  return sanitizeRecipeTextLine(value)
    .replace(/^[\[\(]?[ xX]?[\]\)]\s*/, '')
    .replace(/^[\u2610\u2611\u2612\u2713\u2714\u2715\u2717\u25a1\u25a2\u25a3\u25a4\u25c6\u25e6\u2022\u2043\u2219]+\s*/u, '')
    .replace(/^[-*+]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^[A-Za-z][.)]\s+/, '')
    .replace(/\s*[|¦]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findHeaderIndex(lines: string[], candidates: string[]): number {
  return lines.findIndex((line) => {
    const normalized = sanitizeRecipeTextLine(line).toLowerCase().replace(/:$/, '')
    return candidates.includes(normalized)
  })
}

export function parseRecipeText(rawText: string): ParsedRecipeDraft {
  const warnings: string[] = []

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return {
      name: '',
      ingredients: [],
      instructions: '',
      warnings: ['No text found. Paste a recipe first.'],
    }
  }

  const ingredientsIndex = findHeaderIndex(lines, INGREDIENT_HEADERS)
  const instructionsIndex = findHeaderIndex(lines, INSTRUCTION_HEADERS)

  let name = lines[0]
  if (INGREDIENT_HEADERS.includes(name.toLowerCase()) || INSTRUCTION_HEADERS.includes(name.toLowerCase())) {
    name = ''
    warnings.push('Could not confidently detect a recipe name. Update it manually.')
  }

  let ingredientLines: string[] = []
  let instructionLines: string[] = []

  if (ingredientsIndex >= 0) {
    const end = instructionsIndex > ingredientsIndex ? instructionsIndex : lines.length
    ingredientLines = lines.slice(ingredientsIndex + 1, end).map(sanitizeRecipeListLine).filter(Boolean)
  }

  if (instructionsIndex >= 0) {
    instructionLines = lines.slice(instructionsIndex + 1).map(sanitizeRecipeListLine).filter(Boolean)
  }

  if (ingredientLines.length === 0 && instructionsIndex > 0) {
    ingredientLines = lines
      .slice(1, instructionsIndex)
      .map(sanitizeRecipeListLine)
      .filter(Boolean)

    if (ingredientLines.length > 0) {
      warnings.push('Ingredients header not found. Inferred ingredients from lines before instructions.')
    }
  }

  if (instructionLines.length === 0 && ingredientsIndex >= 0) {
    instructionLines = lines
      .slice(ingredientsIndex + 1)
      .map(sanitizeRecipeListLine)
      .filter(Boolean)

    if (instructionLines.length > 0) {
      warnings.push('Instructions header not found. Using lines after ingredients.')
    }
  }

  if (ingredientLines.length === 0) {
    warnings.push('Could not detect ingredients. Add them manually.')
  }

  if (instructionLines.length === 0) {
    warnings.push('Could not detect instructions. Add them manually.')
  }

  return {
    name,
    ingredients: ingredientLines,
    instructions: instructionLines.join('\n'),
    warnings,
  }
}
