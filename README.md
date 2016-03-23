# api-query-params

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Coveralls Status][coveralls-image]][coveralls-url]
[![Dependency Status][depstat-image]][depstat-url]
[![Downloads][download-badge]][npm-url]

> Convert query parameters from API urls to MongoDB queries

## Features

- 

## Install

```sh
npm i --save api-query-params
```

## Usage

```js
import aqp from 'api-query-params';

const query = aqp('status=sent&timestamp>2016-01-01&author.firstName=/john/i&limit=10&sort=-timestamp');
//  {
//    filter: {
//      status: 'sent',
//      timestamp: { '$gt': Fri Jan 01 2016 01:00:00 GMT+0100 (CET) },
//      'author.firstName': /john/i
//    },
//    sort: { timestamp: -1 },
//    limit: 10
//  }
```

WIP

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
