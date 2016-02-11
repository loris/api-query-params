import test from 'tape';
import aqp from '../src';

test('filter: basic', t => {
  const res = aqp('key=value');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: 'value' });
});

test('filter: numeric casting', t => {
  const res = aqp('key1=10&key2=1.2&key3=0');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key1: 10, key2: 1.2, key3: 0 });
});

test('filter: boolean casting', t => {
  const res = aqp('key1=true&key2=false');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key1: true, key2: false });
});

test('filter: regex casting', t => {
  const res = aqp('key1=/regex/&key2=/regexi/i');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key1: /regex/, key2: /regexi/i });
});

test('filter: date casting', t => {
  const res = aqp('key1=2016-04&key2=2016-04-12&key3=2016-04-02 08:00');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, {
    key1: new Date('2016-04'),
    key2: new Date('2016-04-12'),
    key3: new Date('2016-04-02 08:00'),
  });
});

test('filter: force casting', t => {
  const res = aqp('key1=string(10)&key2=date(2016)');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key1: '10', key2: new Date('2016') });
});

test('filter: $gt operator', t => {
  const res = aqp('key>value');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $gt: 'value' } });
});

test('filter: $lt operator', t => {
  const res = aqp('key<value');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $lt: 'value' } });
});

test('filter: $gte operator', t => {
  const res = aqp('key>=value');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $gte: 'value' } });
});

test('filter: $lte operator', t => {
  const res = aqp('key<=value');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $lte: 'value' } });
});

test('filter: $ne operator', t => {
  const res = aqp('key!=value');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $ne: 'value' } });
});

test('filter: $not operator (with regex)', t => {
  const res = aqp('key!=/value/');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $not: /value/ } });
});

test('filter: $in operator (multiple keys)', t => {
  const res = aqp('key=a&key=b');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $in: ['a', 'b'] } });
});

test('filter: $in operator (comma separated)', t => {
  const res = aqp('key=a,b');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $in: ['a', 'b'] } });
});

test('filter: $nin operator (multiple keys)', t => {
  const res = aqp('key!=a&key!=b');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $nin: ['a', 'b'] } });
});

test('filter: $nin operator (comma separated)', t => {
  const res = aqp('key!=a,b');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key: { $nin: ['a', 'b'] } });
});

test('filter: $exists operator', t => {
  const res = aqp('key1&!key2');
  t.plan(2);
  t.ok(res.filter);
  t.same(res.filter, { key1: { $exists: true }, key2: { $exists: false } });
});

test('filter: ignore default keys', t => {
  const res = aqp('key=value&skip=0&limit=10&fields=id,name&sort=name');
  t.plan(6);
  t.ok(res.filter);
  t.notOk(res.filter.skip);
  t.notOk(res.filter.limit);
  t.notOk(res.filter.fields);
  t.notOk(res.filter.sort);
  t.same(res.filter, { key: 'value' });
});

test('filter: ignore custom keys', t => {
  const res = aqp('key=value&$skip=0&$limit=10&$fields=id,name&$sort=name', {
    skipKey: '$skip',
    limitKey: '$limit',
    projectionKey: '$fields',
    sortKey: '$sort',
  });
  t.plan(6);
  t.ok(res.filter);
  t.notOk(res.filter.$skip);
  t.notOk(res.filter.$limit);
  t.notOk(res.filter.$fields);
  t.notOk(res.filter.$sort);
  t.same(res.filter, { key: 'value' });
});

test('filter: ignore blacklisted keys', t => {
  const res = aqp('key1=value1&key2=value2&key3=value3', {
    blacklist: ['key1', 'key3'],
  });
  t.plan(4);
  t.ok(res.filter);
  t.notOk(res.filter.key1);
  t.notOk(res.filter.key3);
  t.same(res.filter, { key2: 'value2' });
});

test('filter: ignore all but whitelisted keys', t => {
  const res = aqp('key1=value1&key2=value2&key3=value3', {
    whitelist: ['key2'],
  });
  t.plan(4);
  t.ok(res.filter);
  t.notOk(res.filter.key1);
  t.notOk(res.filter.key3);
  t.same(res.filter, { key2: 'value2' });
});

test('skip', t => {
  const res = aqp('skip=10');
  t.plan(2);
  t.ok(res);
  t.equal(res.skip, 10);
});

test('skip (custom key)', t => {
  const res = aqp('offset=10', { skipKey: 'offset' });
  t.plan(2);
  t.ok(res);
  t.equal(res.skip, 10);
});

test('limit', t => {
  const res = aqp('limit=10');
  t.plan(2);
  t.ok(res);
  t.equal(res.limit, 10);
});

test('limit (custom key)', t => {
  const res = aqp('max=10', { limitKey: 'max' });
  t.plan(2);
  t.ok(res);
  t.equal(res.limit, 10);
});

test('projection (includes)', t => {
  const res = aqp('fields=a,b,c');
  t.plan(2);
  t.ok(res);
  t.same(res.projection, { a: 1, b: 1, c: 1 });
});

test('projection (includes + _id exclude)', t => {
  const res = aqp('fields=a,b,-_id');
  t.plan(2);
  t.ok(res);
  t.same(res.projection, { a: 1, b: 1, _id: -1 });
});

test('projection (excludes)', t => {
  const res = aqp('fields=-a,-b,-c');
  t.plan(2);
  t.ok(res);
  t.same(res.projection, { a: -1, b: -1, c: -1 });
});

test('projection (mix of includes/excludes)', t => {
  const res = aqp('fields=a,b,-c');
  t.plan(2);
  t.ok(res);
  t.same(res.projection, { c: -1 });
});

test('projection (multiple keys)', t => {
  const res = aqp('fields=a&fields=b');
  t.plan(2);
  t.ok(res);
  t.same(res.projection, { a: 1, b: 1 });
});

test('projection (custom key)', t => {
  const res = aqp('select=a,b,c', { projectionKey: 'select' });
  t.plan(2);
  t.ok(res);
  t.same(res.projection, { a: 1, b: 1, c: 1 });
});

test('sort', t => {
  const res = aqp('sort=a,+b,-c');
  t.plan(2);
  t.ok(res);
  t.same(res.sort, { a: 1, b: 1, c: -1 });
});

test('sort (multiple keys)', t => {
  const res = aqp('sort=a&sort=-b');
  t.plan(2);
  t.ok(res);
  t.same(res.sort, { a: 1, b: -1 });
});

test('sort (custom key)', t => {
  const res = aqp('order=a,-b', { sortKey: 'order' });
  t.plan(2);
  t.ok(res);
  t.same(res.sort, { a: 1, b: -1 });
});

test('complex response', t => {
  const res = aqp(`sort=+a,-b&skip=10&limit=50
    &fields=foo,-_id&key1=a&key2=true,c&key3=string(10)
    &key4>4&key4<=15&key5=/foo/i&key6&!key7`);
  t.plan(2);
  t.ok(res);
  t.same(res, {
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
    projection: { _id: -1, foo: 1 },
    sort: { a: 1, b: -1 },
  });
});

test('query already parsed', t => {
  const res = aqp({ key: 'foo', limit: '50' });
  t.plan(2);
  t.ok(res);
  t.same(res, {
    filter: {
      key: 'foo',
    },
    limit: 50,
  });
});

test('empty query', t => {
  const res = aqp();
  t.plan(2);
  t.ok(res);
  t.same(res, {
    filter: {},
  });
});
