import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const draft = JSON.parse(readFileSync(
  new URL('../docs/mobile/google-play-console-draft.en-US.json', import.meta.url),
  'utf8',
));
const listing = JSON.parse(readFileSync(
  new URL('../docs/mobile/store-listing.en-US.json', import.meta.url),
  'utf8',
));
const expoConfig = readFileSync(
  new URL('../apps/mobile/app.config.ts', import.meta.url),
  'utf8',
);

assert.equal(draft.privacyPolicyUrl, listing.urls.privacy);
assert.equal(draft.dataSafety.accountDeletionUrl, listing.urls.accountDeletion);
assert.equal(draft.ads.containsAds, listing.google.containsAds);
assert.equal(draft.storeSettings.category, listing.google.category);
assert.equal(draft.storeSettings.contactEmail, listing.google.contactEmail);
assert.equal(draft.storeSettings.website, listing.urls.marketing);
assert.equal(draft.storeSettings.externalMarketing, 'PENDING_RELEASE_OWNER');
assert.equal(draft.appAccess.restricted, true);
assert.equal(draft.appAccess.reviewerCredentials, 'STORE_CONSOLE_ONLY_PENDING');
assert.equal(draft.accountProvisioning.inAppAccountCreation, false);
assert.equal(draft.accountProvisioning.outsideAppAccounts, true);
assert.equal(draft.accountProvisioning.outsideAppAccountType, 'employment_or_enterprise');
assert.doesNotMatch(JSON.stringify(draft), /password|access[_ -]?token|service[_ -]?role/i, 'Draft must not contain credentials');

assert.equal(draft.dataSafety.collectsData, true);
assert.equal(draft.dataSafety.sharesData, false);
assert.equal(draft.dataSafety.encryptedInTransit, true);
assert.equal(draft.dataSafety.accountDeletionAvailable, true);
assert.equal(draft.targetAudience.designedForChildren, false);
assert.deepEqual(draft.targetAudience.ages, ['18+']);
assert.equal(draft.governmentApp, false);
assert.deepEqual(draft.financialFeatures, []);
assert.deepEqual(draft.healthFeatures, []);

const disclosedTypes = new Set(draft.dataSafety.dataTypes.flatMap(({ types }) => types));
const dataTypeRequirements = new Map(
  draft.dataSafety.dataTypes.flatMap(({ types, required }) => types.map((type) => [type, required])),
);
assert.equal(dataTypeRequirements.get('Name'), true);
assert.equal(dataTypeRequirements.get('Email address'), true);
assert.equal(dataTypeRequirements.get('User IDs'), true);
for (const optionalType of [
  'Photos',
  'Approximate location',
  'Precise location',
  'Other user-generated content',
  'Device or other IDs',
]) {
  assert.equal(dataTypeRequirements.get(optionalType), false, `${optionalType} must remain user-optional`);
}
const nativePrivacyMappings = new Map([
  ['Name', 'Name'],
  ['Email address', 'EmailAddress'],
  ['User IDs', 'UserID'],
  ['Photos', 'PhotosorVideos'],
  ['Approximate location', 'CoarseLocation'],
  ['Precise location', 'PreciseLocation'],
  ['Other user-generated content', 'OtherUserContent'],
  ['Device or other IDs', 'DeviceID'],
]);
for (const type of disclosedTypes) {
  const nativeType = nativePrivacyMappings.get(type);
  assert.ok(nativeType, `No Apple privacy mapping exists for ${type}`);
  assert.match(expoConfig, new RegExp(`['\"]${nativeType}['\"]`));
}

for (const asset of Object.values(draft.assetSources).filter((path) => !path.endsWith('/google'))) {
  assert.ok(existsSync(new URL(`../${asset}`, import.meta.url)), `${asset} is missing`);
}

assert.match(expoConfig, /NSPrivacyTracking:\s*false/);
assert.match(expoConfig, /ACCESS_BACKGROUND_LOCATION/);
assert.match(expoConfig, /RECORD_AUDIO/);
assert.doesNotMatch(expoConfig, /NSMicrophoneUsageDescription/);

console.log(JSON.stringify({
  appAccess: 'restricted_reviewer_account_required',
  disclosedDataTypeCount: disclosedTypes.size,
  sharesData: draft.dataSafety.sharesData,
  encryptedInTransit: draft.dataSafety.encryptedInTransit,
  targetAudience: draft.targetAudience.ages,
  pendingExternalDecisions: [
    'reviewer credentials',
    'IARC contact and Terms acceptance',
    'questionnaire-generated rating',
  ],
}, null, 2));
