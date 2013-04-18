TESTS = *-test.js
TESTTIMEOUT = 5000
REPORTER = spec

test: 
	@cp -r ../../src/src/* lib/
	@NODE_PATH=/usr/local/sinasrv2/rome/node_modules/ NODE_ENV=test \
	mocha \
		--reporter $(REPORTER) --timeout $(TESTTIMEOUT) $(TESTS)

test-cov: test lib-cov
	@JSCOV=1 NODE_PATH=/usr/local/sinasrv2/rome/node_modules/ NODE_ENV=test \
	/usr/local/sinasrv2/bin/mocha \
		--reporter html-cov --timeout $(TESTTIMEOUT) $(TESTS) > coverage.html

lib-cov:
	@jscoverage --no-highlight lib/ lib-cov/

clean:
	rm -rf lib-cov
	rm -f coverage.html
	rm -rf lib
	mkdir lib lib-cov


.PHONY: test test-cov lib-cov clean
