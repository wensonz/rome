#!/bin/bash
#
# This api is used for rome testing development
#

. /data0/dpool_lib.sh

export PATH=/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/usr/local/sbin:/usr/local/sinasrv/bin:/usr/local/sinasrv/sbin:/usr/local/sinasrv2/bin:/usr/local/sinasrv2/sbin

package=$1
name="augustus"
version="0.1.0-1"
git_url="git://10.210.213.9/rome/augustus.git"

# make sure that node exists
node=`which node 2>&1`
ret=$?
if [ $ret -eq 0 ] && [ -x "$node" ]; then
  (exit 0)
else
  echo "Install sinasrv2-node first, and then try again."
  echo ""
  echo "Maybe node is installed, but not in the PATH?"
  echo ""
  echo "PATH=$PATH"
  exit $ret
fi

# make sure that mocha exists
mocha=`which mocha 2>&1`
ret=$?
if [ $ret -eq 0 ] && [ -x "$mocha" ]; then
  (exit 0)
else
  echo "Install sinasrv2-mocha first, and then try again."
  echo ""
  echo "Maybe mocha is installed, but not in the PATH?"
  echo ""
  echo "PATH=$PATH"
  exit $ret
fi

put_file 10.210.226.159 $package /data0/package
run_cmd 10.210.226.159 "cd /data0/package; yum -y install $package"
ssh 10.210.226.159 "echo '{
    \"fileGenerator\": {
        \"fsPrefix\": \"/data0/augustus/download\",
        \"urlPrefix\": \"http://10.210.226.159:3000/augustus/download\"
    }
}' > /usr/local/sinasrv2/rome/augustus/src/config.json"
run_cmd 10.210.226.159 "/etc/init.d/rome-server restart"

# set the temp dir
TMP="${TMPDIR}"
if [ "x$TMP" = "x" ]; then
  TMP="/tmp"
fi
TMP="${TMP}/${name}_test.$$"
rm -rf "$TMP" || true
mkdir "$TMP"
if [ $? -ne 0 ]; then
  echo "failed to mkdir $TMP"
  exit 1
fi

BACK="$PWD"

echo "> Clone package from git for $name."

url=`(git clone $git_url $TMP/$name)`

ret=$?
if [ "x$url" = "x" ]; then
  ret=125
  # try again
  url=`(git clone $git_url $TMP/$name)`
  ret=$?
  if [ "x$url" = "x" ]; then
    ret=125
  fi
fi
if [ $ret -ne 0 ]; then
  echo "Failed to git clone package for $t"
  exit $ret
fi

echo "fetching: $url"

cd "$TMP" \
  && cd "$name/test/functional" \
  && (echo "> Testing start..."
      sleep 5 && make test
      ret=$?
      if [ $ret -ne 0 ]; then
        echo "someting wrong."
        exit $ret
      fi) \
  && cd "$BACK" \
  && rm -rf "$TMP" \
  && echo "It worked"

ret=$?
if [ $ret -ne 0 ]; then
  echo "It failed"
fi
exit $ret
