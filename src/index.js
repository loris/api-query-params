import qs from 'querystring';

const builtInCasters = {
  boolean: (val) => val === 'true',
  date: (val) => new Date(val),
  null: () => null,
  number: (val) => Number(val),
  regex: (val, flags) => new RegExp(val, flags),
  string: (val) => String(val),
};

const parseValue = (value, key, options) => {
  // Match type casting operators like string(true)
  const casters = { ...builtInCasters, ...options.casters };
  const castersList = Object.keys(casters).join('|');
  const castersRegexp = new RegExp(`^(${castersList})\\(([^)]*)\\)$`);
  const casting = value.match(castersRegexp);
  if (casting && casters[casting[1]]) {
    return casters[casting[1]](casting[2]);
  }

  // Handle comma-separated regexes: /a/,/b/ or /a,b/,/b,a/
  if (/^(\/.*?\/[igm]*,)+(\/.*?\/[igm]*)$/.test(value)) {
    return value.split(/,(?=\/)/).map((part) => parseValue(part, key, options));
  }

  // Match regex operators like /foo_\d+/i
  const regex = value.match(/^\/(.*)\/([igm]*)$/);
  if (regex) {
    return casters.regex(regex[1], regex[2]);
  }

  // Only split on commas if the value is not a regex and does not look like a file path with slashes
  // If the value contains a comma and does not contain unescaped slashes (not a regex), split
  if (value.includes(',') && !/^\/.+\/[igm]*$/.test(value)) {
    return value.split(',').map((part) => parseValue(part, key, options));
  }

  // Apply casters per params
  if (
    options.castParams &&
    options.castParams[key] &&
    casters[options.castParams[key]]
  ) {
    return casters[options.castParams[key]](value);
  }

  // Match boolean values
  if (value === 'true' || value === 'false') {
    return casters.boolean(value);
  }

  // Match null
  if (value === 'null') {
    return casters.null(value);
  }

  // Match numbers (strings greater than MAX_SAFE_INTEGER or padded with zeros are not numbers)
  if (
    !Number.isNaN(Number(value)) &&
    Math.abs(value) <= Number.MAX_SAFE_INTEGER &&
    !/^0[0-9]+/.test(value)
  ) {
    return casters.number(value);
  }

  // Match YYYY-MM-DDTHH:mm:ssZ format dates
  const date = value.match(
    /^[12]\d{3}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)(T| )?(([01][0-9]|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/
  );
  if (date) {
    return casters.date(value);
  }

  // Default to string
  return casters.string(value);
};

const parseOperator = (operator) => {
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
    .map((unary) => unary.match(/^(\+|-)?(.*)/))
    .reduce((result, [, val, key]) => {
      result[key.trim()] = val === '-' ? values.minus : values.plus;
      return result;
    }, {});
};

const parseJSONString = (string) => {
  try {
    return JSON.parse(string);
  } catch (err) {
    return false;
  }
};

const getProjection = (projection) => {
  const fields =
    parseJSONString(projection) ||
    parseUnaries(projection, { plus: 1, minus: 0 });

  /*
    From the MongoDB documentation:
    "A projection cannot contain both include and exclude specifications,
    except for the exclusion of the _id field."
  */
  const hasMixedValues =
    Object.keys(fields).reduce((set, key) => {
      if (key !== '_id' && (fields[key] === 0 || fields[key] === 1)) {
        set.add(fields[key]);
      }
      return set;
    }, new Set()).size > 1;

  if (hasMixedValues) {
    Object.keys(fields).forEach((key) => {
      if (fields[key] === 1) {
        delete fields[key];
      }
    });
  }

  return fields;
};

const getPopulation = (population) => {
  const cache = {};

  function iterateLevels(levels, prevLevels = []) {
    let populate;
    let path;
    const topLevel = levels.shift();
    prevLevels.push(topLevel);

    const cacheKey = prevLevels.join('.');
    if (cache[cacheKey]) {
      path = cache[cacheKey];
    } else {
      path = { path: topLevel };
    }
    cache[cacheKey] = path;

    if (levels.length) {
      populate = iterateLevels(levels, prevLevels);
      if (populate) {
        path.populate = populate;
      }
    }
    return path;
  }

  const populations = population.split(',').map((path) => {
    return iterateLevels(path.split('.'));
  });

  return [...new Set(populations)]; // Deduplicate array
};

const getSort = (sort) => parseUnaries(sort);

const getSkip = (skip) => Number(skip);

const getLimit = (limit) => Number(limit);

const parseFilter = (filter) => {
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
    .map((val) => {
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
      } else if (typeof result[key] === 'string') {
        result[key] = { $eq: result[key] };
      }

      if (Array.isArray(value)) {
        result[key][op === '$ne' ? '$nin' : '$in'] = value;
      } else if (op === '$exists') {
        result[key][op] = prefix !== '!';
      } else if (op === '$eq' && Object.entries(result[key]).length === 0) {
        result[key] = value;
      } else if (op === '$ne' && typeof value === 'object' && value !== null) {
        result[key].$not = value;
      } else {
        result[key][op] = value;
      }

      return result;
    }, parsedFilter);
};

const mergeProjectionAndPopulation = (result) => {
  function iteratePopulation(population, prevPrefix = '') {
    population.forEach((row) => {
      const prefix = `${prevPrefix}${row.path}.`;
      Object.keys(result.projection).forEach((key) => {
        if (key.startsWith(prefix)) {
          const unprefixedKey = key.replace(prefix, '');
          if (unprefixedKey.indexOf('.') === -1) {
            row.select = {
              ...row.select,
              [unprefixedKey]: result.projection[key],
            };
            delete result.projection[key];
          }
        }
      });
      if (row.populate) {
        iteratePopulation([row.populate], prefix);
      }
    });
  }

  if (result.projection && result.population) {
    iteratePopulation(result.population);
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
module.exports.default = aqp;
