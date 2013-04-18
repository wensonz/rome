exports.error = {
    paramError: 4001,
    generate: {
        postDataError: 4500,
        counter: {
            readError: 4510,
            dataError: 4511
        },
        tag: {
            readError: 4520,
            dataError: 4521
        },
        node: {
            readError: 4530,
            readHistoryError: 4531,
            dataError: 4532
        },
        role: {
            readError: 4540,
            readHistoryError: 4541,
            dataError: 4542
        },
        template: {
            readError: 4550,
            readHistoryError: 4551,
            dataError: 4552
        },
        assets: {
            readError: 4600,
            dataError: 4601
        },
        idc: {
            readError: 4610,
            dataError: 4611
        },
        helper: {
            readError: 4620,
            dataError: 4621
        }
    },
    formatter: {
        jsonError: 4560
    },
    merge: {
        mergeError: 4570,
    },
    renderer: {
        files: {
            configFileError: 4580
        }
    },
    writer: {
        files: {
            configFileError: 4590
        }
    },
    processer: {
        files: {
            compareContentError: 4600
        }
    },
    role: {
        updateError: 4101,
        readError: 4102,
        deleteError: 4103,
        historyError: 4104
    },
    template: {
        updateError: 4201,
        readError: 4202,
        deleteError: 4203,
        historyError: 4204
    },
    node: {
        updateError: 4301,
        readError: 4302,
        deleteError: 4303,
        historyError: 4304
    },
    tag: {
        createError: 4401,
        readError: 4402
    }
};

exports.limit = {
    role: {
        nameLength: 64,
        includeListLength: 50,
        filenameLength: 256,
        filepathLength: 256,
        fileownerLength: 64,
        filepermissionLength: 10,
        filetemplateLength: 64,
        changelogLength: 1024,
        dataLength: 1024*1024,
        operationLimitSize: 20,
        operationLimitDefaultSize: 5
    },
    node: {
        nameLength: 64,
        rolesListLength: 50,
        changelogLength: 1024,
        operationLimitSize: 20,
        operationLimitDefaultSize: 5
    },
    template: {
        nameLength: 64,
        changelogLength: 1024,
        contentLength: 1024*1024,
        operationLimitSize: 20,
        operationLimitDefaultSize: 5
    },
    tag: {
        nameLength: 64,
        changelogLength: 1024,
        operationLimitSize: 20,
        operationLimitDefaultSize: 5
    }
};

