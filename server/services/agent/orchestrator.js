const OpenAI = require('openai');
const { tools, executeTool } = require('./tools');
const { buildSystemPrompt } = require('./systemPrompt');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TOOL_ROUNDS = 4;
const FOLLOWUP_MARKER = 'FOLLOWUPS:';

// Devanagari in the message → serve Hindi catalogue rows; otherwise English
const dataLangFor = (text) => (/[ऀ-ॿ]/.test(text) ? 'hi' : 'en');

// Common Hindi function words written in Latin letters; one hit marks the message as Hinglish
const HINGLISH_WORDS = /\b(ka|ki|ke|ko|se|me|mein|hai|hain|ho|hoga|hogi|kya|kaise|kab|kahan|kitna|kitne|kaun|konsa|kaunsa|batao|bataye|bataiye|chahiye|karna|karein|nahi|aur|mujhe|mera|meri|wala|wali|bhav|accha|achha|sasta)\b/i;

function replyScriptNote(text) {
  if (/[ऀ-ॿ]/.test(text)) return 'The latest user message is in Devanagari. Reply in Hindi using Devanagari script.';
  if (HINGLISH_WORDS.test(text)) return 'The latest user message is Hindi written in English letters. Reply ONLY in Roman Hinglish (Latin script), never Devanagari.';
  return 'The latest user message is in English. Reply ONLY in simple English, even if tool data contains Hindi.';
}

/**
 * Streams the text up to (not including) the FOLLOWUPS: line. Holds back a tail of
 * marker length so a marker split across deltas is never emitted.
 */
class FollowupSplitter {
  constructor(onDelta) {
    this.onDelta = onDelta;
    this.full = '';
    this.emitted = 0;
  }

  push(delta) {
    this.full += delta;
    const markerAt = this.full.indexOf(FOLLOWUP_MARKER);
    const safeEnd = markerAt >= 0 ? markerAt : Math.max(this.emitted, this.full.length - FOLLOWUP_MARKER.length);
    if (safeEnd > this.emitted) {
      this.onDelta(this.full.slice(this.emitted, safeEnd));
      this.emitted = safeEnd;
    }
  }

  finish() {
    const markerAt = this.full.indexOf(FOLLOWUP_MARKER);
    const textEnd = markerAt >= 0 ? markerAt : this.full.length;
    if (textEnd > this.emitted) this.onDelta(this.full.slice(this.emitted, textEnd));
    let suggestions = [];
    if (markerAt >= 0) {
      try {
        suggestions = JSON.parse(this.full.slice(markerAt + FOLLOWUP_MARKER.length).trim().match(/\[[\s\S]*\]/)[0]);
      } catch (e) {
        suggestions = [];
      }
    }
    return { text: this.full.slice(0, textEnd).trim(), suggestions: suggestions.slice(0, 3) };
  }
}

/**
 * Runs one chat turn: LLM with tool calling, streamed.
 * @param {object} opts
 * @param {string} opts.message - user message
 * @param {Array<{role, content}>} opts.history - prior turns, oldest first
 * @param {object} opts.profile - known user facts (state, district, lat/lon)
 * @param {object} opts.pageContext - TJ page the widget is embedded on
 * @param {(delta: string) => void} opts.onDelta - streamed answer text
 * @param {(block: object) => void} opts.onBlock - structured card data from tools
 * @param {AbortSignal} opts.signal - lets the client stop generation
 */
async function runChatTurn({ message, history = [], profile = {}, pageContext = null, onDelta = () => {}, onBlock = () => {}, signal }) {
  const ctx = { dataLang: dataLangFor(message), profile };
  // Tool results often contain Hindi/Hinglish text, which pulls the model off the user's language; pin it per turn
  const messages = [
    { role: 'system', content: buildSystemPrompt({ profile, pageContext }) },
    ...history,
    { role: 'system', content: replyScriptNote(message) },
    { role: 'user', content: message }
  ];
  const blocks = [];
  const toolsUsed = [];
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const splitter = new FollowupSplitter(onDelta);

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      // Last round has no tools so the model must answer
      ...(round < MAX_TOOL_ROUNDS ? { tools, parallel_tool_calls: true } : {}),
      temperature: 0.4,
      max_tokens: 1200,
      stream: true,
      stream_options: { include_usage: true }
    }, { signal });

    const toolCalls = [];
    let finishReason = null;
    for await (const chunk of stream) {
      if (chunk.usage) {
        usage.prompt_tokens += chunk.usage.prompt_tokens;
        usage.completion_tokens += chunk.usage.completion_tokens;
        usage.total_tokens += chunk.usage.total_tokens;
      }
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.delta?.content) splitter.push(choice.delta.content);
      for (const tc of choice.delta?.tool_calls || []) {
        const slot = toolCalls[tc.index] || (toolCalls[tc.index] = { id: '', name: '', args: '' });
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.name += tc.function.name;
        if (tc.function?.arguments) slot.args += tc.function.arguments;
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    if (finishReason !== 'tool_calls' || !toolCalls.length) break;

    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } }))
    });

    const outputs = await Promise.all(toolCalls.map(async (tc) => {
      let args = {};
      try { args = JSON.parse(tc.args || '{}'); } catch (e) { /* malformed args: run with defaults */ }
      console.log(`🛠️ Tool ${tc.name} ${JSON.stringify(args)}`);
      toolsUsed.push({ name: tc.name, args });
      return { tc, out: await executeTool(tc.name, args, ctx) };
    }));

    for (const { tc, out } of outputs) {
      if (out.block) {
        blocks.push(out.block);
        onBlock(out.block);
      }
      // Remind the model per result that a card already shows the details, else it re-lists them
      const display = out.block?.type === 'sources'
        ? 'Source links are shown as cards under your reply; answer from these items in your own words and do not paste URLs.'
        : 'Shown to the user as a card under your reply. Do NOT list these items/dates/rows again; reply with a 2-4 line summary and recommendation.';
      const content = out.block ? { ...out.result, _display: display } : out.result;
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(content) });
    }
  }

  const { text, suggestions } = splitter.finish();
  return { text, suggestions, blocks, toolsUsed, usage, model: MODEL, language: ctx.dataLang };
}

module.exports = { runChatTurn, FollowupSplitter, dataLangFor, replyScriptNote };
