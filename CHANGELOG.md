# 4.16.0 / 2020-09-21

- Make built-in casting functions customizable using the `casters` option
- Improve number detection to exclude strings greater than MAX_SAFE_INTEGER (fix #113)
- upgrade all dependencies

# 4.9.0 / 2018-11-29

- projection field accepts JSON string

# 4.5.1 / 2017-11-28

- properly handle comma-separated values (thx @bolzon)

# 4.5.0 / 2017-08-23

- provide as commonjs module (thx @SergKazakov)

# 4.4.0 / 2017-06-01

- skip JSON parsing on filter param if already parsed

# 4.3.1 / 2017-04-23

- custom casters are now properly applied on arrays (fix #81)

# 4.3.0 / 2016-11-24

- `filter` JSON parameter now gets merged with other query params instead of replacing them

# 4.2.0 / 2016-11-19

- add `casters` option to add custom casting functions
- add `castParams` option to map casting functions to query parameter values
- add CHANGELOG.md file
