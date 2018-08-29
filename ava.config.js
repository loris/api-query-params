export default {
  verbose: true,
  // Do not apply project `.babelrc` to test files, use AVA’s own Babel pipeline
  // https://github.com/avajs/ava/blob/master/docs/recipes/babel.md#make-ava-skip-your-projects-babel-options
  babel: {
    testOptions: {
      babelrc: false,
    },
  },
  // Apply project `.babelrc` to source files
  require: [
    '@babel/register',
  ],
};
