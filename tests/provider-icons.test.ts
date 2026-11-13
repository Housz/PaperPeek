import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('bundled provider brand assets', () => {
  it.each(['openai', 'deepseek', 'gemini'])('includes a local inert %s SVG', provider => {
    const svg = readFileSync(resolve('public/provider-icons', provider + '.svg'), 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/<script|<foreignObject|onload=|onerror=|(?:href|src)=["']https?:/i);
  });
  it('retains provenance and license', () => {
    expect(readFileSync(resolve('public/provider-icons/LICENSE.txt'), 'utf8')).toMatch(/MIT|Permission/i);
    expect(readFileSync(resolve('docs/branding/provider-icons.md'), 'utf8')).toContain('openai');
  });
});
