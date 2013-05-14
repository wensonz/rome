#!/bin/sh

CWD=`dirname "$0"`

if ! [ -d $CWD/components ]; then
    mkdir $CWD/components
fi

if ! [ -d $CWD/components/data ]; then
    if ! [ -d $CWD/../../vatican/src ]; then
        echo "Vatican does not exist in $CWD/../../vatican/src";
        exit 1;
    fi
    ln -sf $CWD/../../vatican/src $CWD/components/data;
fi

if ! [ -d $CWD/../../../condotti ]; then
    echo "Condotti does not exist in $CWD/../../../condotti";
    exit 1;
fi

if ! [ -d $CWD/../../../condotti/bootstrap ]; then
    echo "Condotti bootstrap does not exist in $CWD/../../../condotti/bootstrap";
    exit 1;
fi

if ! [ -d $CWD/../../../condotti/bootstrap/build ]; then
    echo "Condotti has not been built. Building it now ...";
    make -C $CWD/../../../condotti/bootstrap server
fi

export NODE_PATH="$CWD/../../../condotti/bootstrap/build:$CWD/../src/:$NODE_PATH"
node $CWD/../src/bin/rome start