import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

test('OpenAPI contract parses and all local references resolve', () => {
  const spec = YAML.parse(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'));
  assert.equal(spec.openapi, '3.0.3');
  assert.ok(spec.paths['/api/v1/reminders/manifest']);
  assert.ok(spec.components.securitySchemes.BearerAuth);
  assert.ok(spec.components.securitySchemes.PartnerKey);
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') {
      assert.ok(value.$ref.startsWith('#/'), `External reference not supported: ${value.$ref}`);
      const target = value.$ref.slice(2).split('/').reduce((part, key) => part?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
      assert.ok(target, `Unresolved reference: ${value.$ref}`);
    }
    for (const child of Object.values(value)) walk(child);
  }
  walk(spec);
});
