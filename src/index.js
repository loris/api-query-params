import qs from 'querystring';

const builtInCasters = {
  string: val => String(val),
  date: val => new Date(String(val)),
};

const parseValue = (value, key, options) => {
  // Handle comma-separated values
  const regexes = value.match(/\/.*?\/(?:[igm]*)/g);
  const parts = regexes || value.split(',');
  if (parts && parts.length > 1) {
    return parts.map(part => parseValue(part, key, options));
  }

  // Match type casting operators like string(true)
  const casters = { ...builtInCasters, ...options.casters };
  const casting = value.match(/^(\w+)\((.*)\)$/);
  if (casting && casters[casting[1]]) {
    return casters[casting[1]](casting[2]);
  }

  // Apply casters per params
  if (
    options.castParams &&
    options.castParams[key] &&
    casters[options.castParams[key]]
  ) {
    return casters[options.castParams[key]](value);
  }

  // Match regex operators like /foo_\d+/i
  const regex = value.match(/^\/(.*)\/([igm]*)$/);
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
  if (!Number.isNaN(Number(value)) && !/^0[0-9]+/.test(value)) {
    return Number(value);
  }

  // Match YYYY-MM-DDTHH:mm:ssZ format dates
  const date = value.match(
    /^[12]\d{3}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)(T| )?(([01][0-9]|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/
  );
  if (date) {
    return new Date(value);
  }

  return value;
};

const parseOperator = operator => {
  if (operator === '=') {
    return '$eq';
  }

  if (operator === '!=') {
    return '$ne';
  }

  if (operator === '>') {
    return '$gt';
  }

  if (operator === '>=') {
    return '$gte';
  }

  if (operator === '<') {
    return '$lt';
  }

  if (operator === '<=') {
    return '$lte';
  }

  return '$exists';
};

/**
 * Map/reduce helper to transform list of unaries
 * like '+a,-b,c' to {a: 1, b: -1, c: 1}
 */
const parseUnaries = (unaries, values = { plus: 1, minus: -1 }) => {
  const unariesAsArray =
    typeof unaries === 'string' ? unaries.split(',') : unaries;

  return unariesAsArray
    .map(unary => unary.match(/^(\+|-)?(.*)/))
    .reduce((result, [, val, key]) => {
      result[key.trim()] = val === '-' ? values.minus : values.plus;
      return result;
    }, {});
};

const parseJSONString = string => {
  try {
    return JSON.parse(string);
  } catch (err) {
    return false;
  }
};

const getProjection = projection => {
  const jsonProjection = parseJSONString(projection);
  if (jsonProjection) {
    return jsonProjection;
  }

  const fields = parseUnaries(projection, { plus: 1, minus: 0 });

  /*
    From the MongoDB documentation:
    "A projection cannot contain both include and exclude specifications,
    except for the exclusion of the _id field."
  */
  const hasMixedValues =
    Object.keys(fields).reduce((set, key) => {
      if (key !== '_id') {
        set.add(fields[key]);
      }
      return set;
    }, new Set()).size > 1;

  if (hasMixedValues) {
    Object.keys(fields).forEach(key => {
      if (fields[key] === 1) {
        delete fields[key];
      }
    });
  }

  return fields;
};

const getPopulation = population =>
  population.split(',').map(path => {
    return { path };
  });

const getSort = sort => parseUnaries(sort);

const getSkip = skip => Number(skip);

const getLimit = limit => Number(limit);

const parseFilter = filter => {
  if (typeof filter === 'object') {
    return filter;
  }

  const jsonFilter = parseJSONString(filter);
  if (jsonFilter) {
    return jsonFilter;
  }

  throw new Error(`Invalid JSON string: ${filter}`);
};

const getFilter = (filter, params, options) => {
  const parsedFilter = filter ? parseFilter(filter) : {};
  return Object.keys(params)
    .map(val => {
      const join = params[val] ? `${val}=${params[val]}` : val;
      // Separate key, operators and value
      const [, prefix, key, op, value] = join.match(
        /(!?)([^><!=]+)([><]=?|!?=|)(.*)/
      );
      return {
        prefix,
        key,
        op: parseOperator(op),
        value: parseValue(value, key, options),
      };
    })
    .filter(
      ({ key }) =>
        options.blacklist.indexOf(key) === -1 &&
        (!options.whitelist || options.whitelist.indexOf(key) !== -1)
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
      } else if (op === '$ne' && typeof value === 'object' && value !== null) {
        result[key].$not = value;
      } else {
        result[key][op] = value;
      }

      return result;
    }, parsedFilter);
};

const mergeProjectionAndPopulation = result => {
  if (result.projection && result.population) {
    // Loop the population rows
    result.population.forEach(row => {
      const prefix = `${row.path}.`;
      Object.keys(result.projection).forEach(key => {
        // If field start with the name of the path, we add it to the `select` property
        if (key.startsWith(prefix)) {
          const unprefixedKey = key.replace(prefix, '');
          row.select = {
            ...row.select,
            [unprefixedKey]: result.projection[key],
          };
          // Remove field with . from the projection
          delete result.projection[key];
        }
      });
    });
  }
};

const operators = [
  { operator: 'population', method: getPopulation, defaultKey: 'populate' },
  { operator: 'projection', method: getProjection, defaultKey: 'fields' },
  { operator: 'sort', method: getSort, defaultKey: 'sort' },
  { operator: 'skip', method: getSkip, defaultKey: 'skip' },
  { operator: 'limit', method: getLimit, defaultKey: 'limit' },
  { operator: 'filter', method: getFilter, defaultKey: 'filter' },
];

const aqp = (query = '', options = {}) => {
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

  mergeProjectionAndPopulation(result);

  return result;
};

module.exports = aqp;
