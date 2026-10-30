import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerFromEvidence, bedrockConfig } from '../src/server/aira';
import { publicationFixture as p } from '../src/shared/fixtures';
const response = JSON.stringify({
  statements: [
    { text: 'A synthetic scenario suggests seasonal comparison context.', citations: [p.id] },
  ],
  uncertainty: 'Small synthetic sample; no prevalence inference.',
});
test('AIRA returns only cited current approved evidence', async () => {
  let retrievals = 0;
  const result = await answerFromEvidence(
    'Explain seasonal context',
    async () => {
      retrievals++;
      return [p];
    },
    async (q, s) => {
      assert.equal(s[0].id, p.id);
      return response;
    },
  );
  assert.equal(result.status, 'answered');
  assert.equal(retrievals, 2);
});
test('AIRA handles no evidence, provider failure, invalid output and hallucinated citations', async () => {
  assert.equal(
    (
      await answerFromEvidence(
        'Question',
        async () => [],
        async () => {
          throw Error('must not invoke');
        },
      )
    ).status,
    'insufficient_evidence',
  );
  assert.equal(
    (
      await answerFromEvidence(
        'Question',
        async () => [p],
        async () => {
          throw Error('expired secret');
        },
      )
    ).status,
    'unavailable',
  );
  for (const raw of [
    'bad JSON',
    '{"insufficient":true}',
    response.replace(p.id, '99999999-0000-4000-8000-000000000001'),
  ])
    assert.equal(
      (
        await answerFromEvidence(
          'Question',
          async () => [p],
          async () => raw,
        )
      ).status,
      'insufficient_evidence',
    );
});
test('AIRA discards in-flight output after withdrawal and never falls back to host credentials', async () => {
  let first = true;
  const result = await answerFromEvidence(
    'Question',
    async () => {
      if (first) {
        first = false;
        return [p];
      }
      return [];
    },
    async () => response,
  );
  assert.equal(result.status, 'insufficient_evidence');
  assert.equal(
    bedrockConfig({ AWS_ACCESS_KEY_ID: 'unrelated', AWS_SECRET_ACCESS_KEY: 'unrelated' }),
    null,
  );
  assert.equal(
    bedrockConfig({
      BEDROCK_ACCESS_KEY_ID: 'x',
      BEDROCK_SECRET_ACCESS_KEY: 'x',
      BEDROCK_REGION: 'us-east-1',
      BEDROCK_MODEL_ID: 'x',
    }),
    null,
  );
});
