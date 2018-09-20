import test from 'ava';
import aqp from '../src';

const requiredAqp = require('../src');

test('module imported using require', t => {
  const res = requiredAqp('key=value');
  t.truthy(res);
});

test('filter: basic', t => {
  const res = aqp('key=value');
  t.truthy(res);
  t.deepEqual(res.filter, { key: 'value' });
});

test('filter: number casting', t => {
  const res = aqp('key1=10&key2=1.2&key3=0&key4=0001');
  t.truthy(res);
  t.deepEqual(res.filter, {
    key1: 10,
    key2: 1.2,
    key3: 0,
    key4: '0001',
  });
});

test('filter: boolean casting', t => {
  const res = aqp('key1=true&key2=false');
  t.truthy(res);
  t.deepEqual(res.filter, { key1: true, key2: false });
});

test('filter: regex casting', t => {
  const res = aqp('key1=/regex/&key2=/regexi/i&key3=/^regex, with comma$/');
  t.truthy(res);
  t.deepEqual(res.filter, {
    key1: /regex/,
    key2: /regexi/i,
    key3: /^regex, with comma$/,
  });
});

test('filter: date casting', t => {
  const res = aqp('key1=2016-04&key2=2016-04-12&key3=2016-04-02 08:00');
  t.truthy(res);
  t.deepEqual(res.filter, {
    key1: new Date('2016-04'),
    key2: new Date('2016-04-12'),
    key3: new Date('2016-04-02 08:00'),
  });
});

test('filter: null casting', t => {
  const res = aqp('key=null');
  t.truthy(res);
  t.deepEqual(res.filter, { key: null });
});

test('filter: force casting', t => {
  const res = aqp('key1=string(10)&key2=date(2016)&key3=string(null)');
  t.truthy(res);
  t.deepEqual(res.filter, { key1: '10', key2: new Date('2016'), key3: 'null' });
});

test('filter: custom casters', t => {
  const res = aqp('key1=lowercase(VALUE)&key2=int(10.5)', {
    casters: {
      lowercase: val => val.toLowerCase(),
      int: val => parseInt(val, 10),
    },
  });
  t.truthy(res);
  t.deepEqual(res.filter, { key1: 'value', key2: 10 });
});

test('filter: force param casting', t => {
  const res = aqp(
    'key1=VALUE&key2=10.5&key3=20&key4=foo&key5=   foo   ,  bar',
    {
      casters: {
        lowercase: val => val.toLowerCase(),
        int: val => parseInt(val, 10),
        trim: val => val.trim(),
      },
      castParams: {
        key1: 'lowercase',
        key2: 'int',
        key3: 'string',
        key4: 'unknown',
        key5: 'trim',
      },
    }
  );
  t.truthy(res);
  t.deepEqual(res.filter, {
    key1: 'value',
    key2: 10,
    key3: '20',
    key4: 'foo',
    key5: { $in: ['foo', 'bar'] },
  });
});

test('filter: $gt operator', t => {
  const res = aqp('key>value');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $gt: 'value' } });
});

test('filter: $lt operator', t => {
  const res = aqp('key<value');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $lt: 'value' } });
});

test('filter: $gte operator', t => {
  const res = aqp('key>=value');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $gte: 'value' } });
});

test('filter: $lte operator', t => {
  const res = aqp('key<=value');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $lte: 'value' } });
});

test('filter: $ne operator', t => {
  const res = aqp('key!=value');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $ne: 'value' } });
});

test('filter: $not operator (with regex)', t => {
  const res = aqp('key!=/value/');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $not: /value/ } });
});

test('filter: $in operator (multiple keys)', t => {
  const res = aqp('key=a&key=b');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $in: ['a', 'b'] } });
});

test('filter: $in operator (comma-separated)', t => {
  const res = aqp('key=a,b');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $in: ['a', 'b'] } });
});

test('filter: $in operator (comma-separated regexes)', t => {
  const res = aqp('key=/a/,/b/');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $in: [/a/, /b/] } });
});

test('filter: $in operator (comma-separated regexes containing commas)', t => {
  const res = aqp('key=/a,b/,/b,a/');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $in: [/a,b/, /b,a/] } });
});

test('filter: $nin operator (multiple keys)', t => {
  const res = aqp('key!=a&key!=b');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $nin: ['a', 'b'] } });
});

test('filter: $nin operator (comma-separated)', t => {
  const res = aqp('key!=a,b');
  t.truthy(res);
  t.deepEqual(res.filter, { key: { $nin: ['a', 'b'] } });
});

test('filter: $exists operator', t => {
  const res = aqp('key1&!key2');
  t.truthy(res);
  t.deepEqual(res.filter, {
    key1: { $exists: true },
    key2: { $exists: false },
  });
});

test('filter: advanced usage with filter param', t => {
  const res = aqp('filter={"$or":[{"key1":"value1"},{"key2":"value2"}]}');
  t.truthy(res);
  t.deepEqual(res.filter, { $or: [{ key1: 'value1' }, { key2: 'value2' }] });
});

test('filter: filter param merges with other operators', t => {
  const res = aqp('foo=bar&filter={"key":"value"}');
  t.truthy(res);
  t.deepEqual(res.filter, { foo: 'bar', key: 'value' });
});

test('filter: filter param throws error if invalid JSON string', t => {
  t.throws(
    () => aqp('filter={key:value1}'),
    'Invalid JSON string: {key:value1}'
  );
});

test('filter: filter param skips JSON parsing if already an object', t => {
  const res = aqp({
    foo: 'bar',
    filter: { $or: [{ key1: 'value1' }, { key2: 'value2' }] },
  });
  t.truthy(res);
  t.deepEqual(res.filter, {
    foo: 'bar',
    $or: [{ key1: 'value1' }, { key2: 'value2' }],
  });
});

test('filter: ignore default keys', t => {
  const res = aqp('key=value&skip=0&limit=10&fields=id,name&sort=name');
  t.truthy(res);
  t.truthy(res.filter);
  t.falsy(res.filter.skip);
  t.falsy(res.filter.limit);
  t.falsy(res.filter.fields);
  t.falsy(res.filter.sort);
  t.deepEqual(res.filter, { key: 'value' });
});

test('filter: ignore custom keys', t => {
  const res = aqp('key=value&$skip=0&$limit=10&$fields=id,name&$sort=name', {
    skipKey: '$skip',
    limitKey: '$limit',
    projectionKey: '$fields',
    sortKey: '$sort',
  });
  t.truthy(res);
  t.truthy(res.filter);
  t.falsy(res.filter.$skip);
  t.falsy(res.filter.$limit);
  t.falsy(res.filter.$fields);
  t.falsy(res.filter.$sort);
  t.deepEqual(res.filter, { key: 'value' });
});

test('filter: ignore blacklisted keys', t => {
  const res = aqp('key1>value1&key2=value2&key3<=value3', {
    blacklist: ['key1', 'key3'],
  });
  t.truthy(res);
  t.truthy(res.filter);
  t.falsy(res.filter.key1);
  t.falsy(res.filter.key3);
  t.deepEqual(res.filter, { key2: 'value2' });
});

test('filter: ignore all but whitelisted keys', t => {
  const res = aqp('key1>value1&key2=value2&!key3', {
    whitelist: ['key2'],
  });
  t.truthy(res);
  t.truthy(res.filter);
  t.falsy(res.filter.key1);
  t.falsy(res.filter.key3);
  t.deepEqual(res.filter, { key2: 'value2' });
});

test('skip', t => {
  const res = aqp('skip=10');
  t.truthy(res);
  t.is(res.skip, 10);
});

test('skip (custom key)', t => {
  const res = aqp('offset=10', { skipKey: 'offset' });
  t.truthy(res);
  t.is(res.skip, 10);
});

test('limit', t => {
  const res = aqp('limit=10');
  t.truthy(res);
  t.is(res.limit, 10);
});

test('limit (custom key)', t => {
  const res = aqp('max=10', { limitKey: 'max' });
  t.truthy(res);
  t.is(res.limit, 10);
});

test('projection (includes)', t => {
  const res = aqp('fields=a,b,c');
  t.truthy(res);
  t.deepEqual(res.projection, { a: 1, b: 1, c: 1 });
});

test('projection (includes + _id exclude)', t => {
  const res = aqp('fields=a,b,-_id');
  t.truthy(res);
  t.deepEqual(res.projection, { a: 1, b: 1, _id: 0 });
});

test('projection (excludes)', t => {
  const res = aqp('fields=-a,-b,-c');
  t.truthy(res);
  t.deepEqual(res.projection, { a: 0, b: 0, c: 0 });
});

test('projection (mix of includes/excludes)', t => {
  const res = aqp('fields=a,b,-c');
  t.truthy(res);
  t.deepEqual(res.projection, { c: 0 });
});

test('projection (multiple keys)', t => {
  const res = aqp('fields=a&fields=b');
  t.truthy(res);
  t.deepEqual(res.projection, { a: 1, b: 1 });
});

test('projection (custom key)', t => {
  const res = aqp('select=a,b,c', { projectionKey: 'select' });
  t.truthy(res);
  t.deepEqual(res.projection, { a: 1, b: 1, c: 1 });
});

test('sort', t => {
  const res = aqp('sort=a,+b,-c');
  t.truthy(res);
  t.deepEqual(res.sort, { a: 1, b: 1, c: -1 });
});

test('sort (multiple keys)', t => {
  const res = aqp('sort=a&sort=-b');
  t.truthy(res);
  t.deepEqual(res.sort, { a: 1, b: -1 });
});

test('sort (custom key)', t => {
  const res = aqp('order=a,-b', { sortKey: 'order' });
  t.truthy(res);
  t.deepEqual(res.sort, { a: 1, b: -1 });
});

test('complex response', t => {
  const res = aqp(`sort=+a,-b&skip=10&limit=50
    &fields=foo,-_id&key1=a&key2=true,c&key3=string(10)
    &key4>4&key4<=15&key5=/foo/i&key6&!key7`);
  t.deepEqual(res, {
    filter: {
      key1: 'a',
      key2: { $in: [true, 'c'] },
      key3: '10',
      key4: { $gt: 4, $lte: 15 },
      key5: /foo/i,
      key6: { $exists: true },
      key7: { $exists: false },
    },
    skip: 10,
    limit: 50,
    projection: { _id: 0, foo: 1 },
    sort: { a: 1, b: -1 },
  });
});

test('query already parsed', t => {
  const res = aqp({ key: 'foo', limit: '50' });
  t.deepEqual(res, {
    filter: {
      key: 'foo',
    },
    limit: 50,
  });
});

test('empty query', t => {
  const res = aqp();
  t.deepEqual(res, {
    filter: {},
  });
});
