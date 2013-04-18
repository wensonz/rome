REPORTER = spec
TESTS = test/*.js
TESTTIMEOUT = 20000

test:
	@NODE_ENV=test /usr/local/sinasrv2/bin/mocha \
                --reporter $(REPORTER) \
                --timeout $(TESTTIMEOUT) $(TESTS)

.PHONY: test
