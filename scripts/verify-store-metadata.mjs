import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listing = JSON.parse(readFileSync(
  new URL('../docs/mobile/store-listing.en-US.json', import.meta.url),
  'utf8',
));
const mobilePackage = JSON.parse(readFileSync(
  new URL('../apps/mobile/package.json', import.meta.url),
  'utf8',
));
const expoConfig = readFileSync(
  new URL('../apps/mobile/app.config.ts', import.meta.url),
  'utf8',
);

function atMost(value, limit, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.length > 0, `${label} must not be empty`);
  assert.ok(value.length <= limit, `${label} exceeds ${limit} characters (${value.length})`);
}

assert.equal(listing.releaseVersion, '1.0.0');
assert.equal(mobilePackage.version, listing.releaseVersion);
assert.match(expoConfig, new RegExp(`version:\\s*['\"]${listing.releaseVersion.replaceAll('.', '\\.')}['\"]`));
assert.equal(listing.locale, 'en-US');
assert.deepEqual(listing.countries, ['US'], 'The initial store release must remain United States only');

atMost(listing.apple.name, 30, 'Apple name');
atMost(listing.apple.subtitle, 30, 'Apple subtitle');
atMost(listing.apple.promotionalText, 170, 'Apple promotional text');
atMost(listing.apple.keywords, 100, 'Apple keywords');
atMost(listing.apple.description, 4000, 'Apple description');
atMost(listing.apple.whatsNew, 4000, 'Apple What’s New');
atMost(listing.google.appName, 30, 'Google app name');
atMost(listing.google.shortDescription, 80, 'Google short description');
atMost(listing.google.fullDescription, 4000, 'Google full description');

assert.equal(listing.google.appName, listing.apple.name, 'Store names must agree');
assert.equal(listing.google.fullDescription, listing.apple.description, 'Store descriptions must agree');
assert.equal(listing.google.category, 'Business');
assert.equal(listing.google.contactEmail, 'support@railcommand.io');
assert.equal(listing.google.containsAds, false);
assert.equal(listing.google.externalMarketingDecision, 'pending_release_owner');

for (const [name, value] of Object.entries(listing.urls)) {
  const url = new URL(value);
  assert.equal(url.protocol, 'https:', `${name} URL must use HTTPS`);
  assert.ok(['railcommand.io', 'www.railcommand.io'].includes(url.hostname), `${name} URL must use the approved domain`);
}

const storeCopy = JSON.stringify({ apple: listing.apple, google: listing.google }).toLowerCase();
for (const prohibitedClaim of [
  'full offline project management',
  'real-time offline',
  'guaranteed background sync',
  'available worldwide',
]) {
  assert.ok(!storeCopy.includes(prohibitedClaim), `Store copy contains prohibited claim: ${prohibitedClaim}`);
}

console.log(JSON.stringify({
  releaseVersion: listing.releaseVersion,
  locale: listing.locale,
  countries: listing.countries,
  characterCounts: {
    appleName: listing.apple.name.length,
    appleSubtitle: listing.apple.subtitle.length,
    applePromotionalText: listing.apple.promotionalText.length,
    appleKeywords: listing.apple.keywords.length,
    appleDescription: listing.apple.description.length,
    appleWhatsNew: listing.apple.whatsNew.length,
    googleName: listing.google.appName.length,
    googleShortDescription: listing.google.shortDescription.length,
    googleFullDescription: listing.google.fullDescription.length,
  },
  externalMarketingDecision: listing.google.externalMarketingDecision,
}, null, 2));
