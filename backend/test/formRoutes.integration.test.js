import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

process.env.NODE_ENV = 'test';
process.env.BREVO_API_KEY ??= 'test-brevo-key';
process.env.TBA_API_KEY ??= 'test-tba-key';
process.env.FIREBASE_PROJECT_ID ??= 'test-project';
process.env.FIREBASE_SERVICE_ACCOUNT_KEY ??= JSON.stringify({
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'test-private-key-id',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBAL6FhlsJbHn4d3DD\n2MjWsuyvGpsmbrBSNXVslSyFt2CavyjKAzJ/lCO4sq/4UvWvTYgqqcJ/wF9qAgjO\nkhcITHQWibwRbShdV9JZgDa9bwyixMcO9ClZsAk7asZIrhkFLuE1+DJaq65hZMnw\nEmu7A5YSliRADh6sLqGjxz9LklSnAgMBAAECgYEAk+mWJZdrYEZGdIWYCFSnFJnd\nThbIWJt6ZW+nYKlvdNCvGDu9v7bMi+8YywU/Yv52cwCsSxRjhbAHZE77nGYU87ST\nvbLi8voCA1a2EQMrx4gQIPoYmR7T/HqjvmWU/9PW4NJQLRpvyzrRfk6dfneJit6h\ngY3towRPiuD6806LkAECQQDgtXfVtBW9IDlVXvhzO5XUJrdvEalAAV1rvfN17XqW\ncqs5CJLHzaiJZTwULjXd0W6oOQ2CF4M1E5LyIRBJsJ7HAkEA2Q1U8dFa7tf5LGoj\n6zk02w6PFw/Otutk5RZ6i31zuK8Qv9RBVOU9VmeZSjOug1BpOdalzInXwJeZjyob\nURo7IQJANyMwCWcL4oFSsCkCi7v2Mr1hS0apIgRzuOk+IRSpfNscOn1pDs/e5//I\nMyd3njsyjOKa9u3wCwkHiJQmW/6TpwJBAIpWju9ZCeX0zSFbvOztFx0PGHAQaSX4\nveOtAgnpuVnaaoh5FfKv8PojKXY7nlyfYZG1lxLYQCTF+t9ebO6yE0ECQDSbIz46\nvbHmOW1L2Cx8oCLbw1q6ywYi+xjcY8iD/etqUqyK80JVHAq8zk4jsjEnv27WX1z0\nBKEAONZRVsg1zqk=\n-----END PRIVATE KEY-----\n',
  client_email: 'test@test-project.iam.gserviceaccount.com',
  client_id: '1234567890',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test',
});

const [{ default: formRoutes }, { auth, db }] = await Promise.all([
  import('../src/routes/formRoutes.js'),
  import('../src/config/firebase.js'),
]);

const tokenClaimsByToken = new Map([
  ['admin-token', { uid: 'admin-1', email: 'admin@example.com', admin: true }],
  ['scout-token', { uid: 'scout-1', email: 'scout@example.com' }],
]);

let currentFixture = {};
let createdSubmissionCount = 0;

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const buildDocSnapshot = (collectionName, id, data) => ({
  id,
  exists: data !== undefined,
  data: () => (data === undefined ? undefined : cloneValue(data)),
  ref: { id, path: `${collectionName}/${id}` },
  createTime: { toDate: () => new Date('2026-01-01T00:00:00.000Z') },
  updateTime: { toDate: () => new Date('2026-01-01T00:00:00.000Z') },
});

const getCollectionStore = (collectionName) => {
  if (!currentFixture[collectionName]) {
    currentFixture[collectionName] = {};
  }

  return currentFixture[collectionName];
};

const getCollectionEntries = (collectionName) => (
  Object.entries(getCollectionStore(collectionName)).map(([id, data]) => ({ id, data }))
);

const buildQuerySnapshot = (collectionName, entries) => ({
  docs: entries.map(({ id, data }) => buildDocSnapshot(collectionName, id, data)),
  empty: entries.length === 0,
});

const applyConstraints = (entries, constraints) => {
  let filtered = [...entries];

  for (const constraint of constraints.whereClauses) {
    if (constraint.operator !== '==') {
      throw new Error(`Unsupported fake Firestore operator: ${constraint.operator}`);
    }

    filtered = filtered.filter(({ data }) => data?.[constraint.field] === constraint.value);
  }

  if (constraints.orderBy) {
    const { field, direction } = constraints.orderBy;
    filtered.sort((left, right) => {
      const leftValue = left.data?.[field];
      const rightValue = right.data?.[field];
      if (leftValue === rightValue) return 0;
      if (leftValue === undefined) return 1;
      if (rightValue === undefined) return -1;
      return leftValue < rightValue ? -1 : 1;
    });

    if (direction === 'desc') {
      filtered.reverse();
    }
  }

  if (constraints.limitValue !== null) {
    filtered = filtered.slice(0, constraints.limitValue);
  }

  return filtered;
};

const createQuery = (collectionName, constraints = {
  whereClauses: [],
  orderBy: null,
  limitValue: null,
}) => ({
  where(field, operator, value) {
    return createQuery(collectionName, {
      ...constraints,
      whereClauses: [...constraints.whereClauses, { field, operator, value }],
    });
  },
  orderBy(field, direction = 'asc') {
    return createQuery(collectionName, {
      ...constraints,
      orderBy: { field, direction },
    });
  },
  limit(limitValue) {
    return createQuery(collectionName, {
      ...constraints,
      limitValue,
    });
  },
  async get() {
    return buildQuerySnapshot(
      collectionName,
      applyConstraints(getCollectionEntries(collectionName), constraints),
    );
  },
});

const createFakeCollection = (collectionName) => ({
  doc(id) {
    return {
      id,
      path: `${collectionName}/${id}`,
      async get() {
        return buildDocSnapshot(collectionName, id, getCollectionStore(collectionName)[id]);
      },
    };
  },
  where(field, operator, value) {
    return createQuery(collectionName).where(field, operator, value);
  },
  orderBy(field, direction = 'asc') {
    return createQuery(collectionName).orderBy(field, direction);
  },
  async get() {
    return buildQuerySnapshot(collectionName, getCollectionEntries(collectionName));
  },
  async add(payload) {
    createdSubmissionCount += 1;
    const id = `${collectionName}-created-${createdSubmissionCount}`;
    getCollectionStore(collectionName)[id] = cloneValue(payload);
    return {
      id,
      async get() {
        return buildDocSnapshot(collectionName, id, getCollectionStore(collectionName)[id]);
      },
    };
  },
});

const createFixture = () => ({
  competitions: {
    'comp-active': {
      name: 'Boise Regional',
      season: '2026',
      status: 'active',
      formIds: ['form-current', 'form-active-secondary', 'form-inactive'],
      activeFormIds: ['form-current', 'form-active-secondary'],
    },
  },
  forms: {
    'form-current': {
      id: 'form-current',
      competitionId: 'comp-active',
      name: 'Current Match Form',
      teamNumberFieldId: 1,
      fields: [
        { id: 1, type: 'text', label: 'Team Number', required: true },
        {
          id: 9,
          type: 'text',
          label: 'Hidden dependency',
          required: false,
          condition: {
            type: 'rule',
            formId: 'form-inactive',
            fieldId: 7,
            operator: 'equals',
            value: 'ready',
          },
        },
      ],
    },
    'form-active-secondary': {
      id: 'form-active-secondary',
      competitionId: 'comp-active',
      name: 'Active Pit Form',
      teamNumberFieldId: 1,
      fields: [
        { id: 1, type: 'text', label: 'Team Number', required: true },
        { id: 2, type: 'text', label: 'Visible Notes', required: false },
      ],
    },
    'form-inactive': {
      id: 'form-inactive',
      competitionId: 'comp-active',
      name: 'Inactive Strategy Form',
      teamNumberFieldId: 1,
      fields: [
        { id: 1, type: 'text', label: 'Team Number', required: true },
        { id: 7, type: 'text', label: 'Secret Notes', required: false },
      ],
    },
  },
  submissions: {
    'sub-inactive-1': {
      formId: 'form-inactive',
      competitionId: 'comp-active',
      normalizedTeamNumber: '254',
      data: {
        '1': '254',
        '7': 'ready',
      },
      timestamp: '2026-04-01T12:00:00.000Z',
    },
  },
});

const resetHarness = () => {
  mock.restoreAll();
  mock.method(auth, 'verifyIdToken', async (token) => {
    const claims = tokenClaimsByToken.get(token);
    if (!claims) {
      const error = new Error('invalid token');
      error.code = 'auth/argument-error';
      throw error;
    }

    return cloneValue(claims);
  });
  mock.method(db, 'collection', (collectionName) => createFakeCollection(collectionName));
  currentFixture = createFixture();
  createdSubmissionCount = 0;
};

const requestJson = async (path, options = {}) => {
  const routerPath = path.startsWith('/api/forms') ? path.slice('/api/forms'.length) || '/' : path;
  const requestUrl = new URL(`http://localhost${routerPath}`);
  const req = new EventEmitter();
  req.method = options.method || 'GET';
  req.url = `${requestUrl.pathname}${requestUrl.search}`;
  req.originalUrl = path;
  req.headers = {
    'content-type': 'application/json',
    ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
  };
  req.body = options.body;
  req.baseUrl = '/api/forms';
  req.path = requestUrl.pathname;
  req.query = Object.fromEntries(requestUrl.searchParams.entries());
  req.params = {};
  req.get = (name) => req.headers[String(name).toLowerCase()];

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (status, body) => {
      if (settled) return;
      settled = true;
      resolve({
        status,
        headers: new Map(Object.entries(res.headers)),
        body,
      });
    };

    const res = new EventEmitter();
    res.headers = {};
    res.locals = {};
    res.statusCode = 200;
    res.set = (field, value) => {
      res.headers[String(field).toLowerCase()] = String(value);
      return res;
    };
    res.header = res.set;
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => {
      finish(res.statusCode, body);
      return res;
    };
    res.send = (body) => {
      finish(res.statusCode, body);
      return res;
    };
    res.end = (body) => {
      finish(res.statusCode, body ?? null);
      return res;
    };

    formRoutes.handle(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      if (!settled) {
        finish(res.statusCode, null);
      }
    });
  });
};

afterEach(() => {
  resetHarness();
});

resetHarness();

test('GET /api/forms/competition/:competitionId rejects unauthenticated access', async () => {
  currentFixture = createFixture();

  const response = await requestJson('/api/forms/competition/comp-active');

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: 'No token provided' });
});

test('GET /api/forms/competition/:competitionId returns all competition forms for admins', async () => {
  currentFixture = createFixture();

  const response = await requestJson('/api/forms/competition/comp-active', {
    token: 'admin-token',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.map((form) => form.id),
    ['form-current', 'form-active-secondary', 'form-inactive'],
  );
});

test('GET /api/forms/competition/:competitionId hides inactive forms from scouts', async () => {
  currentFixture = createFixture();

  const response = await requestJson('/api/forms/competition/comp-active', {
    token: 'scout-token',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.map((form) => form.id),
    ['form-current', 'form-active-secondary'],
  );
});

test('GET /api/forms/:id denies direct access to inactive forms for scouts', async () => {
  currentFixture = createFixture();

  const response = await requestJson('/api/forms/form-inactive', {
    token: 'scout-token',
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    message: 'The selected form is not currently available to this user.',
  });
});

test('GET /api/forms/competition/:competitionId/cross-form-values does not leak inactive-form submissions to scouts', async () => {
  currentFixture = createFixture();

  const response = await requestJson(
    '/api/forms/competition/comp-active/cross-form-values?currentFormId=form-current&teamNumber=254',
    { token: 'scout-token' },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {});
});

test('POST /api/forms/submissions rejects submissions to inactive forms', async () => {
  currentFixture = createFixture();

  const response = await requestJson('/api/forms/submissions', {
    method: 'POST',
    token: 'scout-token',
    body: {
      formId: 'form-inactive',
      competitionId: 'comp-active',
      data: {
        '1': '254',
        '7': 'attempted write',
      },
    },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    message: 'The selected form is not currently accepting submissions.',
  });
});

test('POST /api/forms/submissions persists sanitized data for active forms', async () => {
  currentFixture = createFixture();

  const response = await requestJson('/api/forms/submissions', {
    method: 'POST',
    token: 'scout-token',
    body: {
      formId: 'form-active-secondary',
      competitionId: 'comp-active',
      data: {
        '1': ' frc254 ',
        '2': '  Balanced on stage  ',
      },
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.formId, 'form-active-secondary');
  assert.equal(response.body.competitionId, 'comp-active');
  assert.equal(response.body.normalizedTeamNumber, '254');
  assert.deepEqual(response.body.data, {
    '1': 'frc254',
    '2': 'Balanced on stage',
  });
  assert.ok(currentFixture.submissions['submissions-created-1']);
});
