/** Strip Anthropic model echoes from strings shown in the UI (inline, glued blocks, or API errors). */
export function sanitizeAiDisplayText(s) {
    if (typeof s !== 'string') return ''
    let t = s.trim()
    t = t.replace(/^\s*model\s*[:：]\s*claude[-\w.]*/i, '')
    t = t.replace(/\bmodel\s*[:：]\s*claude[-\w.]*\b/gi, '')
    t = t.replace(/\bassistant\s*model\s*[:：]\s*\S+/gi, '')
    t = t.replace(/\bclaude-(?:3|sonnet|opus|haiku)[-\d.a-z]*\b/gi, '')
    t = t.replace(/\bclaude-\d[\w.-]*\b/gi, '')
    t = t.replace(/[ \t]{2,}/g, ' ')
    t = t.replace(/\n{3,}/g, '\n\n').trim()
    return t
}
