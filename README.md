# api-query-params

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Coveralls Status][coveralls-image]][coveralls-url]
[![Dependency Status][depstat-image]][depstat-url]
[![Downloads][download-badge]][npm-url]

> Convert query parameters from API urls to MongoDB queries (advanced querying, filtering, sorting, …)

## Features

- **Powerful**. Supports most of MongoDB operators (`$in`, `$regexp`, …) and features (nested objects, projection, type casting, …)
- **Custom**. Allows customization of keys (ie, `fields` vs `select`) and options
- **Agnostic.** Works with any web frameworks (Express, Koa, …) and/or MongoDB libraries (mongoose, mongoskin, …)
- **Simple.** ~200 LOCs, dependency-free ES6 code
- **Fully tested.** 100% code coverage

## Install

```sh
npm i --save api-query-params
```

## Usage

#### API

`aqp(queryString, [opts])`

> Converts `queryString` into a MongoDB query object

###### Arguments

- `queryString`: query string part of the requested API URL (ie, `firstName=John&limit=10`). Works with already parsed object too (ie, `{status: 'success'}`) [required]
- `opts`: object for advanced options (See below) [optional] 

###### Returns

The resulting object contains the following properties:

- `filter` which contains the query criteria
- `projection` which contains the query projection
- `sort`, `skip`, `limit` which contains the cursor modifiers

#### Example 

```js
import aqp from 'api-query-params';

const query = aqp('status=sent&timestamp>2016-01-01&author.firstName=/john/i&limit=100&skip=50&sort=-timestamp&fields=id');
//  {
//    filter: {
//      status: 'sent',
//      timestamp: { $gt: Fri Jan 01 2016 01:00:00 GMT+0100 (CET) },
//      'author.firstName': /john/i
//    },
//    sort: { timestamp: -1 },
//    skip: 50,
//    limit: 100,
//    projection: { id: 1 }
//  }
```

#### Example with Express and mongoose

```js
import express from 'express';
import aqp from 'api-query-params';
import User from './models/User';

const app = express();

app.get('/users', (req, res, next) => {
  const query = aqp(req.query);
  User
    .find(query.filter)
    .skip(skip)
    .limit(limit)
    .sort(sort)
    .exec((err, users) => {
      if (err) {
        return next(err);
      }

      res.send(users);
    });
});
```

That's it. Your `/users` endpoint can now query, filter, sort your `User` mongoose model and more.

## Supported features

#### Filtering operators

| MongoDB | URI | Example | Result |
| ------- | --- | ------- | ------ |
| `$eq` | `key=val` | `type=public` | `{filter: {type: 'public'}}` |
| `$gt` | `key>val` | `count>5` | `{filter: {count: {$gt: 5}}}` |
| `$gte` | `key>=val` | `rating>=9.5` | `{filter: {rating: {$gte: 9.5}}}` |
| `$lt` | `key<val` | `createdAt<2016-01-01` | `{filter: {createdAt: {$lt: Fri Jan 01 2016 01:00:00 GMT+0100 (CET)}}}` |
| `$lte` | `key<=val` | `score<=-5` | `{filter: {score: {$lte: -5}}}` |
| `$ne` | `key!=val` | `status!=success` | `{filter: {status: {$ne: 'success'}}}` |
| `$in` | `key=val1,val2` | `country=GB,US` | `{filter: {country: {$in: ['GB', 'US']}}}` |
| `$nin` | `key!=val1,val2` | `lang!=fr,en` | `{filter: {lang: {$nin: ['fr', 'en']}}}` |
| `$exists` | `key` | `phone` | `{filter: {phone: {$exists: true}}}` |
| `$exists` | `!key` | `!email` | `{filter: {email: {$exists: false}}}` |
| `$regex` | `key=/value/<opts>` | `email=/@gmail\.com$/i` | `{filter: {email: /@gmail.com$/i}}` |
| `$regex` | `key!=/value/<opts>` | `phone!=/^06/` | `{filter: {phone: { $not: /^06/}}}` |

For more advanced usage (`$or`, `$type`, `$elemMatch`, etc.), pass any MongoDB query filter object as JSON string in the `filter` query parameter, ie:

```js
aqp('filter={"$or":[{"key1":"value1"},{"key2":"value2"}]}');
//  {
//    filter: {
//      $or: [
//        { key1: 'value1' },
//        { key2: 'value2' }
//      ]
//    },
//  }
```


#### Skip / Limit operators

- Useful to limit the number of records returned.
- Default operator keys are `skip` and `limit`.

```js
aqp('skip=5&limit=10');
//  {
//    skip: 5,
//    limit: 10
//  }
```

#### Projection operator

- Useful to limit fields to return in each records.
- Default operator key is `fields`.
- It accepts a comma-separated list of fields. Default behavior is to specify fields to return. Use `-` prefixes to return all fields except some specific fields.
- Due to a MongoDB limitation, you cannot combine inclusion and exclusion semantics in a single projection with the exception of the _id field.

```js
aqp('fields=id,url');
//  {
//    projection: { id: 1, url: 1}
//  }
```

```js
aqp('fields=-_id,-email');
//  {
//    projection: { _id: 0, email: 0 }
//  }
```

#### Sort operator

- Useful to sort returned records.
- Default operator key is `sort`.
- It accepts a comma-separated list of fields. Default behavior is to sort in ascending order. Use `-` prefixes to sort in descending order.

```js
aqp('sort=-points,createdAt');
//  {
//    sort: { points: -1, createdAt: 1 }
//  }
```

#### Keys with multiple values

Any operators which process a list of fields (`$in`, `$nin`, sort and projection) can accept a comma-separated string or multiple pairs of key/value:

- `country=GB,US` is equivalent to `country=GB&country=US`
- `sort=-createdAt,lastName` is equivalent to `sort=-createdAt&sort=lastName`

#### Embedded documents using `.` notation

Any operators can be applied on deep properties using `.` notation:

```js
aqp('followers[0].id=123&sort=-metadata.created_at');
//  {
//    filter: {
//      'followers[0].id': 123,
//    },
//    sort: { 'metadata.created_at': -1 }
//  }
```

#### Automatic type casting

The following types are automatically casted: `Number`, `RegExp`, `Date` and `Boolean`. `null` string is also casted:

```js
aqp('date=2016-01-01&boolean=true&integer=10&regexp=/foobar/i&null=null');
// {
//   filter: {
//     date: Fri Jan 01 2016 01:00:00 GMT+0100 (CET),
//     boolean: true,
//     integer: 10,
//     regexp: /foobar/i,
//     null: null
//   }
// }
```

If you need to disable or force type casting, you can wrap the values with `string()` or `date()` operators:

```js
aqp('key1=string(10)&key2=date(2016)&key3=string(null)');
// {
//   filter: {
//     key1: '10',
//     key2: Fri Jan 01 2016 01:00:00 GMT+0100 (CET),
//     key3: 'null'
//   }
// }
```

## Available options (`opts`)

#### Customize operator keys

The following options are useful to change the operator default keys:

- `skipKey`: custom skip operator key (default is `skip`)
- `limitKey`: custom limit operator key (default is `limit`)
- `projectionKey`: custom projection operator key (default is `fields`)
- `sortKey`: custom sort operator key (default is `sort`)
- `filterKey`: custom filter operator key (default is `filter`)

```js
aqp('organizationId=123&offset=10&max=125', {
  limitKey: 'max',
  skipKey: 'offset'
});
// {
//   filter: {
//     organizationId: 123,
//   },
//   skip: 10,
//   limit: 125
// }
```

#### Blacklist / Whitelist

The following options are useful to specify which keys to use in the `filter` object. (ie, avoid that authentication parameter like `apiKey` ends up in a mongoDB query). All operator keys are (`sort`, `limit`, etc.) already ignored.

- `blacklist`: filter on all keys except the ones specified
- `whitelist`: filter only on the keys specified

```js
aqp('id=e9117e5c-c405-489b-9c12-d9f398c7a112&apiKey=foobar', {
  blacklist: ['apiKey']
});
// {
//   filter: {
//     id: 'e9117e5c-c405-489b-9c12-d9f398c7a112',
//   }
// }
```

## License

MIT © [Loris Guignard](http://github.com/loris)

[npm-url]: https://npmjs.org/package/api-query-params
[npm-image]: https://img.shields.io/npm/v/api-query-params.svg?style=flat-square

[travis-url]: https://travis-ci.org/loris/api-query-params
[travis-image]: https://img.shields.io/travis/loris/api-query-params.svg?style=flat-square

[coveralls-url]: https://coveralls.io/r/loris/api-query-params
[coveralls-image]: https://img.shields.io/coveralls/loris/api-query-params.svg?style=flat-square

[depstat-url]: https://david-dm.org/loris/api-query-params
[depstat-image]: https://david-dm.org/loris/api-query-params.svg?style=flat-square

[download-badge]: http://img.shields.io/npm/dm/api-query-params.svg?style=flat-square
