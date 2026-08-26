import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , templateArgument, outputArgument] = process.argv;

if (!templateArgument || !outputArgument) {
  throw new Error(
    'Usage: node scripts/generate-google-play-data-safety-csv.mjs <Play export.csv> <private output.csv>',
  );
}

const templatePath = resolve(templateArgument);
const outputPath = resolve(outputArgument);
const draft = JSON.parse(readFileSync(
  new URL('../docs/mobile/google-play-console-draft.en-US.json', import.meta.url),
  'utf8',
));

const parseCsv = (source) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  assert.equal(quoted, false, 'CSV contains an unterminated quoted field');
  return rows;
};

const escapeCsv = (value) => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const rows = parseCsv(readFileSync(templatePath, 'utf8'));
assert.deepEqual(rows[0], [
  'Question ID (machine readable)',
  'Response ID (machine readable)',
  'Response value',
  'Answer requirement',
  'Human-friendly question label',
]);

for (const row of rows.slice(1)) {
  assert.equal(row.length, 5, `Unexpected Data Safety CSV row width for ${row[0]}`);
  row[2] = '';
}

const answers = new Map();
const answerKey = (questionId, responseId = '') => `${questionId}\u0000${responseId}`;
const answer = (questionId, responseId, value = 'TRUE') => {
  answers.set(answerKey(questionId, responseId), value);
};

answer('PSL_DATA_COLLECTION_COLLECTS_PERSONAL_DATA', '', 'TRUE');
answer('PSL_DATA_COLLECTION_ENCRYPTED_IN_TRANSIT', '', draft.dataSafety.encryptedInTransit ? 'TRUE' : 'FALSE');
assert.equal(draft.accountProvisioning.inAppAccountCreation, false);
assert.equal(draft.accountProvisioning.outsideAppAccounts, true);
assert.equal(draft.accountProvisioning.outsideAppAccountType, 'employment_or_enterprise');
answer('PSL_SUPPORTED_ACCOUNT_CREATION_METHODS', 'PSL_ACM_NONE');
answer('PSL_ACCOUNT_DELETION_URL', '', draft.dataSafety.accountDeletionUrl);
answer('PSL_SUPPORT_DATA_DELETION_BY_USER', 'DATA_DELETION_YES');
answer('PSL_DATA_DELETION_URL', '', draft.dataSafety.accountDeletionUrl);
answer('PSL_HAS_OUTSIDE_APP_ACCOUNTS', '', draft.accountProvisioning.outsideAppAccounts ? 'TRUE' : 'FALSE');
answer('PSL_OUTSIDE_APP_ACCOUNT_TYPES', 'PSL_LOGIN_THROUGH_EMPLOYMENT_OR_ENTERPRISE_ACCOUNT');

const dataTypeDefinitions = {
  'Name': {
    categoryQuestion: 'PSL_DATA_TYPES_PERSONAL',
    response: 'PSL_NAME',
    purposes: ['PSL_APP_FUNCTIONALITY', 'PSL_ACCOUNT_MANAGEMENT'],
  },
  'Email address': {
    categoryQuestion: 'PSL_DATA_TYPES_PERSONAL',
    response: 'PSL_EMAIL',
    purposes: ['PSL_APP_FUNCTIONALITY', 'PSL_ACCOUNT_MANAGEMENT'],
  },
  'User IDs': {
    categoryQuestion: 'PSL_DATA_TYPES_PERSONAL',
    response: 'PSL_USER_ACCOUNT',
    purposes: ['PSL_APP_FUNCTIONALITY', 'PSL_ACCOUNT_MANAGEMENT'],
  },
  'Approximate location': {
    categoryQuestion: 'PSL_DATA_TYPES_LOCATION',
    response: 'PSL_APPROX_LOCATION',
    purposes: ['PSL_APP_FUNCTIONALITY'],
  },
  'Precise location': {
    categoryQuestion: 'PSL_DATA_TYPES_LOCATION',
    response: 'PSL_PRECISE_LOCATION',
    purposes: ['PSL_APP_FUNCTIONALITY'],
  },
  'Photos': {
    categoryQuestion: 'PSL_DATA_TYPES_PHOTOS_AND_VIDEOS',
    response: 'PSL_PHOTOS',
    purposes: ['PSL_APP_FUNCTIONALITY'],
  },
  'Other user-generated content': {
    categoryQuestion: 'PSL_DATA_TYPES_APP_ACTIVITY',
    response: 'PSL_USER_GENERATED_CONTENT',
    purposes: ['PSL_APP_FUNCTIONALITY'],
  },
  'Device or other IDs': {
    categoryQuestion: 'PSL_DATA_TYPES_IDENTIFIERS',
    response: 'PSL_DEVICE_ID',
    purposes: ['PSL_APP_FUNCTIONALITY'],
  },
};

const disclosedTypes = draft.dataSafety.dataTypes.flatMap(({ types, required }) => (
  types.map((type) => ({ type, required }))
));

for (const { type, required } of disclosedTypes) {
  const definition = dataTypeDefinitions[type];
  assert.ok(definition, `Missing Google CSV mapping for ${type}`);

  const prefix = `PSL_DATA_USAGE_RESPONSES:${definition.response}`;
  answer(definition.categoryQuestion, definition.response);
  answer(`${prefix}:PSL_DATA_USAGE_COLLECTION_AND_SHARING`, 'PSL_DATA_USAGE_ONLY_COLLECTED');
  answer(`${prefix}:PSL_DATA_USAGE_EPHEMERAL`, '', 'FALSE');
  answer(
    `${prefix}:DATA_USAGE_USER_CONTROL`,
    required ? 'PSL_DATA_USAGE_USER_CONTROL_REQUIRED' : 'PSL_DATA_USAGE_USER_CONTROL_OPTIONAL',
  );
  for (const purpose of definition.purposes) {
    answer(`${prefix}:DATA_USAGE_COLLECTION_PURPOSE`, purpose);
  }
}

const templateKeys = new Set();
for (const row of rows.slice(1)) {
  const key = answerKey(row[0], row[1]);
  templateKeys.add(key);
  const value = answers.get(key);
  if (value !== undefined) row[2] = value;
}

for (const key of answers.keys()) {
  assert.ok(templateKeys.has(key), `Current Play CSV template is missing an approved answer: ${key}`);
}

for (const row of rows.slice(1)) {
  if (row[3] === 'REQUIRED') {
    assert.notEqual(row[2], '', `Required answer is blank: ${row[0]}`);
  }
}

const selectedTypes = new Set(disclosedTypes.map(({ type }) => dataTypeDefinitions[type].response));
const selectedUsageTypes = new Set(
  rows.slice(1)
    .filter((row) => row[2] !== '' && row[0].startsWith('PSL_DATA_USAGE_RESPONSES:'))
    .map((row) => row[0].split(':')[1]),
);
assert.deepEqual(selectedUsageTypes, selectedTypes, 'Usage answers and selected data types diverge');

const output = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
writeFileSync(outputPath, output, 'utf8');

console.log(JSON.stringify({
  template: templatePath,
  output: outputPath,
  rows: rows.length - 1,
  populatedResponses: rows.slice(1).filter((row) => row[2] !== '').length,
  disclosedDataTypes: [...selectedTypes],
  encryptedInTransit: draft.dataSafety.encryptedInTransit,
  sharesData: draft.dataSafety.sharesData,
}, null, 2));
