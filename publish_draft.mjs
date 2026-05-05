import https from 'https';

const token = process.env.GH_TOKEN;
const repo = 'EungiBang/body_aging_test';

const options = {
  hostname: 'api.github.com',
  path: `/repos/${repo}/releases`,
  method: 'GET',
  headers: {
    'User-Agent': 'Node.js',
    'Authorization': `token ${token}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const releases = JSON.parse(data);
    const draft = releases.find(r => r.draft === true);
    if (draft) {
      console.log(`Found draft release: ${draft.name} (id: ${draft.id}). Publishing...`);
      const patchOptions = {
        hostname: 'api.github.com',
        path: `/repos/${repo}/releases/${draft.id}`,
        method: 'PATCH',
        headers: {
          'User-Agent': 'Node.js',
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        }
      };
      const patchReq = https.request(patchOptions, (patchRes) => {
        console.log(`Publish status: ${patchRes.statusCode}`);
      });
      patchReq.write(JSON.stringify({ draft: false }));
      patchReq.end();
    } else {
      console.log('No draft releases found.');
    }
  });
});
req.end();
