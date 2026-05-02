const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const routes = ['/', '/services', '/areas', '/blog'];

async function checkRoute(path) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, { redirect: 'manual' });

  if (response.status >= 400) {
    throw new Error(`${path} failed with status ${response.status}`);
  }

  console.log(`ok ${path} (${response.status})`);
}

async function run() {
  for (const route of routes) {
    await checkRoute(route);
  }

  console.log('smoke checks passed');
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
