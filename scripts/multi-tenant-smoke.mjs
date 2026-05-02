const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const testPrimaryHost = process.env.TEST_PRIMARY_HOST || '';
const testAliasHost = process.env.TEST_ALIAS_HOST || '';
const testCanonicalHost = process.env.TEST_CANONICAL_HOST || '';
const strictUnknownHostCheck = (process.env.STRICT_UNKNOWN_HOST_CHECK || '').toLowerCase() === 'true';
const unknownHost = process.env.TEST_UNKNOWN_HOST || 'unknown.example.test';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      ...(options.host ? { 'x-forwarded-host': options.host } : {}),
      ...(options.headers || {}),
    },
  });
  return response;
}

async function checkPrimaryHost() {
  if (!testPrimaryHost) {
    console.log('skip primary-host check (TEST_PRIMARY_HOST not set)');
    return;
  }

  const response = await request('/', { host: testPrimaryHost });
  assert(response.status < 400, `primary host "${testPrimaryHost}" failed with status ${response.status}`);
  console.log(`ok primary host (${testPrimaryHost}) => ${response.status}`);
}

async function checkCanonicalRedirect() {
  if (!testAliasHost || !testCanonicalHost) {
    console.log('skip canonical redirect check (TEST_ALIAS_HOST / TEST_CANONICAL_HOST not set)');
    return;
  }

  const response = await request('/', { host: testAliasHost });
  assert(response.status === 308, `alias host "${testAliasHost}" expected 308 but got ${response.status}`);
  const location = response.headers.get('location') || '';
  assert(
    location.includes(`://${testCanonicalHost}`) || location.startsWith(`https://${testCanonicalHost}`),
    `alias host "${testAliasHost}" did not redirect to canonical "${testCanonicalHost}" (location: ${location || '(none)'})`
  );
  console.log(`ok canonical redirect (${testAliasHost} -> ${testCanonicalHost})`);
}

async function checkUnknownHost() {
  if (!strictUnknownHostCheck) {
    console.log('skip unknown-host check (STRICT_UNKNOWN_HOST_CHECK!=true)');
    return;
  }

  const response = await request('/', { host: unknownHost });
  assert(
    response.status === 404 || response.status === 308,
    `unknown host "${unknownHost}" expected 404/308 but got ${response.status}`
  );
  console.log(`ok unknown host (${unknownHost}) => ${response.status}`);
}

async function run() {
  await checkPrimaryHost();
  await checkCanonicalRedirect();
  await checkUnknownHost();
  console.log('multi-tenant smoke checks passed');
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
