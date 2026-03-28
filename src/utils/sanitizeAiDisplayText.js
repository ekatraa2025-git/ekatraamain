function isAssistantModelEchoLine(line) {
    const x = line.trim()
    if (!x) return true
    if (/^model\s*[:：]\s*claude[-\w.]*/i.test(x)) return true
    if (/^model\s*[:：]\s*$/i.test(x)) return true
    if (/^claude[-a-z0-9.]+$/i.test(x) && x.length < 96) return true
    if (/^assistant\s*model\s*[:：]\s*\S+$/i.test(x)) return true
    return false
}

function stripLeadingTrailingModelEchoLines(s) {
    const lines = s.split('\n')
    while (lines.length && isAssistantModelEchoLine(lines[0])) lines.shift()
    while (lines.length && isAssistantModelEchoLine(lines[lines.length - 1])) lines.pop()
    return lines.join('\n').trim()
}

/** Strip model-id echoes from assistant text (gentle: do not rewrite words inside sentences). */
export function sanitizeAiDisplayText(s) {
    if (typeof s !== 'string') return ''
    const raw = s.trim()
    if (!raw) return ''
    const gentle = stripLeadingTrailingModelEchoLines(raw)
    if (gentle.length > 0) return gentle
    const deGlued = raw.replace(/^\s*model\s*[:：]\s*claude[-\w.]*/i, '').trim()
    return deGlued || raw
}
