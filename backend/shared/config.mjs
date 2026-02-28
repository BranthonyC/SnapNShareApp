import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

// Config cache (lives for the Lambda cold start lifetime)
let tierCache = null;
let pricingCache = null;
let discountsCache = null;

// Secret cache
const secretCache = {};

// Feature flag cache (refreshed every 5 minutes)
let featureCache = null;
let featureCacheTime = 0;
const FEATURE_CACHE_TTL = 5 * 60 * 1000;

export async function getTierConfig(tier) {
  if (!tierCache) {
    const [basic, paid, premium] = await Promise.all([
      getJsonParam('/eventalbum/config/tiers/basic'),
      getJsonParam('/eventalbum/config/tiers/paid'),
      getJsonParam('/eventalbum/config/tiers/premium'),
    ]);
    tierCache = { basic, paid, premium };
  }
  return tierCache[tier];
}

export async function getAllTierConfigs() {
  if (!tierCache) await getTierConfig('basic');
  return tierCache;
}

export async function getPricing() {
  if (!pricingCache) {
    pricingCache = await getJsonParam('/eventalbum/config/pricing');
  }
  return pricingCache;
}

export async function getDiscounts() {
  if (!discountsCache) {
    discountsCache = await getJsonParam('/eventalbum/config/discounts');
  }
  return discountsCache;
}

export async function getSecret(name) {
  if (!secretCache[name]) {
    const { Parameter } = await ssm.send(new GetParameterCommand({
      Name: `/eventalbum/secrets/${name}`,
      WithDecryption: true,
    }));
    secretCache[name] = Parameter.Value;
  }
  return secretCache[name];
}

export async function getFeatureFlag(flag) {
  const now = Date.now();
  if (!featureCache || now - featureCacheTime > FEATURE_CACHE_TTL) {
    const [maintenance, maxEvents] = await Promise.all([
      getStringParam('/eventalbum/features/maintenance-mode'),
      getStringParam('/eventalbum/features/max-events-per-host'),
    ]);
    featureCache = {
      'maintenance-mode': maintenance === 'true',
      'max-events-per-host': parseInt(maxEvents, 10),
    };
    featureCacheTime = now;
  }
  return featureCache[flag];
}

async function getJsonParam(name) {
  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: name }));
  return JSON.parse(Parameter.Value);
}

async function getStringParam(name) {
  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: name }));
  return Parameter.Value;
}
