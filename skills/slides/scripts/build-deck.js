#!/usr/bin/env node

/**
 * build-deck.js — Converts JSON slide schema to Marp-compatible markdown.
 *
 * Usage: node build-deck.js --input slides.json --output deck.md [--theme default]
 *
 * JSON schema:
 * {
 *   "title": "string",
 *   "author": "string (optional)",
 *   "theme": "default|gaia|uncover (optional)",
 *   "slides": [
 *     {
 *       "type": "title|content|code|diagram|image|quote|section",
 *       "heading": "string",
 *       "body": "string (markdown)",
 *       "notes": "string (speaker notes, optional)",
 *       "code": "{ lang, source } (if type=code)",
 *       "diagram": "string (mermaid, if type=diagram)"
 *     }
 *   ]
 * }
 */

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      theme: { type: 'string', short: 't', default: 'default' },
    },
    strict: true,
  });
  return values;
}

function renderSlide(slide) {
  const type = slide.type || 'content';
  const lines = [];

  switch (type) {
    case 'title':
      lines.push(`# ${slide.heading || ''}`);
      if (slide.body) lines.push('', slide.body);
      break;

    case 'section':
      lines.push(`# ${slide.heading || ''}`);
      if (slide.body) lines.push('', slide.body);
      break;

    case 'code':
      if (slide.heading) lines.push(`## ${slide.heading}`, '');
      if (slide.body) lines.push(slide.body, '');
      if (slide.code) {
        lines.push(`\`\`\`${slide.code.lang || ''}`, slide.code.source || '', '```');
      }
      break;

    case 'diagram':
      if (slide.heading) lines.push(`## ${slide.heading}`, '');
      if (slide.body) lines.push(slide.body, '');
      if (slide.diagram) {
        lines.push('```mermaid', slide.diagram, '```');
      }
      break;

    case 'image':
      if (slide.heading) lines.push(`## ${slide.heading}`, '');
      if (slide.body) lines.push(slide.body);
      break;

    case 'quote':
      if (slide.heading) lines.push(`## ${slide.heading}`, '');
      if (slide.body) lines.push(`> ${slide.body.replace(/\n/g, '\n> ')}`);
      break;

    default:
      // 'content' and any unknown type
      if (slide.heading) lines.push(`## ${slide.heading}`);
      if (slide.body) lines.push('', slide.body);
      break;
  }

  if (slide.notes) {
    lines.push('', `<!-- notes: ${slide.notes} -->`);
  }

  return lines.join('\n');
}

function buildDeck(data, theme) {
  const resolvedTheme = data.theme || theme || 'default';

  // Frontmatter
  const parts = ['---', `marp: true`, `theme: ${resolvedTheme}`, '---', ''];

  // Title slide
  parts.push(`# ${data.title || 'Untitled'}`);
  if (data.author) parts.push('', data.author);
  parts.push('');

  // Content slides
  if (Array.isArray(data.slides) && data.slides.length > 0) {
    for (const slide of data.slides) {
      parts.push('---', '');
      parts.push(renderSlide(slide));
      parts.push('');
    }
  }

  return parts.join('\n');
}

async function main() {
  const args = parseCliArgs();

  if (!args.input) {
    console.error('Usage: node build-deck.js --input slides.json --output deck.md [--theme default]');
    process.exit(1);
  }

  let raw;
  try {
    raw = await readFile(args.input, 'utf-8');
  } catch (err) {
    console.error(`Error reading input file: ${err.message}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON: ${err.message}`);
    process.exit(1);
  }

  if (!data.title) {
    console.error('Error: JSON must have a "title" field');
    process.exit(1);
  }

  const markdown = buildDeck(data, args.theme);

  if (args.output) {
    await writeFile(args.output, markdown, 'utf-8');
    console.log(`Deck written to ${args.output} (${data.slides?.length || 0} slides)`);
  } else {
    process.stdout.write(markdown);
  }
}

main();
