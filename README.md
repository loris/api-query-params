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

#### Basic usage

Call the default method (exported as `aqp` here for easier manipulation) with a query string (or already parsed object). The resulting object contains the following properties:
- `filter` which contains the query criteria
- `projection` which contains the query projection
- `sort`, `skip`, `limit` which contains the cursor modifiers

```js
import aqp from 'api-query-params';

const query = aqp('status=sent&timestamp>2016-01-01&author.firstName=/john/i&limit=100&skip=50&sort=-timestamp&fields=id');
//  {
//    filter: {
//      status: 'sent',
//      timestamp: { '$gt': Fri Jan 01 2016 01:00:00 GMT+0100 (CET) },
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

#### Supported operators

- `$eq`	using `=`. Matches values that are equal to a specified value.
```js
aqp('type=public');
//  { filter: { type: 'public' } }
```

$eq	Matches values that are equal to a specified value.
$gt	Matches values that are greater than a specified value.
$gte	Matches values that are greater than or equal to a specified value.
$lt	Matches values that are less than a specified value.
$lte	Matches values that are less than or equal to a specified value.
$ne	Matches all values that are not equal to a specified value.
$in	Matches any of the values specified in an array.
$nin	Matches none of the values specified in an array.

$or	Joins query clauses with a logical OR returns all documents that match the conditions of either clause.
$and	Joins query clauses with a logical AND returns all documents that match the conditions of both clauses.
$not	Inverts the effect of a query expression and returns documents that do not match the query expression.
$nor	Joins query clauses with a logical NOR returns all documents that fail to match both clauses.

$regex	Selects documents where values match a specified regular expression.

- Condition on embedded document with `.` notation
```js
aqp('followers[0].id=123');
//  {
//    filter: {
//      'followers[0].id': 123,
//    }
//  }
```

#### Automatic type casting

The following type are automatically casted: `Integer`, `Regex`, `Date`, `Boolean`:

```js
aqp('date=2016-01-01&boolean=true&integer=10&regexp=/foobar/i');
// {
//   filter: {
//     date: Fri Jan 01 2016 01:00:00 GMT+0100 (CET),
//     boolean: true,
//     integer: 10,
//     regexp: /foobar/i
//   }
// }
```

If you need to disable or force type casting, you can wrap the values with `string()` or `date()` operators:

```js
aqp('key1=string(10)&key2=date(2016)');
// {
//   filter: {
//     key1: '10',
//     key2: Fri Jan 01 2016 01:00:00 GMT+0100 (CET)
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
