import qs from 'querystring';

const builtInCasters = {
  string: val => String(val),
  date: val => new Date(String(val)),
};

function parseValue(value, key, options = {}) {
  if (value.includes(',')) {
    return value
      .split(',')
      .map(arrayVal => parseValue(arrayVal, key, options));
  }

  // Match type casting operators like string(true)
  const casters = { ...builtInCasters, ...options.casters };
  const casting = value.match(/^(\w+)\((.*)\)$/);
  if (casting && casters[casting[1]]) {
    return casters[casting[1]](casting[2]);
  }

  // Apply casters per params
  if (options.castParams && options.castParams[key] && casters[options.castParams[key]]) {
    return casters[options.castParams[key]](value);
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

  // Match null
  if (value === 'null') {
    return null;
  }

  // Match numbers (string padded with zeros are not numbers)
  if (!isNaN(Number(value)) && !/^0[0-9]+/.test(value)) {
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
function parseUnaries(unaries, values = { plus: 1, minus: -1 }) {
  const unariesAsArray = typeof unaries === 'string'
    ? unaries.split(',')
    : unaries;

  return unariesAsArray
    .map(x => x.match(/^(\+|-)?(.*)/))
    .reduce((result, [, val, key]) => {
      result[key.trim()] = val === '-' ? values.minus : values.plus;
      return result;
    }, {});
}

function getProjection(projection) {
  const fields = parseUnaries(projection, { plus: 1, minus: 0 });

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
    Object.keys(fields)
      .forEach(key => {
        if (fields[key] === 1) {
          delete fields[key];
        }
      });
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

function parseFilter(filter) {
  try {
    return JSON.parse(filter);
  } catch (err) {
    throw new Error(`Invalid JSON string: ${filter}`);
  }
}

function getFilter(filter, params, options) {
  const parsedFilter = filter ? parseFilter(filter) : {};
  return Object.keys(params)
    .map(val => {
      const join = params[val] ? `${val}=${params[val]}` : val;
      // Separate key, operators and value
      const [, prefix, key, op, value] = join.match(/(!?)([^><!=]+)([><]=?|!?=|)(.*)/);
      return { prefix, key, op: parseOperator(op), value: parseValue(value, key, options) };
    })
    .filter(({ key }) =>
      options.blacklist.indexOf(key) === -1
      && (!options.whitelist || options.whitelist.indexOf(key) !== -1),
    )
    .reduce((result, { prefix, key, op, value }) => {
      if (!result[key]) {
        result[key] = {};
      }

      if (Array.isArray(value)) {
        result[key][op === '$ne' ? '$nin' : '$in'] = value;
      } else if (op === '$exists') {
        result[key][op] = prefix !== '!';
      } else if (op === '$eq') {
        result[key] = value;
      } else if (op === '$ne' && typeof value === 'object') {
        result[key].$not = value;
      } else {
        result[key][op] = value;
      }

      return result;
    }, parsedFilter);
}

const operators = [
  { operator: 'projection', method: getProjection, defaultKey: 'fields' },
  { operator: 'sort', method: getSort, defaultKey: 'sort' },
  { operator: 'skip', method: getSkip, defaultKey: 'skip' },
  { operator: 'limit', method: getLimit, defaultKey: 'limit' },
  { operator: 'filter', method: getFilter, defaultKey: 'filter' },
];

export default function (query = '', options = {}) {
  const result = {};
  const params = typeof query === 'string' ? qs.parse(query) : query;

  options.blacklist = options.blacklist || [];

  operators.forEach(({ operator, method, defaultKey }) => {
    const key = options[`${operator}Key`] || defaultKey;
    const value = params[key];
    options.blacklist.push(key);

    if (value || operator === 'filter') {
      result[operator] = method(value, params, options);
    }
  });

  return result;
}
