NAME = augustus
VERSION = $(shell awk '$$1 ~ /^%define$$/ && $$2 ~ /^_version$$/ {print $$3}' ./package/$(NAME).spec)
RELEASE = $(shell awk '$$1 ~ /^Release:$$/ {print $$2}' ./package/$(NAME).spec)
RELEASEplus1 = $(shell expr $(RELEASE) + 1)
GITURL = $(shell awk '/url = git:\/\// {print $$3}' .git/config)

commit: ut

secondary: ut rpm ft after

ut:
	@make clean -C ./test/unit/ && make test-cov -C ./test/unit/

rpm:
ifeq ($(VERSION), )
	@echo "package version not found in rpm build spec file!"
else
	@git checkout master
	@/usr/local/sinasrv2/bin/rpmbuild_env.sh -d ./rpmbuild
	@git clone . rpmbuild/SOURCES/$(NAME)-$(VERSION)
	@cd rpmbuild/SOURCES && tar -zcvf $(NAME)-$(VERSION).tar.gz $(NAME)-$(VERSION)
	@/usr/local/sinasrv2/bin/flavor-specfile.sh -f package/$(NAME).spec
	@cp package/$(NAME).spec rpmbuild/SPECS/
	@cd rpmbuild/SPECS && rpmbuild -bb $(NAME).spec
	if [[ `awk '$$1 ~ /^Release:$$/ {print $$2}' ./package/$(NAME).spec` -eq $(RELEASE) ]]; \
	then \
		echo "No code change, spec and changelog file unchanged."; \
	else \
		git checkout package/$(NAME).spec; \
		sed -i "s/^Release:.*/Release: $(RELEASEplus1)/" package/$(NAME).spec; \
		git add package/* && git commit -m "New RPM Build: update changelog file, release number in spec file +1"; \
		git tag RPMBuild-$(VERSION)-$(RELEASEplus1); \
	fi
endif

ft: rpm
	scp test/functional/run-test.sh root@10.210.226.161:/tmp/run-test-$(NAME).sh
	ssh 10.210.226.161 "mkdir -p /data0/package/$(NAME)/$(VERSION)-$(RELEASE)"
	scp rpmbuild/RPMS/x86_64/* root@10.210.226.161:/data0/package/$(NAME)/$(VERSION)-$(RELEASE)/
	ssh 10.210.226.161 "cd /data0/package/$(NAME)/$(VERSION)-$(RELEASE)/;/tmp/run-test-$(NAME).sh *.rpm"

after:
	@git remote set-url --push origin git@10.210.213.9:rome/augustus.git
	@git branch
	@git push origin
	@git push origin --tags

.PHONY: ut rpm ft after
