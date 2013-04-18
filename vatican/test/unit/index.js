module.exports = process.env.JSCOV 
  ? require('test/UT_test/lib-cov/data-storage')
  : require('test/UT_test/lib/data-storage');
