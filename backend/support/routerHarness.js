import { EventEmitter } from 'node:events';
import { mock } from 'node:test';

export const TEST_SERVICE_ACCOUNT = JSON.stringify({
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

export const ensureBackendTestEnv = () => {
  process.env.NODE_ENV = 'test';
  process.env.BREVO_API_KEY ??= 'test-brevo-key';
  process.env.TBA_API_KEY ??= 'test-tba-key';
  process.env.FIREBASE_PROJECT_ID ??= 'test-project';
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ??= TEST_SERVICE_ACCOUNT;
};

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const splitPath = (path) => String(path).split('/').filter(Boolean);

export const createFirestoreHarness = (initialFixtureFactory) => {
  let currentFixture = initialFixtureFactory();
  let createdCounters = new Map();

  const getCollectionStore = (collectionName) => {
    if (!currentFixture[collectionName]) {
      currentFixture[collectionName] = {};
    }

    return currentFixture[collectionName];
  };

  const getDocData = (path) => {
    const [collectionName, docId] = splitPath(path);
    return getCollectionStore(collectionName)[docId];
  };

  const setDocData = (path, value) => {
    const [collectionName, docId] = splitPath(path);
    getCollectionStore(collectionName)[docId] = cloneValue(value);
  };

  const deleteDocData = (path) => {
    const [collectionName, docId] = splitPath(path);
    delete getCollectionStore(collectionName)[docId];
  };

  const mergeValues = (currentValue, nextValue) => {
    if (!currentValue || typeof currentValue !== 'object' || Array.isArray(currentValue)) {
      return cloneValue(nextValue);
    }

    const merged = { ...cloneValue(currentValue) };
    Object.entries(nextValue || {}).forEach(([key, value]) => {
      if (
        value
        && typeof value === 'object'
        && !Array.isArray(value)
        && merged[key]
        && typeof merged[key] === 'object'
        && !Array.isArray(merged[key])
      ) {
        merged[key] = mergeValues(merged[key], value);
      } else {
        merged[key] = cloneValue(value);
      }
    });
    return merged;
  };

  const applyUpdateData = (currentValue, updateData) => {
    const nextValue = currentValue && typeof currentValue === 'object'
      ? cloneValue(currentValue)
      : {};

    Object.entries(updateData || {}).forEach(([key, value]) => {
      if (key.includes('.')) {
        const segments = key.split('.');
        let target = nextValue;
        while (segments.length > 1) {
          const segment = segments.shift();
          target[segment] = target[segment] && typeof target[segment] === 'object' ? target[segment] : {};
          target = target[segment];
        }
        target[segments[0]] = cloneValue(value);
        return;
      }

      targetAssign(nextValue, key, value);
    });

    return nextValue;
  };

  const targetAssign = (target, key, value) => {
    if (typeof value === 'object' && value?.__op === 'arrayUnion') {
      const currentArray = Array.isArray(target[key]) ? [...target[key]] : [];
      value.values.forEach((entry) => {
        if (!currentArray.includes(entry)) {
          currentArray.push(entry);
        }
      });
      target[key] = currentArray;
      return;
    }

    if (typeof value === 'object' && value?.__op === 'delete') {
      delete target[key];
      return;
    }

    target[key] = cloneValue(value);
  };

  const buildDocSnapshot = (path) => {
    const data = getDocData(path);
    const [, id] = splitPath(path);
    return {
      id,
      exists: data !== undefined,
      data: () => (data === undefined ? undefined : cloneValue(data)),
      ref: createDocRef(path),
      createTime: { toDate: () => new Date('2026-01-01T00:00:00.000Z') },
      updateTime: { toDate: () => new Date('2026-01-01T00:00:00.000Z') },
    };
  };

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
      const entries = Object.entries(getCollectionStore(collectionName)).map(([id, data]) => ({ id, data }));
      return {
        docs: applyConstraints(entries, constraints).map(({ id }) => buildDocSnapshot(`${collectionName}/${id}`)),
        empty: applyConstraints(entries, constraints).length === 0,
      };
    },
  });

  const createDocRef = (path) => {
    const normalizedPath = splitPath(path).join('/');
    const [, id] = splitPath(normalizedPath);
    return {
      id,
      path: normalizedPath,
      async get() {
        return buildDocSnapshot(normalizedPath);
      },
      async set(value, options = {}) {
        if (options.merge) {
          setDocData(normalizedPath, mergeValues(getDocData(normalizedPath) || {}, value));
          return;
        }
        setDocData(normalizedPath, value);
      },
      async update(value) {
        const currentValue = getDocData(normalizedPath);
        if (currentValue === undefined) {
          const error = new Error('not-found');
          error.code = 5;
          throw error;
        }
        setDocData(normalizedPath, applyUpdateData(currentValue, value));
      },
      async create(value) {
        if (getDocData(normalizedPath) !== undefined) {
          const error = new Error('already exists');
          error.code = 'already-exists';
          throw error;
        }
        setDocData(normalizedPath, value);
      },
      async delete() {
        deleteDocData(normalizedPath);
      },
    };
  };

  const createCollectionRef = (collectionName) => ({
    doc(id) {
      return createDocRef(`${collectionName}/${id}`);
    },
    where(field, operator, value) {
      return createQuery(collectionName).where(field, operator, value);
    },
    orderBy(field, direction = 'asc') {
      return createQuery(collectionName).orderBy(field, direction);
    },
    async get() {
      const entries = Object.entries(getCollectionStore(collectionName)).map(([id]) => buildDocSnapshot(`${collectionName}/${id}`));
      return {
        docs: entries,
        empty: entries.length === 0,
      };
    },
    async add(value) {
      const nextCount = (createdCounters.get(collectionName) || 0) + 1;
      createdCounters.set(collectionName, nextCount);
      const id = `${collectionName}-created-${nextCount}`;
      const docRef = createDocRef(`${collectionName}/${id}`);
      await docRef.set(value);
      return docRef;
    },
  });

  const transaction = {
    async get(ref) {
      return ref.get();
    },
    set(ref, value, options) {
      return ref.set(value, options);
    },
    update(ref, value) {
      return ref.update(value);
    },
    delete(ref) {
      return ref.delete();
    },
  };

  return {
    get fixture() {
      return currentFixture;
    },
    reset() {
      currentFixture = initialFixtureFactory();
      createdCounters = new Map();
    },
    install({ db, auth, tokenClaimsByToken = new Map(), authOverrides = {} }) {
      mock.restoreAll();
      mock.method(db, 'collection', (collectionName) => createCollectionRef(collectionName));
      mock.method(db, 'doc', (path) => createDocRef(path));
      mock.method(db, 'runTransaction', async (runner) => runner(transaction));

      mock.method(auth, 'verifyIdToken', async (token) => {
        const claims = tokenClaimsByToken.get(token);
        if (!claims) {
          const error = new Error('invalid token');
          error.code = 'auth/argument-error';
          throw error;
        }
        return cloneValue(claims);
      });

      Object.entries(authOverrides).forEach(([methodName, implementation]) => {
        mock.method(auth, methodName, implementation);
      });
    },
  };
};

export const createRouterRequester = (router, basePath) => async (path, options = {}) => {
  const routerPath = path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  const requestUrl = new URL(`http://localhost${routerPath}`);
  const req = new EventEmitter();
  req.method = options.method || 'GET';
  req.url = `${requestUrl.pathname}${requestUrl.search}`;
  req.originalUrl = path;
  req.headers = {
    'content-type': 'application/json',
    ...(options.headers || {}),
    ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
  };
  req.body = options.body;
  req.baseUrl = basePath;
  req.path = requestUrl.pathname;
  req.query = Object.fromEntries(requestUrl.searchParams.entries());
  req.params = {};
  req.ip = '127.0.0.1';
  req.get = (name) => req.headers[String(name).toLowerCase()];

  return new Promise((resolve, reject) => {
    let settled = false;
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
      if (!settled) {
        settled = true;
        resolve({ status: res.statusCode, headers: new Map(Object.entries(res.headers)), body });
      }
      return res;
    };
    res.send = res.json;
    res.end = (body) => res.json(body ?? null);

    router.handle(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      if (!settled) {
        settled = true;
        resolve({ status: res.statusCode, headers: new Map(Object.entries(res.headers)), body: null });
      }
    });
  });
};
