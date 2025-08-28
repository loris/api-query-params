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

  // Handle comma-separated values
  const regexes = value.match(/\/.*?\/(?:[igm]*)/g);
  const parts = regexes || value.split(',');
  if (parts && parts.length > 1) {
    return parts.map((part) => parseValue(part, key, options));
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
    return casters.regex(regex[1], regex[2]);
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
  } 
  // eslint-disable-next-line no-unused-vars
  catch (_err) {
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
  
  // Parse all parameter conditions and group by key
  const conditionsByKey = Object.keys(params)
    .reduce((acc, paramKey) => {
      const paramValues = Array.isArray(params[paramKey]) ? params[paramKey] : [params[paramKey]];
      
      paramValues.forEach(paramValue => {
        const join = paramValue ? `${paramKey}=${paramValue}` : paramKey;
        const [, prefix, key, op, value] = join.match(/(!?)([^><!=]+)([><]=?|!?=|)(.*)/);
        
        if (options.blacklist.indexOf(key) === -1 && 
            (!options.whitelist || options.whitelist.indexOf(key) !== -1)) {
          
          if (!acc[key]) {
            acc[key] = [];
          }
          
          acc[key].push({
            prefix,
            key,
            op: parseOperator(op),
            value: parseValue(value, key, options),
          });
        }
      });
      
      return acc;
    }, {});
  
  // Build final query
  let finalQuery = { ...parsedFilter };
  const andConditions = [];
  
  Object.keys(conditionsByKey).forEach(key => {
    const conditions = conditionsByKey[key];
    
    if (conditions.length === 1) {
      // Single condition for this key
      const { prefix, op, value } = conditions[0];
      
      if (Array.isArray(value)) {
        // Comma-separated values: use $in/$nin for OR logic within the same parameter
        if (op === '$ne') {
          finalQuery[key] = { $nin: value };
        } else {
          finalQuery[key] = { $in: value };
        }
      } else if (op === '$exists') {
        finalQuery[key] = { [op]: prefix !== '!' };
      } else if (op === '$ne' && typeof value === 'object' && value !== null) {
        finalQuery[key] = { $not: value };
      } else {
        // Single value conditions
        if (op === '$eq') {
          finalQuery[key] = value;
        } else {
          finalQuery[key] = { [op]: value };
        }
      }
    } else {
      // Multiple conditions for the same key
      const keyConditions = conditions.map(({ prefix, op, value }) => {
        if (Array.isArray(value)) {
          // Comma-separated values: use $in/$nin for OR logic
          if (op === '$ne') {
            return { [key]: { $nin: value } };
          } else {
            return { [key]: { $in: value } };
          }
        } else if (op === '$exists') {
          return { [key]: { [op]: prefix !== '!' } };
        } else if (op === '$ne' && typeof value === 'object' && value !== null) {
          return { [key]: { $not: value } };
        } else {
          // Single value conditions
          if (op === '$eq') {
            return { [key]: value };
          } else {
            return { [key]: { [op]: value } };
          }
        }
      });
      
      // Add conditions to the $and array
      andConditions.push(...keyConditions);
    }
  });
  
  // Add any additional $and conditions to the final query
  if (andConditions.length > 0) {
    if (finalQuery.$and) {
      finalQuery.$and.push(...andConditions);
    } else {
      finalQuery.$and = andConditions;
    }
  }
  
  return finalQuery;
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
  let params;

  if (typeof query === 'string') {
    params = {};
    const urlSearchParams = new URLSearchParams(query);
    for (const [key, value] of urlSearchParams.entries()) {
      if (params[key]) {
        if (Array.isArray(params[key])) {
          params[key].push(value);
        } else {
          params[key] = [params[key], value];
        }
      } else {
        params[key] = value;
      }
    }
  } else {
    params = query;
  }

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

export default aqp;
