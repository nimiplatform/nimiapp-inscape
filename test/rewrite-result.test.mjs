import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRewriteResult } from '../src/domain/rewrite.ts';
import { buildRewritePrompt } from '../src/product/relationship/rewrite-prompts.ts';

const drafts = {
  variants: ['Warm', 'Direct', 'Gentle'].map((tone) => ({
    tone,
    text: `${tone}: I would like you to listen first.`,
    note: 'Keeps the request clear.',
  })),
};
test('rewrite results require three distinct complete drafts, without invented missing fields', () => {
  assert.deepEqual(parseRewriteResult(JSON.stringify(drafts)), drafts);
  assert.equal(parseRewriteResult(JSON.stringify({ variants: drafts.variants.slice(0, 2) })), null);
  assert.equal(
    parseRewriteResult(
      JSON.stringify({ variants: [drafts.variants[0], drafts.variants[0], drafts.variants[2]] }),
    ),
    null,
  );
  assert.equal(
    parseRewriteResult(
      JSON.stringify({ variants: [...drafts.variants.slice(0, 2), { tone: 'missing text' }] }),
    ),
    null,
  );
  assert.equal(parseRewriteResult('Here are your drafts'), null);
});
test('rewrite request asks for messages rather than a lecture and omits absent type metadata', () => {
  const prompt = buildRewritePrompt('Please hear me out.', 'Friend', 'friend', null, 'zh');
  assert.match(prompt.system, /exactly three/);
  assert.match(prompt.system, /No preface, lecture/);
  assert.equal(JSON.parse(prompt.user).draft, 'Please hear me out.');
  assert.equal('tentativeSelfType' in JSON.parse(prompt.user), false);
});
