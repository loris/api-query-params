import qs from 'querystring';

function castValue(type, value) {
  if (type === 'string') {
    return String(value);
  } else if (type === 'date') {
    return new Date(String(value));
  }
}

function parseValue(rawValue) {
  const value = rawValue.trim();

  if (value.includes(',')) {
    return value
      .split(',')
      .map(parseValue);
  }

  // Match type casting operators like string(true)
  const casting = value.match(/^(string|date)\((.*)\)$/);
  if (casting) {
    return castValue(casting[1], casting[2]);
  }

  // Match regex operators like /foo_\d+/i
  const regex = value.match(/^\/(.*)\/(i?)$/);
  if (regex) {
    return new RegExp(regex[1], regex[2]);
  }

  // Match boolean values
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  // Match numbers
  if (!isNaN(Number(value))) {
    return Number(value);
  }

  // Match YYYY-MM-DDTHH:mm:ssZ format dates
  /* eslint-disable max-len */
  const date = value.match(/[12]\d{3}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)(T| )?(([01][0-9]|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?/);
  /* eslint-enable max-len */
  if (date) {
    return new Date(value);
  }

  return value;
}

function parseOperator(operator) {
  if (operator === '=') {
    return '$eq';
  } else if (operator === '!=') {
    return '$ne';
  } else if (operator === '>') {
    return '$gt';
  } else if (operator === '>=') {
    return '$gte';
  } else if (operator === '<') {
    return '$lt';
  } else if (operator === '<=') {
    return '$lte';
  } else if (!operator) {
    return '$exists';
  }
}

/**
 * Map/reduce helper to transform list of unaries
 * like '+a,-b,c' to {a: 1, b: -1, c: 1}
 */
function parseUnaries(unaries) {
  const unariesAsArray = typeof unaries === 'string'
    ? unaries.split(',')
    : unaries;

  return unariesAsArray
    .map(x => x.match(/^(\+|-)?(.*)/))
    .reduce((result, [, val, key]) => {
      result[key.trim()] = val === '-' ? -1 : 1;
      return result;
    }, {});
}

function getProjection(projection) {
  const fields = parseUnaries(projection);

  /*
    From the MongoDB documentation:
    "A projection cannot contain both include and exclude specifications,
    except for the exclusion of the _id field."
  */
  const hasMixedValues = Object.keys(fields)
    .reduce((set, key) => {
      if (key !== '_id') {
        set.add(fields[key]);
      }
      return set;
    }, new Set()).size > 1;

  if (hasMixedValues) {
    for (const key in fields) {
      if (fields[key] === 1) {
        delete fields[key];
      }
    }
  }

  return fields;
}

function getSort(sort) {
  return parseUnaries(sort);
}

function getSkip(skip) {
  return Number(skip);
}

function getLimit(limit) {
  return Number(limit);
}

function getFilter(query, options) {
  return Object.keys(query)
    .filter(val => options.blacklist.indexOf(val) === -1)
    .reduce((filter, val) => {
      const join = query[val] ? `${val}=${query[val]}` : val;
      // Separate key, operators and value
      const [, prefix, key, _op, _value] = join.match(/(!?)([^><!=]+)([><]=?|!?=|)(.*)/);

      const value = parseValue(_value);
      const op = parseOperator(_op);

      if (!filter[key]) {
        filter[key] = {};
      }

      if (Array.isArray(value)) {
        filter[key][op === '$ne' ? '$nin' : '$in'] = value;
      } else if (op === '$exists') {
        filter[key][op] = prefix === '!' ? false : true;
      } else if (op === '$eq') {
        filter[key] = value;
      } else {
        filter[key][op] = value;
      }

      return filter;
    }, {});
}

const operators = {
  projection: { method: getProjection, defaultKey: 'fields' },
  sort: { method: getSort, defaultKey: 'sort' },
  skip: { method: getSkip, defaultKey: 'skip' },
  limit: { method: getLimit, defaultKey: 'limit' },
};

export default function (rawQuery = '', options = {}) {
  const result = {};
  const query = typeof rawQuery === 'string' ? qs.parse(rawQuery) : rawQuery;

  options.blacklist = options.blacklist || [];

  Object.keys(operators)
    .forEach(op => {
      const key = options[`${op}Key`] || operators[op].defaultKey;
      options.blacklist.push(key);

      if (query.hasOwnProperty(key)) {
        const value = query[key];
        result[op] = operators[op].method(value);
      }
    });

  result.filter = getFilter(query, options);

  return result;
}
