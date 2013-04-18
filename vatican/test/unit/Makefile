#TESTS = test/UT_test/*.js
TESTS = *.test.js
TESTTIMEOUT = 5000
REPORTER = spec

test:
	test -d lib || mkdir lib
	cp ../../src/src/vatican.js ../../src/src/config.json lib/
	@NODE_PATH=/usr/local/sinasrv2/rome/node_modules/ \
	NODE_ENV=test /usr/local/sinasrv2/bin/mocha \
	--reporter $(REPORTER) --timeout $(TESTTIMEOUT) $(TESTS)

test-cov: test lib-cov
	@JSCOV=1 $(MAKE) test REPORTER=html-cov > coverage.html

lib-cov:
	@jscoverage --no-highlight lib/ lib-cov/

clean:
	rm -rf lib-cov
	rm -f coverage.html
	rm -rf lib
	mkdir lib lib-cov


.PHONY: test test-cov lib-cov clean
